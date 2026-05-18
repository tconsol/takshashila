import React from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { studentService } from '../services/student.service';
import { attendanceService } from '../services/attendance.service';
import type { AttendanceRecord, AttendanceStatus } from '../types/api.types';

const STATUS_VARIANT: Record<AttendanceStatus, 'success' | 'error' | 'warning' | 'neutral'> = {
  PRESENT: 'success',
  ABSENT:  'error',
  PARTIAL: 'warning',
  EXCUSED: 'neutral',
};

function AttendanceRow({ item }: { item: AttendanceRecord }) {
  const date = parseISO(item.createdAt);
  return (
    <View className="flex-row items-center py-3 border-b border-gray-50">
      <View className="w-11 h-11 bg-gray-50 rounded-2xl items-center justify-center">
        <Text className="text-[10px] font-bold text-gray-500 uppercase">
          {format(date, 'MMM')}
        </Text>
        <Text className="text-[15px] font-bold text-gray-900 leading-none">
          {format(date, 'd')}
        </Text>
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-sm font-semibold text-gray-900">
          {format(date, 'EEEE')}
        </Text>
        <View className="flex-row items-center mt-0.5">
          {item.durationMinutes != null && (
            <>
              <Ionicons name="time-outline" size={11} color="#94A3B8" />
              <Text className="text-xs text-gray-500 ml-1">{item.durationMinutes} min</Text>
            </>
          )}
          {item.remarks && (
            <Text className="text-xs text-gray-500 ml-2" numberOfLines={1}>· {item.remarks}</Text>
          )}
        </View>
      </View>
      <Badge label={item.status} variant={STATUS_VARIANT[item.status] ?? 'neutral'} />
    </View>
  );
}

export default function AttendanceScreen() {
  const { data: profile, isLoading: pLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentService.getMyProfile,
  });

  const { data: history, isLoading: hLoading, refetch, isRefetching } = useQuery({
    queryKey: ['attendance-history'],
    queryFn: () => attendanceService.getMyHistory({ limit: '100' }),
  });

  if (pLoading || hLoading) return <LoadingScreen />;

  const rate = Math.round(profile?.attendanceRate ?? 0);
  const rateColor = rate >= 75 ? '#059669' : rate >= 50 ? '#D97706' : '#E11D48';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <FlatList
        data={history?.items ?? []}
        keyExtractor={(item) => item.publicId}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
        ListHeaderComponent={
          <View className="mb-4">
            {/* Rate hero */}
            <Card className="mb-3">
              <Text className="text-xs text-gray-500 mb-1">Attendance rate</Text>
              <View className="flex-row items-end gap-2">
                <Text className="text-4xl font-bold" style={{ color: rateColor }}>
                  {rate}%
                </Text>
                <Text className="text-sm text-gray-500 mb-1.5">
                  {rate >= 75 ? 'On track' : rate >= 50 ? 'Needs improvement' : 'At risk'}
                </Text>
              </View>
              <ProgressBar value={rate} max={100} color={rateColor} height={10} className="mt-3" />
              <Text className="text-[11px] text-gray-400 mt-2">
                Goal: 75% minimum to stay in good standing
              </Text>
            </Card>

            {/* Stats */}
            <View className="flex-row gap-3 mb-3">
              <Card className="flex-1 items-center py-4">
                <Text className="text-2xl font-bold text-gray-900">{profile?.totalClassesAttended ?? 0}</Text>
                <Text className="text-xs text-gray-500 mt-0.5">Attended</Text>
              </Card>
              <Card className="flex-1 items-center py-4">
                <Text className="text-2xl font-bold text-rose-500">{profile?.totalClassesMissed ?? 0}</Text>
                <Text className="text-xs text-gray-500 mt-0.5">Missed</Text>
              </Card>
              <Card className="flex-1 items-center py-4">
                <Text className="text-2xl font-bold text-gray-900">{profile?.totalClassesBooked ?? 0}</Text>
                <Text className="text-xs text-gray-500 mt-0.5">Booked</Text>
              </Card>
            </View>

            <Text className="text-base font-bold text-gray-900 mt-3 mb-1 px-1">
              Recent attendance
            </Text>
          </View>
        }
        renderItem={({ item }) => <AttendanceRow item={item} />}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No attendance records"
            description="Your attendance will appear here after your classes."
          />
        }
      />
    </SafeAreaView>
  );
}
