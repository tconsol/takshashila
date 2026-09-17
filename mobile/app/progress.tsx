import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { analyticsService } from '../services/analytics.service';

function StatCard({ icon, label, value, tint }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string; tint: { bg: string; fg: string };
}) {
  return (
    <View className="mb-3 w-[48%] rounded-2xl border border-slate-100 bg-white p-4">
      <View className="mb-2 h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: tint.bg }}>
        <Ionicons name={icon} size={20} color={tint.fg} />
      </View>
      <Text className="text-2xl font-extrabold text-slate-900">{value}</Text>
      <Text className="mt-0.5 text-xs text-slate-400">{label}</Text>
    </View>
  );
}

export default function ProgressScreen() {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['analytics', 'student', 'me'],
    queryFn: analyticsService.getStudentMe,
  });

  if (isLoading) return <LoadingScreen message="Loading progress..." />;
  const s = data ?? { upcoming: 0, completed: 0, submissions: 0, attendanceRate: 0 };
  const rate = Math.round(s.attendanceRate ?? 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
      >
        {/* Attendance hero */}
        <View className="mb-5 rounded-3xl bg-indigo-600 p-6">
          <Text className="text-xs font-semibold uppercase tracking-wide text-white/70">Attendance rate</Text>
          <Text className="mt-2 text-5xl font-extrabold text-white">{rate}%</Text>
          <View className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
            <View className="h-2.5 rounded-full bg-white" style={{ width: `${Math.min(rate, 100)}%` }} />
          </View>
          <Text className="mt-2 text-xs text-white/70">
            {rate >= 75 ? 'Great — keep it up! 🏆' : 'Aim for 75% to stay on track'}
          </Text>
        </View>

        <View className="flex-row flex-wrap justify-between">
          <StatCard icon="videocam" label="Upcoming classes" value={String(s.upcoming ?? 0)} tint={{ bg: '#EEF2FF', fg: '#6366F1' }} />
          <StatCard icon="checkmark-done" label="Completed" value={String(s.completed ?? 0)} tint={{ bg: '#D1FAE5', fg: '#059669' }} />
          <StatCard icon="document-text" label="Submissions" value={String(s.submissions ?? 0)} tint={{ bg: '#FFEDD5', fg: '#EA580C' }} />
          <StatCard icon="flame" label="Streak (days)" value={String(s.streakDays ?? 0)} tint={{ bg: '#FEF3C7', fg: '#D97706' }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
