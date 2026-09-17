import { logger } from './logger';

// Send push notifications to Expo push tokens (ExponentPushToken[...]).
// Uses Expo's push service — no FCM/APNs keys needed for Expo apps.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendExpoPush(
  tokens: string[],
  notification: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  const valid = tokens.filter((t) => t && t.startsWith('ExponentPushToken'));
  if (valid.length === 0) return;

  const messages = valid.map((to) => ({
    to,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data ?? {},
    priority: 'high',
  }));

  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    logger.warn('Expo push send failed', { error: (e as Error).message });
  }
}
