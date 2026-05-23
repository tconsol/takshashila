import React from 'react';
import { View } from 'react-native';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  className?: string;
}

export function ProgressBar({
  value, max = 100, color = '#6366F1', height = 8, className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <View
      className={`bg-gray-100 rounded-full overflow-hidden w-full ${className ?? ''}`}
      style={{ height }}
    >
      <View
        style={{
          height: '100%',
          width: `${pct}%`,
          backgroundColor: color,
          borderRadius: 999,
        }}
      />
    </View>
  );
}
