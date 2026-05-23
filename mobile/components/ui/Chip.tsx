import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`px-4 py-2 rounded-full border ${
        selected ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'
      }`}
    >
      <Text
        className={`text-[13px] font-semibold ${
          selected ? 'text-white' : 'text-gray-600'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
