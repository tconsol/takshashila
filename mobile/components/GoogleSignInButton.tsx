import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View, Alert } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../stores/auth.store';

// Finishes the auth session if the browser was left open after redirect.
WebBrowser.maybeCompleteAuthSession();

const ANDROID_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const IOS_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const WEB_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export function GoogleSignInButton({ label = 'Continue with Google' }: { label?: string }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: ANDROID_ID,
    iosClientId: IOS_ID,
    webClientId: WEB_ID,
  });

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response?.type === 'error') setBusy(false);
      return;
    }
    const idToken = response.params?.id_token ?? response.authentication?.idToken;
    if (!idToken) { setBusy(false); return; }

    (async () => {
      try {
        const { user, accessToken, refreshToken } = await authService.googleAuth(idToken);
        await setAuth(user, accessToken, refreshToken);
        router.replace('/(student)');
      } catch (err: unknown) {
        Alert.alert('Google sign-in failed', err instanceof Error ? err.message : 'Please try again.');
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const notConfigured = !ANDROID_ID && !IOS_ID && !WEB_ID;

  const onPress = async () => {
    if (notConfigured) {
      Alert.alert('Not configured', 'Google sign-in keys are not set up yet.');
      return;
    }
    setBusy(true);
    try {
      await promptAsync();
    } catch {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy || !request}
      activeOpacity={0.85}
      className="w-full flex-row items-center justify-center gap-2.5 rounded-2xl border border-gray-200 bg-white py-3.5"
      style={{ opacity: busy || !request ? 0.7 : 1 }}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#4285F4" />
      ) : (
        <>
          <View className="h-5 w-5 items-center justify-center">
            <Ionicons name="logo-google" size={18} color="#4285F4" />
          </View>
          <Text className="text-[15px] font-semibold text-gray-700">{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
