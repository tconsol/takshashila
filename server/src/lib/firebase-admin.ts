import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Firebase Admin SDK server-side only (full project privileges).
 * Initialized lazily from env credentials. If Firebase env isn't configured the
 * helpers below become safe no-ops so the app still boots without it.
 */
let app: App | null = null;

function getFirebaseApp(): App | null {
  if (app) return app;
  if (getApps().length) {
    app = getApp();
    return app;
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return null; // not configured
  }

  app = initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // .env stores newlines as the literal two-char sequence "\n" → restore them.
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
  logger.info('Firebase Admin initialized', { projectId: FIREBASE_PROJECT_ID });
  return app;
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseApp() !== null;
}

/**
 * Send an FCM push to one or more device tokens. Invalid/expired tokens are
 * returned so the caller can prune them. No-op (returns []) if Firebase is off.
 */
export async function sendPushToTokens(
  tokens: string[],
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<{ invalidTokens: string[] }> {
  const fbApp = getFirebaseApp();
  if (!fbApp || tokens.length === 0) return { invalidTokens: [] };

  const res = await getMessaging(fbApp).sendEachForMulticast({ tokens, notification, data });

  const invalidTokens: string[] = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code ?? '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
        invalidTokens.push(tokens[i]);
      }
    }
  });

  logger.info('FCM push sent', { sent: res.successCount, failed: res.failureCount });
  return { invalidTokens };
}
