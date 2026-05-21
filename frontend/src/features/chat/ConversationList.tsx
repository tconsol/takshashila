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
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-clay-mint shadow-clay-sm">
          <MessageSquare className="h-6 w-6 text-clay-ink" />
        </div>
        <p className="text-sm font-extrabold text-clay-ink">No conversations yet</p>
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
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-dashed border-clay-ink/10 ${
              isSelected ? 'bg-clay-mint border-l-4 border-l-clay-ink' : 'hover:bg-clay-bg'
            }`}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-clay-ink bg-clay-purple text-sm font-extrabold text-clay-ink">
                {initials}
              </div>
              {unread > 0 && !isSelected && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-clay-ink" />
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className={`text-sm truncate ${unread > 0 && !isSelected ? 'font-extrabold text-clay-ink' : 'font-bold text-clay-ink'}`}>
                  {otherName || <span className="capitalize text-clay-ink/60">{otherRole.toLowerCase().replace('_', ' ')}</span>}
                </span>
                {conv.lastMessageAt && (
                  <span className={`text-[10px] font-bold flex-shrink-0 ${unread > 0 && !isSelected ? 'text-rose-500' : 'text-clay-ink/40'}`}>
                    {timeAgo(conv.lastMessageAt)}
                  </span>
                )}
              </div>
              {otherRole && (
                <p className="text-[11px] font-extrabold text-clay-green-dark capitalize leading-none mt-0.5">
                  {otherRole.toLowerCase().replace('_', ' ')}
                </p>
              )}
              <p className={`text-xs truncate mt-1 ${unread > 0 && !isSelected ? 'font-bold text-clay-ink' : 'font-semibold text-clay-ink/60'}`}>
                {conv.lastMessagePreview ?? 'Start a conversation'}
              </p>
            </div>

            {unread > 0 && !isSelected && (
              <span className="flex-shrink-0 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-clay-ink bg-rose-500 text-[10px] font-extrabold text-white px-1.5">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
