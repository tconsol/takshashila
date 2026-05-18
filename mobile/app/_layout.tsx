import '../global.css';
import React, { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '../lib/query-client';
import { useAuthStore } from '../stores/auth.store';
import { authService } from '../services/auth.service';
import { tokenStorage } from '../lib/token';
import { LoadingScreen } from '../components/ui/LoadingScreen';

function AppBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const { setUser, clearAuth } = useAuthStore();

  useEffect(() => {
    async function bootstrap() {
      const token = await tokenStorage.getAccessToken();
      if (!token || tokenStorage.isExpired(token)) {
        await clearAuth();
        setReady(true);
        return;
      }
      try {
        const user = await authService.getMe();
        setUser(user);
      } catch {
        await clearAuth();
      }
      setReady(true);
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const { user } = useAuthStore.getState();
    router.replace(user ? '/(student)' : '/(auth)/login');
  }, [ready]);

  if (!ready) return <LoadingScreen message="Starting up..." />;
  return <>{children}</>;
}

const detailScreenOptions = {
  headerBackTitle: 'Back',
  headerTintColor: '#0F172A',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#F8FAFC' },
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 16 },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <AppBootstrap>
            <Stack>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(student)" options={{ headerShown: false }} />
              <Stack.Screen
                name="class/[classId]"
                options={{ ...detailScreenOptions, headerTitle: 'Class details' }}
              />
              <Stack.Screen
                name="worksheet/[worksheetId]"
                options={{ ...detailScreenOptions, headerTitle: 'Test' }}
              />
              <Stack.Screen
                name="my-tutor"
                options={{ ...detailScreenOptions, headerTitle: 'My tutor' }}
              />
              <Stack.Screen
                name="attendance"
                options={{ ...detailScreenOptions, headerTitle: 'Attendance' }}
              />
              <Stack.Screen
                name="tutors"
                options={{ ...detailScreenOptions, headerTitle: 'Browse tutors' }}
              />
              <Stack.Screen
                name="tutor/[tutorId]"
                options={{ ...detailScreenOptions, headerTitle: 'Book a class' }}
              />
            </Stack>
          </AppBootstrap>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
