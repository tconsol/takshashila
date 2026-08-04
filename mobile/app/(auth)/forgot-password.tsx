import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/auth.service';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch {
      // Backend responds success regardless (no account enumeration).
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-1 justify-center px-6">
          <TouchableOpacity onPress={() => router.back()} className="absolute left-5 top-4 h-10 w-10 items-center justify-center">
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>

          {sent ? (
            <View className="items-center">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                <Ionicons name="mail-open" size={40} color="#059669" />
              </View>
              <Text className="text-xl font-bold text-slate-900">Check your email</Text>
              <Text className="mt-2 text-center text-sm text-slate-500">
                If an account exists for {email}, we've sent a link to reset your password.
              </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')} className="mt-6 w-full rounded-2xl bg-indigo-600 py-3.5">
                <Text className="text-center text-base font-bold text-white">Back to login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View className="mb-6 h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100">
                <Ionicons name="lock-closed" size={30} color="#6366F1" />
              </View>
              <Text className="text-2xl font-bold text-slate-900">Forgot password?</Text>
              <Text className="mt-1.5 text-sm text-slate-500">
                Enter your email and we'll send you a link to reset your password.
              </Text>

              <Text className="mb-1.5 mt-6 text-sm font-medium text-slate-700">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-base text-slate-900"
              />

              <TouchableOpacity
                onPress={submit}
                disabled={busy || !email.trim()}
                className={`mt-5 flex-row items-center justify-center rounded-2xl py-4 ${busy || !email.trim() ? 'bg-indigo-300' : 'bg-indigo-600'}`}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Send reset link</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
