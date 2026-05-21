import React from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { parseISO, isAfter } from 'date-fns';
import { Avatar } from '../../components/ui/Avatar';
import { StatCard } from '../../components/ui/StatCard';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ClassCard } from '../../components/ClassCard';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/auth.store';
import { studentService } from '../../services/student.service';
import { classesService } from '../../services/classes.service';
import { walletService } from '../../services/wallet.service';
import { analyticsService } from '../../services/analytics.service';

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const now = new Date();

  const { data: profile } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentService.getMyProfile,
  });

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: walletService.getMyWallet,
  });

  const { data: stats } = useQuery({
    queryKey: ['student-analytics'],
    queryFn: analyticsService.getStudentMe,
  });

  const { data: classesData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-classes', 'home'],
    queryFn: () =>
      classesService.getMyAsStudent({ status: 'SCHEDULED,IN_PROGRESS', limit: '10', page: '1' }),
  });

  const liveClass = (classesData?.items ?? []).find((c) => c.status === 'IN_PROGRESS');
  const upcoming = (classesData?.items ?? [])
    .filter((c) => c.status === 'SCHEDULED' && isAfter(parseISO(c.scheduledStartUTC), now))
    .slice(0, 3);

  if (isLoading) return <LoadingScreen />;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
      >
        {/* Hero */}
        <View
          className="pb-8 pt-2"
          style={{ backgroundColor: '#6366F1', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          <View className="px-5 pt-3 flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-white/70 text-sm">{greeting()},</Text>
              <Text className="text-white text-2xl font-bold mt-0.5" numberOfLines={1}>
                {user?.firstName ?? 'Student'} 👋
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(student)/profile')}
              activeOpacity={0.7}
              className="ml-3"
            >
              <Avatar name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} size={44} />
            </TouchableOpacity>
          </View>

          {/* Wallet card overlay */}
          <View className="px-5 mt-5">
            <View
              className="rounded-3xl p-4 flex-row items-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <View className="w-11 h-11 rounded-2xl items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
                <Ionicons name="wallet-outline" size={22} color="#fff" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-white/70 text-xs">Wallet balance</Text>
                <Text className="text-white text-xl font-bold">
                  ₹{((wallet?.balanceCents ?? 0) / 100).toFixed(0)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(student)/wallet')}
                className="px-3 py-1.5 rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
                activeOpacity={0.7}
              >
                <Text className="text-white text-xs font-bold">View</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Live class banner */}
        {liveClass && (
          <View className="px-5 -mt-4">
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push(`/class/${liveClass.publicId}`)}
              className="bg-emerald-500 rounded-3xl p-4 flex-row items-center"
              style={{
                shadowColor: '#10B981',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <View className="w-11 h-11 rounded-2xl items-center justify-center bg-white/25">
                <Ionicons name="videocam" size={22} color="#fff" />
              </View>
              <View className="flex-1 ml-3">
                <View className="flex-row items-center">
                  <View className="w-1.5 h-1.5 rounded-full bg-white mr-1.5" />
                  <Text className="text-white text-[11px] font-bold uppercase tracking-wide">Live Now</Text>
                </View>
                <Text className="text-white font-bold text-[15px] mt-0.5" numberOfLines={1}>
                  {liveClass.subject}
                </Text>
              </View>
              <View className="px-3 py-1.5 rounded-full bg-white">
                <Text className="text-emerald-600 text-xs font-bold">Join</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats */}
        <View className="px-5 mt-6">
          <View className="flex-row gap-3 mb-3">
            <StatCard
              label="Classes attended"
              value={profile?.totalClassesAttended ?? stats?.completed ?? 0}
              icon="checkmark-circle"
              tint="indigo"
            />
            <StatCard
              label="Attendance rate"
              value={`${Math.round(profile?.attendanceRate ?? stats?.attendanceRate ?? 0)}%`}
              icon="trending-up"
              tint="emerald"
            />
          </View>
          <View className="flex-row gap-3">
            <StatCard
              label="Upcoming"
              value={stats?.upcoming ?? upcoming.length}
              icon="calendar"
              tint="sky"
            />
            <StatCard
              label="Submissions"
              value={stats?.submissions ?? 0}
              icon="document-text"
              tint="violet"
            />
          </View>
        </View>

        {/* Quick actions */}
        <View className="px-5 mt-6">
          <SectionHeader title="Quick actions" />
          <View className="flex-row gap-3">
            <QuickTile icon="add-circle" label="Book Class" tint="indigo" onPress={() => router.push('/tutors')} />
            <QuickTile icon="library" label="Study" tint="violet" onPress={() => router.push('/(student)/schedule')} />
            <QuickTile icon="person-circle" label="My Tutor" tint="emerald" onPress={() => router.push('/my-tutor')} />
            <QuickTile icon="stats-chart" label="Progress" tint="amber" onPress={() => router.push('/attendance')} />
          </View>
        </View>

        {/* Upcoming */}
        <View className="px-5 mt-6">
          <SectionHeader
            title="Upcoming classes"
            actionLabel="See all"
            onActionPress={() => router.push('/(student)/classes')}
          />
          {upcoming.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No upcoming classes"
              description="Book a class with a tutor to get started"
              action={
                <Button size="sm" onPress={() => router.push('/tutors')}>
                  Book a class
                </Button>
              }
            />
          ) : (
            upcoming.map((cls) => (
              <ClassCard
                key={cls.publicId}
                cls={cls}
                onPress={() => router.push(`/class/${cls.publicId}`)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickTile({
  icon, label, tint, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: 'indigo' | 'emerald' | 'rose' | 'amber' | 'violet';
  onPress: () => void;
}) {
  const colors = {
    indigo:  { bg: '#EEF2FF', fg: '#4F46E5' },
    emerald: { bg: '#D1FAE5', fg: '#059669' },
    rose:    { bg: '#FFE4E6', fg: '#E11D48' },
    amber:   { bg: '#FEF3C7', fg: '#D97706' },
    violet:  { bg: '#F3E8FF', fg: '#9333EA' },
  }[tint];
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} className="flex-1 items-center">
      <View
        className="w-14 h-14 rounded-2xl items-center justify-center mb-1.5"
        style={{ backgroundColor: colors.bg }}
      >
        <Ionicons name={icon} size={24} color={colors.fg} />
      </View>
      <Text className="text-[11px] font-semibold text-gray-700 text-center">{label}</Text>
    </TouchableOpacity>
  );
}
