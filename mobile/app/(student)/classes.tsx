import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ClassCard } from '../../components/ClassCard';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { classesService } from '../../services/classes.service';
import type { ClassRecord, ClassStatus } from '../../types/api.types';

type FilterTab = 'upcoming' | 'live' | 'completed' | 'cancelled';

const FILTERS: { key: FilterTab; label: string; statuses: ClassStatus[] }[] = [
  { key: 'upcoming',  label: 'Upcoming',  statuses: ['SCHEDULED'] },
  { key: 'live',      label: 'Live',      statuses: ['LIVE', 'IN_PROGRESS'] },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED', 'MISSED', 'NO_SHOW', 'FAILED'] },
];

function toRoom(classId: string) {
  router.push(`/room/${classId}` as Href);
}

export default function ClassesScreen() {
  const [filter, setFilter] = useState<FilterTab>('upcoming');
  const active = FILTERS.find((f) => f.key === filter)!;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-classes', filter],
    queryFn: () =>
      classesService.getMyAsStudent({ status: active.statuses.join(','), limit: '50', page: '1' }),
  });

  // Live banner: query live independently so it shows on any tab.
  const { data: liveData } = useQuery({
    queryKey: ['my-classes', 'live-banner'],
    queryFn: () => classesService.getMyAsStudent({ status: 'LIVE,IN_PROGRESS', limit: '5', page: '1' }),
    refetchInterval: 30000,
  });

  const classes = data?.items ?? [];
  const liveClasses = liveData?.items ?? [];
  const liveCount = liveClasses.length;
  const nextLive: ClassRecord | undefined = liveClasses[0];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-[26px] font-extrabold text-gray-900">Classes</Text>
          <Text className="text-sm text-gray-500 mt-0.5">
            {data?.total ?? 0} {active.label.toLowerCase()}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/tutors')}
          className="flex-row items-center gap-1.5 rounded-2xl bg-primary-500 px-3.5 h-11"
          activeOpacity={0.85}
          style={{ shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text className="text-sm font-bold text-white">Book</Text>
        </TouchableOpacity>
      </View>

      {/* Live banner */}
      {nextLive && (
        <TouchableOpacity
          onPress={() => toRoom(nextLive.publicId)}
          activeOpacity={0.9}
          className="mx-5 mt-1 mb-2 rounded-3xl p-4 flex-row items-center"
          style={{ backgroundColor: '#059669', shadowColor: '#059669', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }}
        >
          <View className="h-12 w-12 rounded-2xl items-center justify-center mr-3" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <Ionicons name="videocam" size={24} color="#fff" />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <View className="h-2 w-2 rounded-full bg-white" />
              <Text className="text-[11px] font-bold text-white uppercase tracking-wide">
                Live now{liveCount > 1 ? ` · ${liveCount}` : ''}
              </Text>
            </View>
            <Text className="text-base font-bold text-white mt-0.5" numberOfLines={1}>
              {nextLive.subject || 'Your class'}
            </Text>
            <Text className="text-xs text-white/80" numberOfLines={1}>
              {format(parseISO(nextLive.scheduledStartUTC), 'h:mm a')} · tap to join
            </Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={30} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Segmented filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 8, alignItems: 'center' }}
      >
        {FILTERS.map((f) => {
          const selected = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
              className="flex-row items-center gap-1.5 rounded-full px-4 py-2"
              style={{ alignSelf: 'center', backgroundColor: selected ? '#111827' : '#F1F5F9' }}
            >
              <Text className="text-sm font-semibold" style={{ color: selected ? '#fff' : '#475569' }}>
                {f.label}
              </Text>
              {f.key === 'live' && liveCount > 0 && (
                <View className="h-5 min-w-[20px] items-center justify-center rounded-full px-1" style={{ backgroundColor: '#10B981' }}>
                  <Text className="text-[10px] font-bold text-white">{liveCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <LoadingScreen />
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.publicId}
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4, flexGrow: 1, justifyContent: classes.length ? 'flex-start' : 'center' }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
          renderItem={({ item }) => (
            <ClassCard
              cls={item}
              onPress={() => router.push({ pathname: '/class/[classId]', params: { classId: item.publicId } })}
              onJoin={toRoom}
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
                filter === 'upcoming' ? 'No upcoming classes'
                : filter === 'live' ? 'No live classes right now'
                : filter === 'completed' ? 'No completed classes yet'
                : 'No cancelled classes'
              }
              description={
                filter === 'upcoming'
                  ? 'Book a class with a tutor to get started.'
                  : 'Check back later for updates.'
              }
              action={
                filter === 'upcoming' ? (
                  <Button onPress={() => router.push('/tutors')}>Book a class</Button>
                ) : undefined
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
