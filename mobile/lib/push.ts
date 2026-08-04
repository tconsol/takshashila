import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

// Expo Go (SDK 53+) removed remote push. Importing expo-notifications at module
// load even crashes there — so we lazy-import it and skip entirely in Expo Go.
// In a dev/standalone build push works; in Expo Go the socket still gives instant
// in-app updates (just no OS-level notifications while backgrounded).
const isExpoGo = Constants.executionEnvironment === 'storeClient';

let registeredToken: string | null = null;

export async function registerForPush(): Promise<void> {
  if (isExpoGo) return;
  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    if (!Device.isDevice) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenData.data;
    if (token && token !== registeredToken) {
      await api.post('/users/me/push-token', { token });
      registeredToken = token;
    }
  } catch {
    /* non-fatal — realtime still works over the socket */
  }
}

export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  try { await api.delete('/users/me/push-token', { data: { token: registeredToken } }); } catch {}
  registeredToken = null;
}

/** Subscribe to notification taps → open the chat. No-op in Expo Go. */
export function subscribeToNotificationTaps(onChat: (conversationPublicId: string) => void): () => void {
  if (isExpoGo) return () => {};
  let remove: (() => void) | null = null;
  import('expo-notifications').then((Notifications) => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as { type?: string; conversationPublicId?: string };
      if (data?.type === 'chat' && data.conversationPublicId) onChat(data.conversationPublicId);
    });
    remove = () => sub.remove();
  }).catch(() => {});
  return () => remove?.();
}
