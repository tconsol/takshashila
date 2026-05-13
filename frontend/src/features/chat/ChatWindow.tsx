import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { useSocket } from '../../sockets/use-socket';
import { MessageBubble } from './MessageBubble';
import { Spinner } from '../../components/ui/Loading';
import { useMessages, useSendMessage, useMarkRead } from './use-chat';
import type { IMessage } from './chat.types';

interface Props {
  conversationPublicId: string;
  otherRole: string;
}

export function ChatWindow({ conversationPublicId, otherRole }: Props) {
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [allMessages, setAllMessages] = useState<IMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage } = useMessages(conversationPublicId);
  const { mutateAsync: send, isPending: sending } = useSendMessage(conversationPublicId);
  const { mutate: markRead } = useMarkRead();

  // Flatten paginated pages into a single message list
  useEffect(() => {
    if (!data) return;
    const msgs = data.pages.flatMap((p) => p.items);
    setAllMessages(msgs);
  }, [data]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

  // Mark read on open
  useEffect(() => {
    markRead(conversationPublicId);
  }, [conversationPublicId, markRead]);

  // Real-time socket messages
  useEffect(() => {
    if (!socket) return;
    socket.emit('chat:join', conversationPublicId);

    const handleMessage = (msg: IMessage) => {
      if (msg.conversationPublicId === conversationPublicId) {
        setAllMessages((prev) => {
          if (prev.find((m) => m.publicId === msg.publicId)) return prev;
          return [...prev, msg];
        });
        markRead(conversationPublicId);
      }
    };

    const handleTyping = (payload: { userPublicId: string }) => {
      if (payload.userPublicId !== user?.publicId) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 2000);
      }
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
    };
  }, [socket, conversationPublicId, user?.publicId, markRead]);

  const handleTypingEmit = useCallback(() => {
    socket?.emit('chat:typing', conversationPublicId);
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, [socket, conversationPublicId]);

  async function handleSend() {
    const body = input.trim();
    if (!body || sending) return;
    setInput('');
    const msg = await send(body);
    setAllMessages((prev) => {
      if (prev.find((m) => m.publicId === msg.publicId)) return prev;
      return [...prev, msg];
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="h-9 w-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-sm font-semibold text-brand-700 dark:text-brand-300">
          {otherRole.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
            {otherRole.toLowerCase().replace('_', ' ')}
          </p>
          {isTyping && <p className="text-xs text-gray-400">typing…</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 dark:bg-gray-950">
        {hasNextPage && (
          <div className="text-center mb-3">
            <button
              onClick={() => fetchNextPage()}
              className="text-xs text-brand-600 hover:underline"
            >
              Load older messages
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {allMessages.map((msg) => (
          <MessageBubble
            key={msg.publicId}
            message={msg}
            isMine={msg.senderPublicId === user?.publicId}
          />
        ))}

        {allMessages.length === 0 && !isLoading && (
          <p className="text-center text-sm text-gray-400 py-8">No messages yet. Say hello!</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <textarea
          value={input}
          onChange={(e) => { setInput(e.target.value); handleTypingEmit(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
