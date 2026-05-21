import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { tutorsService } from '../services/tutors.service';
import type { TutorProfile } from '../types/api.types';

function TutorCard({ tutor }: { tutor: TutorProfile }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/tutor/[tutorId]', params: { tutorId: tutor.publicId } })}
      className="mb-3"
    >
      <Card>
        <View className="flex-row">
          <Avatar name={tutor.displayName} size={52} />
          <View className="flex-1 ml-3">
            <View className="flex-row items-center gap-1">
              <Text className="text-[15px] font-bold text-gray-900 flex-1" numberOfLines={1}>
                {tutor.displayName}
              </Text>
              {tutor.isVerified && (
                <Ionicons name="checkmark-circle" size={16} color="#0284C7" />
              )}
            </View>
            <View className="flex-row items-center mt-1">
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text className="text-xs font-semibold text-gray-700 ml-1">
                {tutor.rating?.toFixed(1) ?? 'New'}
              </Text>
              <Text className="text-xs text-gray-300 mx-1.5">·</Text>
              <Text className="text-xs text-gray-500">{tutor.totalStudents ?? 0} students</Text>
              <Text className="text-xs text-gray-300 mx-1.5">·</Text>
              <Text className="text-xs text-gray-500">{tutor.totalClassesCompleted ?? 0} classes</Text>
            </View>
            {tutor.bio && (
              <Text className="text-xs text-gray-500 mt-1.5" numberOfLines={2}>
                {tutor.bio}
              </Text>
            )}
            {tutor.subjects?.length > 0 && (
              <View className="flex-row flex-wrap gap-1 mt-2">
                {tutor.subjects.slice(0, 3).map((s) => (
                  <View key={s} className="bg-primary-50 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-semibold text-primary-600">{s}</Text>
                  </View>
                ))}
                {tutor.subjects.length > 3 && (
                  <Text className="text-[10px] text-gray-500 self-center ml-1">
                    +{tutor.subjects.length - 3} more
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
        <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <Text className="text-xs text-gray-500">Hourly rate</Text>
          <Text className="text-base font-bold text-primary-600">
            ₹{((tutor.hourlyRateCents ?? 0) / 100).toFixed(0)}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function TutorsScreen() {
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['tutors-search'],
    queryFn: () => tutorsService.search({ limit: '30' }),
  });

  const all = data?.items ?? [];
  const filtered = search.trim()
    ? all.filter((t) =>
        (t.displayName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.subjects ?? []).some((s) => s.toLowerCase().includes(search.toLowerCase())),
      )
    : all;

  if (isLoading) return <LoadingScreen />;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="px-5 pt-3 pb-3">
        <View className="flex-row items-center bg-white rounded-2xl px-3 border border-gray-100">
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            className="flex-1 py-3 px-2 text-base text-gray-900"
            placeholder="Search by name or subject..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.publicId}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
        renderItem={({ item }) => <TutorCard tutor={item} />}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title={search ? 'No tutors match your search' : 'No tutors available'}
            description={search ? 'Try a different name or subject' : 'Check back later for more tutors'}
          />
        }
      />
    </SafeAreaView>
  );
}
