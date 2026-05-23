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
    <div className="flex h-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      {/* Conversation list sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-brand-600" />
            Messages
          </h2>
        </div>
        <ConversationList selectedId={activeId} onSelect={handleSelect} />
      </div>

      {/* Chat window */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {activeId ? (
          <ChatWindow
            conversationPublicId={activeId}
            otherName={otherName}
            otherRole={otherRole}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
            <MessageSquare className="h-14 w-14 opacity-20" />
            <p className="text-sm">Select a conversation to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
