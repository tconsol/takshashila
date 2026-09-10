import { env } from '../../config/env';
import { logger } from '../../lib/logger';

/**
 * Health of every third-party the platform depends on.
 *
 * The distinction that matters operationally is between *not configured* and
 * *configured but broken*: a missing Stripe key on staging is expected, a
 * present key that fails to authenticate is an outage. So each probe reports
 * one of:
 *
 *   ok            — reachable and working
 *   degraded      — reachable but not fully usable
 *   down          — configured, but the probe failed
 *   not-configured— no credentials supplied; the feature is simply off
 *
 * Network probes are cached, because this endpoint is polled every 15 seconds
 * by the console and hammering Stripe or SMTP on that cadence would be both
 * wasteful and a good way to get rate-limited.
 */

export type IntegrationStatus = 'ok' | 'degraded' | 'down' | 'not-configured';

export interface IntegrationHealth {
  key: string;
  name: string;
  /** What breaks for users when this is down. */
  impact: string;
  status: IntegrationStatus;
  latencyMs: number | null;
  detail: string | null;
  checkedAt: string;
}

const CACHE_TTL_MS = 60_000;
/** A probe that hangs must not hang the whole health page. */
const PROBE_TIMEOUT_MS = 5_000;

const cache = new Map<string, { value: IntegrationHealth; expiresAt: number }>();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Probe timed out after ${ms}ms`)), ms),
    ),
  ]);
}

interface ProbeSpec {
  key: string;
  name: string;
  impact: string;
  /** False when credentials are absent — reported as not-configured, never probed. */
  configured: boolean;
  /** Omit for config-only checks (nothing to reach out to). */
  probe?: () => Promise<{ status: IntegrationStatus; detail?: string }>;
}

async function run(spec: ProbeSpec): Promise<IntegrationHealth> {
  const base = {
    key: spec.key,
    name: spec.name,
    impact: spec.impact,
    checkedAt: new Date().toISOString(),
  };

  if (!spec.configured) {
    return { ...base, status: 'not-configured', latencyMs: null, detail: 'No credentials configured' };
  }

  if (!spec.probe) {
    return { ...base, status: 'ok', latencyMs: null, detail: 'Credentials present' };
  }

  const cached = cache.get(spec.key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const start = Date.now();
  let result: IntegrationHealth;
  try {
    const { status, detail } = await withTimeout(spec.probe(), PROBE_TIMEOUT_MS);
    result = { ...base, status, latencyMs: Date.now() - start, detail: detail ?? null };
  } catch (error) {
    result = {
      ...base,
      status: 'down',
      latencyMs: Date.now() - start,
      detail: (error as Error).message.slice(0, 200),
    };
    logger.warn('Integration probe failed', { integration: spec.key, error: (error as Error).message });
  }

  cache.set(spec.key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

export class IntegrationsService {
  private specs(): ProbeSpec[] {
    return [
      {
        key: 'gcs',
        name: 'Google Cloud Storage',
        impact: 'Resource and worksheet uploads, class recordings',
        configured: Boolean(env.GCP_BUCKET_NAME && env.GCP_PROJECT_ID),
        probe: async () => {
          const { getStorage } = await import('../media/media.service');
          // `exists()` is a metadata read — cheap, and it exercises both the
          // credentials and the bucket name, which is what actually breaks.
          const [exists] = await getStorage().bucket(env.GCP_BUCKET_NAME!).exists();
          return exists
            ? { status: 'ok', detail: `Bucket ${env.GCP_BUCKET_NAME} reachable` }
            : { status: 'down', detail: `Bucket ${env.GCP_BUCKET_NAME} not found` };
        },
      },
      {
        key: 'gcs-recordings',
        name: 'Recording Bucket',
        impact: 'Storing finished class recordings',
        configured: Boolean(env.GCS_RECORDING_BUCKET),
        probe: async () => {
          const { getStorage } = await import('../media/media.service');
          const [exists] = await getStorage().bucket(env.GCS_RECORDING_BUCKET!).exists();
          return exists
            ? { status: 'ok', detail: `Bucket ${env.GCS_RECORDING_BUCKET} reachable` }
            : { status: 'down', detail: `Bucket ${env.GCS_RECORDING_BUCKET} not found` };
        },
      },
      {
        key: 'smtp',
        name: 'Email (SMTP)',
        impact: 'Verification, password reset, invitations',
        configured: Boolean(env.SMTP_HOST),
        probe: async () => {
          const { transporter } = await import('../../queues/email.queue');
          await transporter.verify();
          return { status: 'ok', detail: `${env.SMTP_HOST}:${env.SMTP_PORT}` };
        },
      },
      {
        key: 'agora-rtc',
        name: 'Agora RTC',
        impact: 'Live classes — audio and video',
        configured: Boolean(env.AGORA_APP_ID && env.AGORA_APP_CERTIFICATE),
        probe: async () => {
          // Token minting is local crypto, so this validates the credentials
          // are usable without spending a network round-trip on every poll.
          const { RtcTokenBuilder, RtcRole } = await import('agora-token');
          const token = RtcTokenBuilder.buildTokenWithUid(
            env.AGORA_APP_ID,
            env.AGORA_APP_CERTIFICATE,
            'healthcheck',
            0,
            RtcRole.PUBLISHER,
            60,
            60,
          );
          return token
            ? { status: 'ok', detail: 'Token generation working' }
            : { status: 'down', detail: 'Token generation returned empty' };
        },
      },
      {
        key: 'agora-recording',
        name: 'Agora Recording',
        impact: 'Recording live classes',
        configured: Boolean(
          env.AGORA_RECORDING_ENABLED && env.AGORA_CUSTOMER_ID && env.AGORA_CUSTOMER_SECRET,
        ),
      },
      {
        key: 'agora-whiteboard',
        name: 'Agora Whiteboard',
        impact: 'Shared whiteboard in live classes',
        configured: Boolean(env.AGORA_WHITEBOARD_APP_ID),
      },
      {
        key: 'stripe',
        name: 'Stripe',
        impact: 'Card top-ups for student wallets',
        configured: Boolean(env.STRIPE_SECRET_KEY),
        probe: async () => {
          // Balance retrieval is the cheapest authenticated call and proves the
          // key is live rather than merely present.
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as never });
          await stripe.balance.retrieve();
          const webhook = env.STRIPE_WEBHOOK_SECRET
            ? 'API and webhook secret configured'
            : 'API reachable, but no webhook secret — payment confirmations will not land';
          return {
            status: env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'degraded',
            detail: webhook,
          };
        },
      },
      {
        key: 'razorpay',
        name: 'Razorpay',
        impact: 'UPI and card top-ups',
        configured: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
        probe: async () => {
          const ok = Boolean(env.RAZORPAY_WEBHOOK_SECRET);
          return {
            status: ok ? 'ok' : 'degraded',
            detail: ok
              ? 'Keys and webhook secret configured'
              : 'Keys present, but no webhook secret — payment confirmations will not land',
          };
        },
      },
      {
        key: 'firebase',
        name: 'Firebase',
        impact: 'Mobile push notifications',
        configured: Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL),
      },
      {
        key: 'google-oauth',
        name: 'Google Sign-In',
        impact: 'Signing in with a Google account',
        configured: Boolean(env.GOOGLE_CLIENT_ID),
      },
      {
        key: 'pusher',
        name: 'Pusher Channels',
        impact: 'Realtime updates (falls back to Socket.IO)',
        configured: Boolean(env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET),
      },
    ];
  }

  /** Probes run in parallel; one slow dependency does not serialise the rest. */
  async getAll(): Promise<IntegrationHealth[]> {
    return Promise.all(this.specs().map((spec) => run(spec)));
  }

  /** Forces the next call to re-probe instead of serving the cache. */
  invalidate(): void {
    cache.clear();
  }
}

export const integrationsService = new IntegrationsService();
