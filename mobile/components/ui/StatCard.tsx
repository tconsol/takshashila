import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  tint?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky' | 'violet';
  trend?: { value: string; up?: boolean };
}

const TINTS = {
  indigo:  { bg: '#EEF2FF', fg: '#4F46E5' },
  emerald: { bg: '#D1FAE5', fg: '#059669' },
  rose:    { bg: '#FFE4E6', fg: '#E11D48' },
  amber:   { bg: '#FEF3C7', fg: '#D97706' },
  sky:     { bg: '#E0F2FE', fg: '#0284C7' },
  violet:  { bg: '#F3E8FF', fg: '#9333EA' },
};

export function StatCard({ label, value, icon, tint = 'indigo', trend }: StatCardProps) {
  const { bg, fg } = TINTS[tint];
  return (
    <View
      className="flex-1 bg-white rounded-3xl p-4"
      style={{
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View
        className="w-9 h-9 rounded-2xl items-center justify-center mb-3"
        style={{ backgroundColor: bg }}
      >
        <Ionicons name={icon} size={18} color={fg} />
      </View>
      <Text className="text-[20px] font-bold text-gray-900" numberOfLines={1}>
        {value}
      </Text>
      <Text className="text-[11px] text-gray-500 mt-0.5" numberOfLines={1}>
        {label}
      </Text>
      {trend && (
        <View className="flex-row items-center mt-1">
          <Ionicons
            name={trend.up ? 'trending-up' : 'trending-down'}
            size={11}
            color={trend.up ? '#059669' : '#E11D48'}
          />
          <Text
            className="text-[10px] ml-1 font-medium"
            style={{ color: trend.up ? '#059669' : '#E11D48' }}
          >
            {trend.value}
          </Text>
        </View>
      )}
    </View>
  );
}
