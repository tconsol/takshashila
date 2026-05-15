import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Paperclip, X, FileText, Film, Image } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { useSocket } from '../../sockets/use-socket';
import { MessageBubble } from './MessageBubble';
import { Spinner } from '../../components/ui/Loading';
import { useMessages, useSendMessage, useMarkRead } from './use-chat';
import { validateChatFile, uploadChatMedia } from '../../services/chat-media.service';
import type { IMessage } from './chat.types';

interface Props {
  conversationPublicId: string;
  otherName: string;
  otherRole: string;
}

function getDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
  if (mimeType.startsWith('video/')) return <Film className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function ChatWindow({ conversationPublicId, otherName, otherRole }: Props) {
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const [input, setInput] = useState('');
  const [typingName, setTypingName] = useState<string | null>(null);
  const [allMessages, setAllMessages] = useState<IMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attachment state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage } = useMessages(conversationPublicId);
  const { mutateAsync: send, isPending: sending } = useSendMessage(conversationPublicId);
  const { mutate: markRead } = useMarkRead();

  useEffect(() => {
    if (!data) return;
    setAllMessages(data.pages.flatMap((p) => p.items));
  }, [data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

  useEffect(() => {
    markRead(conversationPublicId);
  }, [conversationPublicId, markRead]);

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
        socket.emit('chat:read', conversationPublicId);
      }
    };

    const handleTyping = (payload: { userPublicId: string; displayName: string }) => {
      if (payload.userPublicId !== user?.publicId) {
        setTypingName(payload.displayName || otherName || 'Someone');
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingName(null), 2500);
      }
    };

    const handleReadAck = (payload: { conversationPublicId: string; readerPublicId: string }) => {
      if (
        payload.conversationPublicId === conversationPublicId &&
        payload.readerPublicId !== user?.publicId
      ) {
        setAllMessages((prev) =>
          prev.map((m) =>
            m.senderPublicId === user?.publicId && !m.isRead
              ? { ...m, isRead: true, readAt: new Date().toISOString() }
              : m,
          ),
        );
      }
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:read-ack', handleReadAck);
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:read-ack', handleReadAck);
    };
  }, [socket, conversationPublicId, user?.publicId, markRead, otherName]);

  const handleTypingEmit = useCallback(() => {
    socket?.emit('chat:typing', conversationPublicId);
  }, [socket, conversationPublicId]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const err = validateChatFile(file);
    if (err) { setFileError(err); return; }
    setFileError(null);
    setPendingFile(file);
  }

  function clearPendingFile() {
    setPendingFile(null);
    setUploadProgress(0);
    setFileError(null);
  }

  async function handleSend() {
    const body = input.trim();
    const isBusy = sending || uploading;
    if (isBusy) return;
    if (!body && !pendingFile) return;

    setInput('');

    if (pendingFile) {
      setUploading(true);
      setUploadProgress(0);
      try {
        const media = await uploadChatMedia(pendingFile, setUploadProgress);
        const msg = await send({ body: body || undefined, ...media });
        setAllMessages((prev) => prev.find((m) => m.publicId === msg.publicId) ? prev : [...prev, msg]);
        setPendingFile(null);
        setUploadProgress(0);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    } else {
      const msg = await send({ body });
      setAllMessages((prev) => prev.find((m) => m.publicId === msg.publicId) ? prev : [...prev, msg]);
    }
  }

  const displayName = otherName || otherRole.toLowerCase().replace('_', ' ');
  const initials = getInitials(displayName);
  const canSend = (input.trim() || pendingFile) && !sending && !uploading;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="h-9 w-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-sm font-semibold text-brand-700 dark:text-brand-300 flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {otherName || <span className="capitalize">{otherRole.toLowerCase().replace('_', ' ')}</span>}
          </p>
          {otherRole && otherName && (
            <p className="text-[11px] text-brand-500 capitalize leading-none">
              {otherRole.toLowerCase().replace('_', ' ')}
            </p>
          )}
          {typingName && (
            <p className="text-xs text-green-500 animate-pulse leading-none mt-0.5">
              {typingName} is typing…
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 dark:bg-gray-950 min-h-0">
        {hasNextPage && (
          <div className="text-center mb-3">
            <button onClick={() => fetchNextPage()} className="text-xs text-brand-600 hover:underline">
              Load older messages
            </button>
          </div>
        )}

        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}

        {allMessages.map((msg, i) => {
          const isMine = msg.senderPublicId === user?.publicId;
          const prevMsg = allMessages[i - 1];
          const showName = !isMine && (!prevMsg || prevMsg.senderPublicId !== msg.senderPublicId);
          const msgDate = new Date(msg.createdAt);
          const prevDate = prevMsg ? new Date(prevMsg.createdAt) : null;
          const showDateSep = !prevDate || msgDate.toDateString() !== prevDate.toDateString();

          return (
            <div key={msg.publicId}>
              {showDateSep && (
                <div className="flex items-center justify-center my-3">
                  <span className="px-3 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    {getDateLabel(msgDate)}
                  </span>
                </div>
              )}
              <MessageBubble message={msg} isMine={isMine} senderName={otherName} showName={showName} />
            </div>
          );
        })}

        {allMessages.length === 0 && !isLoading && (
          <p className="text-center text-sm text-gray-400 py-8">No messages yet. Say hello!</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">

        {/* Pending file preview */}
        {pendingFile && (
          <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
            <div className="flex items-center gap-2 flex-1 min-w-0 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2">
              <span className="text-brand-600 dark:text-brand-400 flex-shrink-0">
                {fileIcon(pendingFile.type)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{pendingFile.name}</p>
                <p className="text-[10px] text-gray-400">{(pendingFile.size / 1024).toFixed(0)} KB</p>
              </div>
              {uploading && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400">{uploadProgress}%</span>
                </div>
              )}
            </div>
            {!uploading && (
              <button onClick={clearPendingFile} className="flex-shrink-0 text-gray-400 hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* File error */}
        {fileError && (
          <p className="px-4 pt-1.5 text-xs text-red-500">{fileError}</p>
        )}

        {/* Text input row */}
        <div className="flex items-end gap-2 px-4 py-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,.ppt,.pptx"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Attach button */}
          <button
            type="button"
            onClick={() => { setFileError(null); fileInputRef.current?.click(); }}
            disabled={uploading}
            className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors disabled:opacity-40"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); handleTypingEmit(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 max-h-32 overflow-y-auto"
          />

          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
