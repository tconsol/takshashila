import React, { useState } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../stores/auth.store';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { user, accessToken, refreshToken } = await authService.login({
        email: email.trim().toLowerCase(),
        password,
      });
      await setAuth(user, accessToken, refreshToken);
      router.replace('/(student)');
    } catch (err: unknown) {
      Alert.alert(
        'Login failed',
        err instanceof Error ? err.message : 'Invalid credentials. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="mb-8">
            <View
              className="w-20 h-20 rounded-3xl bg-primary-500 items-center justify-center mb-5"
              style={{
                shadowColor: '#6366F1',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <Text className="text-4xl">🎓</Text>
            </View>
            <Text className="text-3xl font-bold text-gray-900">Welcome back</Text>
            <Text className="text-base text-gray-500 mt-1.5">
              Sign in to continue your learning journey
            </Text>
          </View>

          {/* Form */}
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon="mail-outline"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            isPassword
            leftIcon="lock-closed-outline"
          />

          <Button
            onPress={handleLogin}
            loading={loading}
            size="lg"
            className="mt-3 w-full"
          >
            Sign in
          </Button>

          <View className="flex-row items-center justify-center mt-8">
            <Text className="text-sm text-gray-500">Don't have an account?</Text>
            <Link href="/(auth)/register" className="text-primary-600 text-sm font-bold ml-1.5">
              Sign up
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
