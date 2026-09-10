import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { env } from '../../config/env';
import { realtime } from './realtime.service';
import { realtimeQuota } from './quota.service';
import { sendSuccess, sendError } from '../../utils/response';

const router = Router();
router.use(requireAuth);

/** One lease per browser tab, so two tabs never share (or fight over) a slot. */
const leaseIdFor = (req: AuthRequest): string => {
  const tab = String(req.query.tabId ?? req.body?.tabId ?? '').slice(0, 64);
  return tab ? `${req.user!.publicId}:${tab}` : req.user!.publicId;
};

/**
 * Handshake. The browser calls this before connecting and is told which
 * transport to use. Handing out Pusher only while slots remain is what keeps
 * concurrent connections under the plan ceiling — client 101 is simply told
 * to use Socket.IO instead.
 */
router.get('/config', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const snapshot = await realtimeQuota.snapshot();
    const leaseId = leaseIdFor(req);

    let transport = snapshot.transport;
    if (transport === 'pusher' && !(await realtimeQuota.acquireConnectionLease(leaseId))) {
      transport = 'socket';
    }

    sendSuccess(
      res,
      {
        transport,
        leaseId,
        heartbeatSeconds: Math.floor(realtimeQuota.leaseTtlSeconds / 3),
        // Only ever the publishable key — the secret stays on the server.
        pusher: transport === 'pusher'
          ? {
              key: env.PUSHER_KEY,
              cluster: env.PUSHER_CLUSTER,
              authEndpoint: `/api/${env.API_VERSION}/realtime/pusher/auth`,
              channels: realtime.channelsFor(req.user!),
            }
          : null,
        reason: transport === 'socket'
          ? snapshot.breakerOpen ? 'pusher-unavailable'
            : !snapshot.configured ? 'pusher-not-configured'
              : !snapshot.messagesAvailable ? 'daily-message-quota-reached'
                : 'connection-limit-reached'
          : null,
      },
      'Realtime config',
    );
  } catch (e) { next(e); }
});

/** Keeps the connection lease alive; a tab that stops calling frees its slot. */
router.post('/heartbeat', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const renewed = await realtimeQuota.acquireConnectionLease(leaseIdFor(req));
    sendSuccess(res, { renewed }, renewed ? 'Lease renewed' : 'Lease lost');
  } catch (e) { next(e); }
});

/** Called on tab close so the slot is reusable immediately, not after the TTL. */
router.post('/release', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await realtimeQuota.releaseConnectionLease(leaseIdFor(req));
    sendSuccess(res, null, 'Lease released');
  } catch (e) { next(e); }
});

/**
 * Pusher private-channel auth. Pusher will not let a browser subscribe to a
 * `private-` channel without a signature from here, and we only sign channels
 * that belong to the caller.
 */
router.post('/pusher/auth', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const socketId = String(req.body?.socket_id ?? '');
    const channel = String(req.body?.channel_name ?? '');
    if (!socketId || !channel) {
      sendError(res, 'socket_id and channel_name are required', 400);
      return;
    }

    const auth = realtime.authorizeChannel(socketId, channel, req.user!);
    if (!auth) {
      sendError(res, 'Not permitted to subscribe to this channel', 403);
      return;
    }

    // Pusher's client expects the bare auth object, not our envelope.
    res.json(auth);
  } catch (e) { next(e); }
});

/** Quota dashboard for the super-admin system console. */
router.get('/status', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await realtimeQuota.snapshot(), 'Realtime status');
  } catch (e) { next(e); }
});

export { router as realtimeRouter };
