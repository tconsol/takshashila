import { useState } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { timeAgo } from '../../utils/date';
import { useAuthStore } from '../../stores/auth.store';
import { Spinner } from '../../components/ui/Loading';
import { Avatar } from '../../components/ui/Avatar';
import { useConversations } from './use-chat';
import type { IConversation } from './chat.types';

interface Props {
  selectedId: string | null;
  onSelect: (conv: IConversation) => void;
  onNewChat: () => void;
}

export function ConversationList({ selectedId, onSelect, onNewChat }: Props) {
  const { user } = useAuthStore();
  const { data: conversations = [], isLoading } = useConversations();
  const [search, setSearch] = useState('');

  const searchLower = search.toLowerCase().trim();

  const filtered = searchLower
    ? conversations.filter((conv) => {
        const otherIdx = conv.participantPublicIds.findIndex((id) => id !== user?.publicId);
        const otherName = conv.participantNames?.[otherIdx] ?? '';
        const otherRole = conv.participantRoles[otherIdx] ?? '';
        return (
          otherName.toLowerCase().includes(searchLower) ||
          otherRole.toLowerCase().includes(searchLower)
        );
      })
    : conversations;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Search bar */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-rule">
        <div className="flex items-center gap-2 rounded border border-rule bg-surface-sunk px-2.5 py-1.5 transition-colors focus-within:border-accent">
          <Search className="h-3.5 w-3.5 text-ink-faint flex-shrink-0" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs font-medium text-ink-2 placeholder-ink-faint outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center py-10">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-6 py-10">
            <div className="flex h-11 w-11 items-center justify-center rounded border border-rule bg-surface-sunk">
              <MessageSquare className="h-4.5 w-4.5 text-ink-faint" />
            </div>
            <p className="text-xs font-medium text-ink-muted">
              {searchLower ? 'No matches found' : 'No conversations yet'}
            </p>
            {!searchLower && (
              <button
                onClick={onNewChat}
                className="text-xs font-semibold text-accent hover:text-accent-hover underline underline-offset-2"
              >
                Start one now
              </button>
            )}
          </div>
        ) : (
          filtered.map((conv) => {
            const unread = user ? ((conv.unreadCounts as Record<string, number>)[user.publicId] ?? 0) : 0;
            const isSelected = conv.publicId === selectedId;

            const otherIdx = conv.participantPublicIds.findIndex((id) => id !== user?.publicId);
            const otherName = conv.participantNames?.[otherIdx] ?? '';
            const otherRole = conv.participantRoles[otherIdx] ?? '';
            const displayName = otherName || otherRole.toLowerCase().replace('_', ' ');

            return (
              <button
                key={conv.publicId}
                onClick={() => onSelect(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-rule ${
                  isSelected
                    ? 'bg-accent-wash border-l-2 border-l-accent'
                    : 'hover:bg-surface-hover'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar name={displayName} size="md" />
                  {unread > 0 && !isSelected && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-70" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent ring-2 ring-surface" />
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-sm truncate ${unread > 0 && !isSelected ? 'font-semibold text-ink' : 'font-medium text-ink-2'}`}>
                      {otherName || <span className="capitalize text-ink-faint">{otherRole.toLowerCase().replace('_', ' ')}</span>}
                    </span>
                    {conv.lastMessageAt && (
                      <span className={`text-[10px] flex-shrink-0 ${unread > 0 && !isSelected ? 'text-accent font-semibold' : 'text-ink-faint'}`}>
                        {timeAgo(conv.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  {otherRole && (
                    <p className="eyebrow leading-none mt-1 normal-case tracking-normal text-[11px] font-medium text-ink-muted">
                      {otherRole.toLowerCase().replace('_', ' ')}
                    </p>
                  )}
                  <p className={`text-xs truncate mt-1 ${unread > 0 && !isSelected ? 'font-medium text-ink-2' : 'text-ink-faint'}`}>
                    {conv.lastMessagePreview ?? 'Start a conversation'}
                  </p>
                </div>

                {unread > 0 && !isSelected && (
                  <span className="flex-shrink-0 flex h-5 min-w-5 items-center justify-center rounded bg-accent text-[10px] font-semibold text-accent-ink px-1.5">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
