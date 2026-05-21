import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '../../components/ui/Chip';
import { ClassCard } from '../../components/ClassCard';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { classesService } from '../../services/classes.service';
import type { ClassStatus } from '../../types/api.types';

type FilterTab = 'upcoming' | 'live' | 'completed' | 'cancelled';

const FILTERS: { key: FilterTab; label: string; statuses: ClassStatus[] }[] = [
  { key: 'upcoming',  label: 'Upcoming',  statuses: ['SCHEDULED'] },
  { key: 'live',      label: 'Live',      statuses: ['IN_PROGRESS'] },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED', 'NO_SHOW'] },
];

export default function ClassesScreen() {
  const [filter, setFilter] = useState<FilterTab>('upcoming');
  const active = FILTERS.find((f) => f.key === filter)!;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-classes', filter],
    queryFn: () =>
      classesService.getMyAsStudent({
        status: active.statuses.join(','),
        limit: '50',
        page: '1',
      }),
  });

  const classes = data?.items ?? [];
  const liveCount = (data?.items ?? []).filter((c) => c.status === 'IN_PROGRESS').length;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-1 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-gray-900">My Classes</Text>
          <Text className="text-sm text-gray-500 mt-0.5">
            {data?.total ?? 0} class{(data?.total ?? 0) !== 1 ? 'es' : ''} in {active.label.toLowerCase()}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/tutors')}
          className="w-11 h-11 rounded-2xl bg-primary-500 items-center justify-center"
          activeOpacity={0.85}
          style={{
            shadowColor: '#6366F1',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <View key={f.key} className="relative">
            <Chip
              label={f.label}
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
            {f.key === 'live' && liveCount > 0 && (
              <View className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full items-center justify-center">
                <Text className="text-[10px] font-bold text-white">{liveCount}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {isLoading ? (
        <LoadingScreen />
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.publicId}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
          renderItem={({ item }) => (
            <ClassCard
              cls={item}
              onPress={() => router.push({ pathname: '/class/[classId]', params: { classId: item.publicId } })}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={
                filter === 'live' ? 'videocam-outline'
                : filter === 'completed' ? 'checkmark-done-outline'
                : filter === 'cancelled' ? 'close-circle-outline'
                : 'calendar-outline'
              }
              title={
                filter === 'upcoming' ? "No upcoming classes"
                : filter === 'live' ? "No live classes right now"
                : filter === 'completed' ? "No completed classes yet"
                : "No cancelled classes"
              }
              description={
                filter === 'upcoming'
                  ? 'Book a class with a tutor to get started.'
                  : 'Check back later for updates.'
              }
              action={
                filter === 'upcoming' ? (
                  <Button onPress={() => router.push('/tutors')}>
                    Book a class
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
