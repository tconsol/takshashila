import React from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { ListItem } from '../../components/ui/ListItem';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { useAuthStore } from '../../stores/auth.store';
import { studentService } from '../../services/student.service';
import { authService } from '../../services/auth.service';

export default function MoreScreen() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentService.getMyProfile,
  });

  async function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try { await authService.logout(); } catch { /* ignore */ }
          await clearAuth();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  if (isLoading) return <LoadingScreen />;

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : profile?.displayName ?? 'Student';

  const statusVariant =
    profile?.status === 'ACTIVE' ? 'success'
    : profile?.status === 'INVITED' ? 'warning'
    : 'neutral';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile header */}
        <View
          className="pb-8 pt-6"
          style={{ backgroundColor: '#6366F1', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          <View className="items-center px-5">
            <Avatar name={displayName} size={88} />
            <Text className="text-white text-xl font-bold mt-3">{displayName}</Text>
            <Text className="text-white/70 text-sm mt-0.5">{user?.email}</Text>
            <View className="mt-2">
              <Badge label={profile?.status ?? 'STUDENT'} variant={statusVariant} />
            </View>
          </View>
        </View>

        {/* Stats overview */}
        <View className="px-5 -mt-5">
          <Card className="flex-row px-0 py-2">
            <View className="flex-1 items-center py-2">
              <Text className="text-xl font-bold text-gray-900">{profile?.totalClassesAttended ?? 0}</Text>
              <Text className="text-[11px] text-gray-500 mt-0.5">Attended</Text>
            </View>
            <View className="w-px bg-gray-100 my-3" />
            <View className="flex-1 items-center py-2">
              <Text className="text-xl font-bold text-gray-900">{Math.round(profile?.attendanceRate ?? 0)}%</Text>
              <Text className="text-[11px] text-gray-500 mt-0.5">Attendance</Text>
            </View>
            <View className="w-px bg-gray-100 my-3" />
            <View className="flex-1 items-center py-2">
              <Text className="text-xl font-bold text-gray-900">{profile?.demoClassesUsed ?? 0}/3</Text>
              <Text className="text-[11px] text-gray-500 mt-0.5">Demo used</Text>
            </View>
          </Card>
        </View>

        {/* Account section */}
        <Section title="Account">
          <ListItem
            icon="person-circle-outline"
            iconTint="indigo"
            title="My Tutor"
            subtitle={profile?.tutorPublicId ? 'View your tutor profile' : 'No tutor connected'}
            onPress={() => router.push('/my-tutor')}
          />
          <Divider />
          <ListItem
            icon="bar-chart-outline"
            iconTint="emerald"
            title="Attendance"
            subtitle="View your attendance history"
            onPress={() => router.push('/attendance')}
          />
          <Divider />
          <ListItem
            icon="search-outline"
            iconTint="violet"
            title="Browse Tutors"
            subtitle="Find a new tutor and book classes"
            onPress={() => router.push('/tutors')}
          />
        </Section>

        {/* Profile details */}
        <Section title="Profile">
          <DetailRow icon="mail-outline" label="Email" value={user?.email} />
          <Divider />
          <DetailRow icon="call-outline" label="Phone" value={user?.phone} />
          <Divider />
          <DetailRow icon="school-outline" label="Grade" value={profile?.grade ?? 'Not set'} />
          <Divider />
          <DetailRow icon="globe-outline" label="Timezone" value={user?.timezone} />
        </Section>

        {/* Subjects */}
        {profile?.subjects && profile.subjects.length > 0 && (
          <View className="px-5 mt-4">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
              Subjects
            </Text>
            <Card>
              <View className="flex-row flex-wrap gap-2">
                {profile.subjects.map((s) => (
                  <Badge key={s} label={s} variant="info" />
                ))}
              </View>
            </Card>
          </View>
        )}

        {/* Logout */}
        <View className="px-5 mt-4">
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.7}
            className="bg-white rounded-3xl py-4 flex-row items-center justify-center"
            style={{
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#E11D48" />
            <Text className="text-rose-500 font-bold ml-2">Sign out</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-center text-[11px] text-gray-400 mt-6">
          Takshashila Student · v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="px-5 mt-4">
      <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
        {title}
      </Text>
      <View
        className="bg-white rounded-3xl overflow-hidden"
        style={{
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-gray-50 ml-16" />;
}

function DetailRow({ icon, label, value }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value?: string;
}) {
  return (
    <View className="flex-row items-center px-4 py-3.5">
      <View className="w-10 h-10 rounded-2xl bg-gray-50 items-center justify-center">
        <Ionicons name={icon} size={18} color="#64748B" />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[11px] text-gray-500">{label}</Text>
        <Text className="text-sm text-gray-900 mt-0.5" numberOfLines={1}>
          {value || '—'}
        </Text>
      </View>
    </View>
  );
}
