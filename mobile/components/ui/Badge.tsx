import React from 'react';
import { View, Text } from 'react-native';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700' },
  error:   { bg: 'bg-red-100',   text: 'text-red-700' },
  info:    { bg: 'bg-blue-100',  text: 'text-blue-700' },
  neutral: { bg: 'bg-gray-100',  text: 'text-gray-600' },
};

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const { bg, text } = variantStyles[variant];
  return (
    <View className={`self-start px-2 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-xs font-medium ${text}`}>{label}</Text>
    </View>
  );
}
