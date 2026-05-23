import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ title, subtitle, actionLabel, onActionPress }: SectionHeaderProps) {
  return (
    <View className="flex-row items-end justify-between mb-3 px-1">
      <View className="flex-1">
        <Text className="text-[17px] font-bold text-gray-900">{title}</Text>
        {subtitle && (
          <Text className="text-xs text-gray-500 mt-0.5">{subtitle}</Text>
        )}
      </View>
      {actionLabel && onActionPress && (
        <TouchableOpacity
          onPress={onActionPress}
          className="flex-row items-center"
          activeOpacity={0.6}
        >
          <Text className="text-primary-500 text-sm font-semibold">{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color="#6366F1" />
        </TouchableOpacity>
      )}
    </View>
  );
}
