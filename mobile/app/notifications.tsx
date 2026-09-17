import React from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { notificationsService, type AppNotification } from '../services/notifications.service';

function iconFor(type: string): keyof typeof Ionicons.glyphMap {
  const t = type.toUpperCase();
  if (t.includes('CLASS')) return 'videocam';
  if (t.includes('WORKSHEET') || t.includes('ASSIGNMENT')) return 'document-text';
  if (t.includes('DEMO')) return 'sparkles';
  if (t.includes('WALLET') || t.includes('PAYMENT') || t.includes('CREDIT')) return 'wallet';
  if (t.includes('MESSAGE') || t.includes('CHAT')) return 'chatbubble';
  return 'notifications';
}

export default function NotificationsScreen() {
  const qc = useQueryClient();
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsService.getMine({ limit: '100' }),
  });
  const items = data ?? [];
  const hasUnread = items.some((n) => !n.isRead);

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAll = useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (isLoading) return <LoadingScreen message="Loading notifications..." />;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          headerRight: () =>
            hasUnread ? (
              <TouchableOpacity onPress={() => markAll.mutate()} className="pr-1">
                <Text className="text-sm font-semibold text-indigo-600">Mark all read</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(n: AppNotification) => n.publicId}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
        ListEmptyComponent={<EmptyState icon="notifications-outline" title="No notifications" description="You're all caught up." />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => !item.isRead && markRead.mutate(item.publicId)}
            className={`mb-2 flex-row rounded-2xl p-3.5 ${item.isRead ? 'bg-white' : 'bg-indigo-50'}`}
          >
            <View className={`mr-3 h-11 w-11 items-center justify-center rounded-full ${item.isRead ? 'bg-slate-100' : 'bg-indigo-100'}`}>
              <Ionicons name={iconFor(item.type)} size={20} color={item.isRead ? '#64748B' : '#6366F1'} />
            </View>
            <View className="flex-1">
              <Text className={`text-sm ${item.isRead ? 'font-medium text-slate-800' : 'font-bold text-slate-900'}`}>{item.title}</Text>
              {!!item.body && <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={2}>{item.body}</Text>}
              <Text className="mt-1 text-[10px] text-slate-400">{formatDistanceToNowStrict(parseISO(item.createdAt))} ago</Text>
            </View>
            {!item.isRead && <View className="ml-2 mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
