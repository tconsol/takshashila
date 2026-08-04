import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { authService } from '../../services/auth.service';

export default function RegisterScreen() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  function update(field: keyof typeof form) {
    return (value: string) => setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleResend() {
    if (!registeredEmail) return;
    setResending(true);
    try {
      await authService.resendVerification(registeredEmail);
      Alert.alert('Email sent', 'We sent another verification link. Check your inbox and spam folder.');
    } catch {
      Alert.alert('Could not resend', 'Please try again in a moment.');
    } finally {
      setResending(false);
    }
  }

  async function handleRegister() {
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await authService.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        role: 'STUDENT',
      });
      setRegisteredEmail(form.email.trim().toLowerCase());
    } catch (err: unknown) {
      Alert.alert(
        'Registration Failed',
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (registeredEmail) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center px-6">
          <View className="items-center">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <Ionicons name="mail-open" size={40} color="#059669" />
            </View>
            <Text className="text-2xl font-bold text-slate-900">Check your email</Text>
            <Text className="mt-2 text-center text-sm text-slate-500">
              We sent a verification link to{'\n'}
              <Text className="font-semibold text-slate-700">{registeredEmail}</Text>.{'\n'}
              Click it, then sign in.
            </Text>

            <TouchableOpacity
              onPress={handleResend}
              disabled={resending}
              className="mt-6 w-full flex-row items-center justify-center gap-2 rounded-2xl border border-indigo-200 py-3.5"
            >
              {resending ? <ActivityIndicator size="small" color="#6366F1" /> : (
                <>
                  <Ionicons name="refresh" size={18} color="#6366F1" />
                  <Text className="text-[15px] font-semibold text-indigo-600">Resend email</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} className="mt-3 w-full rounded-2xl bg-indigo-600 py-3.5">
              <Text className="text-center text-[15px] font-bold text-white">Go to login</Text>
            </TouchableOpacity>

            <Text className="mt-5 text-center text-xs text-slate-400">
              Didn't get it? Check your spam folder or resend.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900">Create account</Text>
            <Text className="text-muted mt-1">Join brainbaseeduas a student</Text>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="First Name *"
                value={form.firstName}
                onChangeText={update('firstName')}
                placeholder="John"
                autoCapitalize="words"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Last Name *"
                value={form.lastName}
                onChangeText={update('lastName')}
                placeholder="Doe"
                autoCapitalize="words"
              />
            </View>
          </View>

          <Input
            label="Email *"
            value={form.email}
            onChangeText={update('email')}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
          />
          <Input
            label="Phone (optional)"
            value={form.phone}
            onChangeText={update('phone')}
            placeholder="+91 98765 43210"
            keyboardType="phone-pad"
            leftIcon="call-outline"
          />
          <Input
            label="Password *"
            value={form.password}
            onChangeText={update('password')}
            placeholder="Min 8 characters"
            isPassword
            leftIcon="lock-closed-outline"
          />
          <Input
            label="Confirm Password *"
            value={form.confirmPassword}
            onChangeText={update('confirmPassword')}
            placeholder="Re-enter password"
            isPassword
            leftIcon="lock-closed-outline"
          />

          <Button
            onPress={handleRegister}
            loading={loading}
            size="lg"
            className="mt-2 w-full"
          >
            Create Account
          </Button>

          {/* Divider */}
          <View className="flex-row items-center my-5">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="mx-3 text-xs font-medium text-gray-400">OR</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          <GoogleSignInButton label="Sign up with Google" />

          <View className="flex-row items-center justify-center mt-6 gap-1">
            <Text className="text-muted">Already have an account?</Text>
            <Link href="/(auth)/login" className="text-primary-500 font-semibold ml-1">
              Sign In
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
