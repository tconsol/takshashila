import React from 'react';
import { View, Text } from 'react-native';

interface AvatarProps {
  name?: string;
  size?: number;
  className?: string;
}

const COLOR_POOL = [
  { bg: '#EEF2FF', fg: '#4F46E5' },
  { bg: '#DCFCE7', fg: '#16A34A' },
  { bg: '#FFE4E6', fg: '#E11D48' },
  { bg: '#FEF3C7', fg: '#D97706' },
  { bg: '#E0F2FE', fg: '#0284C7' },
  { bg: '#F3E8FF', fg: '#9333EA' },
];

function pickColor(name?: string) {
  if (!name) return COLOR_POOL[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLOR_POOL[Math.abs(hash) % COLOR_POOL.length];
}

function getInitials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Avatar({ name, size = 44, className }: AvatarProps) {
  const { bg, fg } = pickColor(name);
  return (
    <View
      className={`items-center justify-center rounded-full ${className ?? ''}`}
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      <Text style={{ color: fg, fontSize: size * 0.4, fontWeight: '700' }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
