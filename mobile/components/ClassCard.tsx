import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Badge } from './ui/Badge';
import type { ClassRecord, ClassStatus } from '../types/api.types';

const STATUS: Record<ClassStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  SCHEDULED:   { label: 'Scheduled', variant: 'info' },
  IN_PROGRESS: { label: 'Live',      variant: 'success' },
  COMPLETED:   { label: 'Done',      variant: 'neutral' },
  CANCELLED:   { label: 'Cancelled', variant: 'error' },
  NO_SHOW:     { label: 'No Show',   variant: 'warning' },
};

interface ClassCardProps {
  cls: ClassRecord;
  onPress?: () => void;
}

export function ClassCard({ cls, onPress }: ClassCardProps) {
  const start = parseISO(cls.scheduledStartUTC);
  const end = parseISO(cls.scheduledEndUTC);
  const badge = STATUS[cls.status] ?? { label: cls.status, variant: 'neutral' as const };
  const isLive = cls.status === 'IN_PROGRESS';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} className="mb-3">
      <View
        className="bg-white rounded-3xl p-4 flex-row items-center"
        style={{
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {/* Date block */}
        <View
          className="w-14 h-14 rounded-2xl items-center justify-center mr-3"
          style={{ backgroundColor: isLive ? '#D1FAE5' : '#EEF2FF' }}
        >
          <Text
            className="text-[10px] font-bold uppercase"
            style={{ color: isLive ? '#059669' : '#4F46E5' }}
          >
            {format(start, 'MMM')}
          </Text>
          <Text
            className="text-[20px] font-bold leading-none"
            style={{ color: isLive ? '#059669' : '#4F46E5' }}
          >
            {format(start, 'd')}
          </Text>
        </View>

        {/* Info */}
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-[15px] font-bold text-gray-900 flex-1" numberOfLines={1}>
              {cls.subject || 'Class'}
            </Text>
            <Badge label={badge.label} variant={badge.variant} />
          </View>
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={12} color="#64748B" />
            <Text className="text-xs text-gray-500 ml-1">
              {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
            </Text>
            <Text className="text-xs text-gray-300 mx-1.5">·</Text>
            <Text className="text-xs text-gray-500">
              {cls.classType.replace('_', ' ').toLowerCase()}
            </Text>
          </View>
        </View>

        {isLive && (
          <View className="ml-2 w-7 h-7 rounded-full bg-emerald-500 items-center justify-center">
            <Ionicons name="play" size={12} color="#fff" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
