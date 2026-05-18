import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = 'information-circle-outline', title, description, action }: EmptyStateProps) {
  return (
    <View className="items-center py-12 px-6">
      <View
        className="w-16 h-16 rounded-3xl items-center justify-center mb-4"
        style={{ backgroundColor: '#EEF2FF' }}
      >
        <Ionicons name={icon} size={28} color="#6366F1" />
      </View>
      <Text className="text-base font-semibold text-gray-900 text-center">{title}</Text>
      {description && (
        <Text className="text-sm text-gray-500 text-center mt-1 max-w-xs">{description}</Text>
      )}
      {action && <View className="mt-5">{action}</View>}
    </View>
  );
}
