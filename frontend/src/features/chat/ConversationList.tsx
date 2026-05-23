import { useState } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { timeAgo } from '../../utils/date';
import { useAuthStore } from '../../stores/auth.store';
import { Spinner } from '../../components/ui/Loading';
import { useConversations } from './use-chat';
import type { IConversation } from './chat.types';

interface Props {
  selectedId: string | null;
  onSelect: (conv: IConversation) => void;
  onNewChat: () => void;
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
}

export function ConversationList({ selectedId, onSelect, onNewChat }: Props) {
  const { user } = useAuthStore();
  const { data: conversations = [], isLoading } = useConversations();
  const [search, setSearch] = useState('');

  const searchLower = search.toLowerCase().trim();

  // Filter by name and sort: matching first, rest below
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
      <div className="flex-shrink-0 px-3 py-2 border-b border-clay-ink/10">
        <div className="flex items-center gap-2 rounded-xl border-2 border-clay-ink/30 bg-clay-bg px-3 py-1.5 focus-within:border-clay-ink transition-colors">
          <Search className="h-3.5 w-3.5 text-clay-ink/40 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs font-semibold text-clay-ink placeholder-clay-ink/40 outline-none"
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-clay-ink/20 bg-clay-mint/50">
              <MessageSquare className="h-5 w-5 text-clay-ink/40" />
            </div>
            <p className="text-xs font-extrabold text-clay-ink/50">
              {searchLower ? 'No matches found' : 'No conversations yet'}
            </p>
            {!searchLower && (
              <button
                onClick={onNewChat}
                className="text-xs font-extrabold text-clay-green underline underline-offset-2"
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
            const initials = getInitials(displayName);

            return (
              <button
                key={conv.publicId}
                onClick={() => onSelect(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-dashed border-clay-ink/10 ${
                  isSelected ? 'bg-clay-mint border-l-4 border-l-clay-ink' : 'hover:bg-clay-bg'
                }`}
              >
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
          })
        )}
      </div>
    </div>
  );
}
