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

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
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
    <div className="overflow-y-auto flex-1">
      {conversations.map((conv) => {
        const unread = user ? ((conv.unreadCounts as Record<string, number>)[user.publicId] ?? 0) : 0;
        const isSelected = conv.publicId === selectedId;

        const otherIdx = conv.participantPublicIds.findIndex((id) => id !== user?.publicId);
        const otherName = conv.participantNames?.[otherIdx] ?? '';
        const otherRole = conv.participantRoles[otherIdx] ?? '';
        const displayName = otherName || otherRole.toLowerCase().replace('_', ' ');
        const initials = getInitials(displayName);

        return (
          <button
            key={conv.publicId}
            onClick={() => onSelect(conv)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
              isSelected ? 'bg-brand-50 dark:bg-brand-900/20 border-r-2 border-brand-600' : ''
            }`}
          >
            {/* Avatar with red dot when unread */}
            <div className="relative flex-shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold dark:bg-brand-900/30 dark:text-brand-300">
                {initials}
              </div>
              {unread > 0 && !isSelected && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-gray-900" />
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className={`text-sm truncate ${unread > 0 && !isSelected ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-900 dark:text-white'}`}>
                  {otherName || <span className="capitalize text-gray-500">{otherRole.toLowerCase().replace('_', ' ')}</span>}
                </span>
                {conv.lastMessageAt && (
                  <span className={`text-[10px] flex-shrink-0 ${unread > 0 && !isSelected ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                    {timeAgo(conv.lastMessageAt)}
                  </span>
                )}
              </div>
              {otherRole && (
                <p className="text-[11px] text-brand-500 dark:text-brand-400 capitalize leading-none mt-0.5">
                  {otherRole.toLowerCase().replace('_', ' ')}
                </p>
              )}
              <p className={`text-xs truncate mt-0.5 ${unread > 0 && !isSelected ? 'font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                {conv.lastMessagePreview ?? 'Start a conversation'}
              </p>
            </div>

            {unread > 0 && !isSelected && (
              <span className="flex-shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
