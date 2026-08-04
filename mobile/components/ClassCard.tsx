import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import type { ClassRecord, ClassStatus } from '../types/api.types';

const STATUS: Record<ClassStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  SCHEDULED:   { label: 'Scheduled', variant: 'info' },
  LIVE:        { label: 'Live',      variant: 'success' },
  IN_PROGRESS: { label: 'Live',      variant: 'success' },
  COMPLETED:   { label: 'Done',      variant: 'neutral' },
  CANCELLED:   { label: 'Cancelled', variant: 'error' },
  MISSED:      { label: 'Missed',    variant: 'warning' },
  NO_SHOW:     { label: 'No Show',   variant: 'warning' },
  RESCHEDULED: { label: 'Moved',     variant: 'info' },
  FAILED:      { label: 'Failed',    variant: 'error' },
};

interface ClassCardProps {
  cls: ClassRecord;
  onPress?: () => void;
  onJoin?: (classId: string) => void;
}

export function ClassCard({ cls, onPress, onJoin }: ClassCardProps) {
  const start = parseISO(cls.scheduledStartUTC);
  const end = parseISO(cls.scheduledEndUTC);
  const badge = STATUS[cls.status] ?? { label: cls.status, variant: 'neutral' as const };
  const isLive = cls.status === 'LIVE' || cls.status === 'IN_PROGRESS';
  const isUpcoming = cls.status === 'SCHEDULED';
  // Joinable while live OR within 15 min of the scheduled start.
  const canJoin = isLive || (isUpcoming && differenceInMinutes(start, new Date()) <= 15);

  const handleJoin = () => {
    if (onJoin) {
      onJoin(cls.publicId);
    }
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} className="mb-3">
      <View
        className="bg-white rounded-3xl p-4"
        style={{
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View className="flex-row items-start">
          {/* Date block */}
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center mr-3 flex-shrink-0"
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
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-[15px] font-bold text-gray-900 flex-1" numberOfLines={1}>
                {cls.subject || 'Class'}
              </Text>
              <Badge label={badge.label} variant={badge.variant} />
            </View>
            <View className="flex-row items-center mb-2">
              <Ionicons name="time-outline" size={12} color="#64748B" />
              <Text className="text-xs text-gray-500 ml-1">
                {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
              </Text>
              <Text className="text-xs text-gray-300 mx-1.5">·</Text>
              <Text className="text-xs text-gray-500">
                {cls.classType.replace('_', ' ').toLowerCase()}
              </Text>
            </View>
            {cls.notes && (
              <Text className="text-xs text-gray-500 line-clamp-1">{cls.notes}</Text>
            )}
          </View>

          {/* Actions */}
          <View className="ml-2 items-center justify-center">
            {canJoin && !isLive ? (
              <Button variant="primary" size="sm" onPress={handleJoin} className="min-w-[76px]">
                Join
              </Button>
            ) : isUpcoming ? (
              <View className="w-8 h-8 rounded-full bg-primary-50 items-center justify-center">
                <Ionicons name="calendar-outline" size={16} color="#6366F1" />
              </View>
            ) : null}
          </View>
        </View>

        {/* Full-width join button for live classes (prominent) */}
        {isLive && (
          <TouchableOpacity
            onPress={handleJoin}
            className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-2.5"
          >
            <Ionicons name="videocam" size={18} color="#fff" />
            <Text className="font-bold text-white">Join live class</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}
