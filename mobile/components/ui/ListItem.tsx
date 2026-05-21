import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ListItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconTint?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky' | 'violet' | 'gray';
  title: string;
  subtitle?: string;
  rightLabel?: string;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
}

const TINT_COLORS = {
  indigo:  { bg: '#EEF2FF', fg: '#4F46E5' },
  emerald: { bg: '#D1FAE5', fg: '#059669' },
  rose:    { bg: '#FFE4E6', fg: '#E11D48' },
  amber:   { bg: '#FEF3C7', fg: '#D97706' },
  sky:     { bg: '#E0F2FE', fg: '#0284C7' },
  violet:  { bg: '#F3E8FF', fg: '#9333EA' },
  gray:    { bg: '#F1F5F9', fg: '#475569' },
};

export function ListItem({
  icon, iconTint = 'indigo', title, subtitle, rightLabel,
  onPress, showChevron = true, destructive = false,
}: ListItemProps) {
  const { bg, fg } = TINT_COLORS[iconTint];
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      className="flex-row items-center bg-white px-4 py-3.5"
    >
      <View
        className="w-10 h-10 rounded-2xl items-center justify-center"
        style={{ backgroundColor: bg }}
      >
        <Ionicons name={icon} size={19} color={destructive ? '#E11D48' : fg} />
      </View>
      <View className="flex-1 ml-3">
        <Text
          className={`text-[15px] font-semibold ${destructive ? 'text-rose-600' : 'text-gray-900'}`}
        >
          {title}
        </Text>
        {subtitle && (
          <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightLabel && (
        <Text className="text-sm text-gray-500 mr-1">{rightLabel}</Text>
      )}
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
      )}
    </TouchableOpacity>
  );
}
