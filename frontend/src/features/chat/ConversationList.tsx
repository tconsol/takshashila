import { timeAgo } from '../../utils/date';
import { useAuthStore } from '../../stores/auth.store';
import { Spinner } from '../../components/ui/Loading';
import { useConversations } from './use-chat';
import type { IConversation } from './chat.types';
import { MessageSquare } from 'lucide-react';

interface Props {
  selectedId: string | null;
  onSelect: (conv: IConversation) => void;
}

export function ConversationList({ selectedId, onSelect }: Props) {
  const { user } = useAuthStore();
  const { data: conversations = [], isLoading } = useConversations();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400 p-6">
        <MessageSquare className="h-10 w-10 opacity-30" />
        <p className="text-sm">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {conversations.map((conv) => {
        const unread = user ? ((conv.unreadCounts as Record<string, number>)[user.publicId] ?? 0) : 0;
        const isSelected = conv.publicId === selectedId;
        const otherRole = conv.participantRoles.find((_, i) => conv.participantPublicIds[i] !== user?.publicId) ?? '';

        return (
          <button
            key={conv.publicId}
            onClick={() => onSelect(conv)}
            className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
              isSelected ? 'bg-brand-50 dark:bg-brand-900/20 border-r-2 border-brand-600' : ''
            }`}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold dark:bg-brand-900/30 dark:text-brand-300">
              {otherRole.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-brand-600 dark:text-brand-400 capitalize">
                  {otherRole.toLowerCase().replace('_', ' ')}
                </span>
                {conv.lastMessageAt && (
                  <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
                    {timeAgo(conv.lastMessageAt)}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-0.5">
                {conv.lastMessagePreview ?? 'Start a conversation'}
              </p>
            </div>
            {unread > 0 && (
              <span className="flex-shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white px-1">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
