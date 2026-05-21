import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { ConversationList } from '../../features/chat/ConversationList';
import { ChatWindow } from '../../features/chat/ChatWindow';
import type { IConversation } from '../../features/chat/chat.types';

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<IConversation | null>(null);

  const activeId = selected?.publicId ?? conversationId ?? null;

  function handleSelect(conv: IConversation) {
    setSelected(conv);
    navigate(`/chat/${conv.publicId}`, { replace: true });
  }

  const otherIdx = selected
    ? selected.participantPublicIds.findIndex((id) => id !== user?.publicId)
    : -1;

  const otherName = (otherIdx >= 0 ? selected?.participantNames?.[otherIdx] : '') ?? '';
  const otherRole = (otherIdx >= 0 ? selected?.participantRoles?.[otherIdx] : '') ?? '';

  return (
    <div className="flex h-full overflow-hidden rounded-[28px] border-2.5 border-clay-ink bg-white dark:bg-gray-900 shadow-clay">
      {/* Conversation list sidebar */}
      <div className="w-80 flex-shrink-0 border-r-2.5 border-clay-ink flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-4 py-3 border-b-2.5 border-clay-ink bg-clay-mint">
          <h2 className="font-extrabold text-clay-ink flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-clay-ink bg-white">
              <MessageSquare className="h-4 w-4 text-clay-ink" />
            </div>
            Messages
          </h2>
        </div>
        <ConversationList selectedId={activeId} onSelect={handleSelect} />
      </div>

      {/* Chat window */}
      <div className="flex-1 min-w-0 overflow-hidden bg-clay-bg">
        {activeId ? (
          <ChatWindow
            conversationPublicId={activeId}
            otherName={otherName}
            otherRole={otherRole}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-clay-ink">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-2.5 border-clay-ink bg-clay-mint shadow-clay">
              <MessageSquare className="h-9 w-9 text-clay-ink" />
            </div>
            <p className="text-sm font-extrabold text-clay-ink">Select a conversation to start chatting</p>
            <p className="text-xs font-semibold text-clay-ink/50">Your messages will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
