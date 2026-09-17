import React from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { worksheetsService } from '../../services/worksheets.service';

export default function HomeworkTab() {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['worksheets', 'student'],
    queryFn: () => worksheetsService.getMyAsStudent({ limit: '100' }),
  });
  const items = data?.items ?? [];

  if (isLoading) return <LoadingScreen message="Loading homework..." />;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-5 py-4">
        <Text className="text-2xl font-bold text-gray-900">Homework</Text>
        <Text className="mt-0.5 text-sm text-gray-500">Worksheets & assignments</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(w) => w.publicId}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
        ListEmptyComponent={<EmptyState icon="document-text-outline" title="No homework yet" description="Assignments and worksheets from your tutor appear here." />}
        renderItem={({ item }) => {
          const done = !!item.mySubmission;
          return (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/worksheet/[worksheetId]', params: { worksheetId: item.publicId } })}
              className="mb-3 flex-row items-center rounded-2xl border border-slate-100 bg-white p-4"
            >
              <View className={`mr-3 h-11 w-11 items-center justify-center rounded-xl ${done ? 'bg-emerald-50' : 'bg-indigo-50'}`}>
                <Ionicons name={done ? 'checkmark-done' : 'document-text'} size={20} color={done ? '#059669' : '#6366F1'} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>{item.title}</Text>
                <Text className="mt-0.5 text-xs text-slate-400">
                  {item.type === 'ASSIGNMENT' ? 'Assignment' : 'Worksheet'} · {item.questionCount} questions
                  {item.dueDate ? ` · due ${format(parseISO(item.dueDate), 'MMM d')}` : ''}
                </Text>
              </View>
              {done ? (
                <Text className="text-xs font-bold text-emerald-600">{item.mySubmission?.scorePercent}%</Text>
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
