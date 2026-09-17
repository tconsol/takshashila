import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { studentService } from '../services/student.service';

export default function OrganizationScreen() {
  const { data: principal, isLoading } = useQuery({
    queryKey: ['students', 'me', 'principal'],
    queryFn: studentService.getMyPrincipal,
  });

  if (isLoading) return <LoadingScreen message="Loading..." />;

  if (!principal) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState icon="business-outline" title="No organization" description="You're not linked to an institution yet." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View className="items-center rounded-3xl bg-violet-600 p-7">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
            <Ionicons name="business" size={30} color="#fff" />
          </View>
          <Text className="mt-3 text-center text-xl font-extrabold text-white">
            {principal.organizationName ?? 'Institution'}
          </Text>
        </View>

        <View className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
          <Row icon="person-outline" label="Principal" value={`${principal.firstName} ${principal.lastName}`.trim()} />
          {principal.email ? <Row icon="mail-outline" label="Email" value={principal.email} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View className="flex-row items-center py-2.5">
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-slate-50">
        <Ionicons name={icon} size={18} color="#64748B" />
      </View>
      <View className="flex-1">
        <Text className="text-[11px] text-slate-400">{label}</Text>
        <Text className="mt-0.5 text-sm font-medium text-slate-900">{value}</Text>
      </View>
    </View>
  );
}
