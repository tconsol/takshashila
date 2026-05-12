import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import type { IConversation, IMessage } from './chat.types';
import type { PaginatedResult } from '../../shared/types';

const chatKeys = {
  conversations: () => ['chat', 'conversations'] as const,
  messages: (id: string) => ['chat', 'messages', id] as const,
  unread: () => ['chat', 'unread'] as const,
};

export function useConversations() {
  return useQuery<IConversation[]>({
    queryKey: chatKeys.conversations(),
    queryFn: async () => {
      const { data } = await api.get('/chat/conversations');
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function useChatUnreadCount() {
  return useQuery<number>({
    queryKey: chatKeys.unread(),
    queryFn: async () => {
      const { data } = await api.get('/chat/conversations/unread-count');
      return data.count;
    },
    refetchInterval: 30_000,
  });
}

export function useMessages(conversationPublicId: string | null) {
  return useInfiniteQuery<PaginatedResult<IMessage>>({
    queryKey: chatKeys.messages(conversationPublicId ?? ''),
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get(`/chat/conversations/${conversationPublicId}/messages`, {
        params: { page: pageParam, limit: 30 },
      });
      return data;
    },
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!conversationPublicId,
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { recipientPublicId: string; recipientRole: string }) => {
      const { data } = await api.post('/chat/conversations', payload);
      return data as IConversation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.conversations() }),
  });
}

export function useSendMessage(conversationPublicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data } = await api.post(`/chat/conversations/${conversationPublicId}/messages`, { body });
      return data as IMessage;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.messages(conversationPublicId) }),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationPublicId: string) =>
      api.patch(`/chat/conversations/${conversationPublicId}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
      qc.invalidateQueries({ queryKey: chatKeys.unread() });
    },
  });
}

export function useInvalidateChat() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ['chat'] });
  }, [qc]);
}
