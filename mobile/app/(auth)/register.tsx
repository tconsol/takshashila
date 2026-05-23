import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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

  function update(field: keyof typeof form) {
    return (value: string) => setForm((f) => ({ ...f, [field]: value }));
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
      Alert.alert(
        'Account Created',
        'Please check your email to verify your account, then sign in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      );
    } catch (err: unknown) {
      Alert.alert(
        'Registration Failed',
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
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
          contentContainerClassName="flex-grow px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900">Create account</Text>
            <Text className="text-muted mt-1">Join Takshashila as a student</Text>
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
