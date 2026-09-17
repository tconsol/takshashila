import React from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { parentRequestsService } from '../services/parent.service';

export default function ParentRequestsScreen() {
  const qc = useQueryClient();
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['parent-requests'],
    queryFn: parentRequestsService.getMine,
  });

  const approve = useMutation({
    mutationFn: parentRequestsService.approve,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['parent-requests'] }); },
    onError: () => Alert.alert('Error', 'Could not approve the request.'),
  });
  const reject = useMutation({
    mutationFn: parentRequestsService.reject,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['parent-requests'] }); },
    onError: () => Alert.alert('Error', 'Could not decline the request.'),
  });

  const pending = (data ?? []).filter((r) => r.status === 'PENDING' || !r.status);

  if (isLoading) return <LoadingScreen message="Loading..." />;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <FlatList
        data={pending}
        keyExtractor={(r) => r.publicId}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No requests" description="Parent link requests appear here." />}
        renderItem={({ item }) => (
          <View className="mb-3 rounded-2xl border border-slate-100 bg-white p-4">
            <View className="flex-row items-center">
              <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-violet-100">
                <Ionicons name="person" size={20} color="#7C3AED" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900">{item.parentName ?? 'A parent'}</Text>
                <Text className="text-xs text-slate-400">{item.parentEmail ?? 'wants to link to your account'}</Text>
              </View>
            </View>
            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                onPress={() => reject.mutate(item.publicId)}
                disabled={reject.isPending}
                className="flex-1 rounded-xl border border-slate-200 py-2.5"
              >
                <Text className="text-center text-sm font-semibold text-slate-600">Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => approve.mutate(item.publicId)}
                disabled={approve.isPending}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5"
              >
                <Text className="text-center text-sm font-bold text-white">Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
