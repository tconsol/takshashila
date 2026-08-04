import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { chatService, type Conversation } from '../../services/chat.service';
import { useAuthStore } from '../../stores/auth.store';

const AVATAR_COLORS = ['#6366F1', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899'];
function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function otherName(c: Conversation, myId?: string): string {
  const idx = c.participantPublicIds[0] === myId ? 1 : 0;
  return c.participantNames?.[idx] ?? c.participantRoles?.[idx] ?? 'Conversation';
}

export default function MessagesTab() {
  const myId = useAuthStore((s) => s.user?.publicId);
  const [q, setQ] = useState('');
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: chatService.getConversations,
    refetchInterval: 15000,
  });

  const items = useMemo(() => {
    const all = data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((c) => {
      const name = otherName(c, myId).toLowerCase();
      const preview = (c.lastMessagePreview ?? '').toLowerCase();
      return name.includes(needle) || preview.includes(needle);
    });
  }, [data, q, myId]);

  if (isLoading) return <LoadingScreen message="Loading messages..." />;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <Text className="text-[26px] font-extrabold text-gray-900">Messages</Text>
        <TouchableOpacity
          onPress={() => router.push('/tutors')}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary-500"
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View className="px-5 pb-2">
        <View className="flex-row items-center rounded-2xl bg-slate-100 px-3.5">
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search conversations"
            placeholderTextColor="#94A3B8"
            className="flex-1 py-2.5 px-2 text-[15px] text-slate-900"
            autoCapitalize="none"
            returnKeyType="search"
          />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => setQ('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(c) => c.publicId}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
        ListEmptyComponent={
          q.trim() ? (
            <EmptyState icon="search-outline" title="No matches" description={`No conversations match "${q.trim()}".`} />
          ) : (
            <EmptyState icon="chatbubbles-outline" title="No messages" description="Start a conversation with your tutor from their profile." />
          )
        }
        renderItem={({ item }) => {
          const name = otherName(item, myId);
          const unread = myId ? item.unreadCounts?.[myId] ?? 0 : 0;
          return (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/chat/[conversationId]', params: { conversationId: item.publicId, name } })}
              className="mb-1.5 flex-row items-center rounded-2xl bg-white p-3"
              activeOpacity={0.7}
            >
              <View className="mr-3 h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: colorFor(item.publicId) }}>
                <Text className="text-base font-bold text-white">{name.charAt(0).toUpperCase()}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-slate-900" numberOfLines={1}>{name}</Text>
                <Text className={`mt-0.5 text-xs ${unread > 0 ? 'font-semibold text-slate-700' : 'text-slate-400'}`} numberOfLines={1}>
                  {item.lastMessagePreview ?? 'Tap to chat'}
                </Text>
              </View>
              <View className="ml-2 items-end">
                {item.lastMessageAt && (
                  <Text className="text-[10px] text-slate-400">{formatDistanceToNowStrict(parseISO(item.lastMessageAt))}</Text>
                )}
                {unread > 0 && (
                  <View className="mt-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5">
                    <Text className="text-[10px] font-bold text-white">{unread}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
