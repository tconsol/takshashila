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
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b-2.5 border-clay-ink bg-clay-mint">
        <div className="h-11 w-11 rounded-full border-2 border-clay-ink bg-clay-purple flex items-center justify-center text-sm font-extrabold text-clay-ink flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-clay-ink truncate">
            {otherName || <span className="capitalize">{otherRole.toLowerCase().replace('_', ' ')}</span>}
          </p>
          {otherRole && otherName && (
            <p className="text-[11px] font-extrabold text-clay-green-dark capitalize leading-none mt-0.5">
              {otherRole.toLowerCase().replace('_', ' ')}
            </p>
          )}
          {typingName && (
            <p className="text-xs font-bold text-clay-green-dark animate-pulse leading-none mt-0.5">
              {typingName} is typing…
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 bg-clay-bg min-h-0">
        {hasNextPage && (
          <div className="text-center mb-3">
            <button onClick={() => fetchNextPage()} className="text-xs font-extrabold text-clay-green-dark hover:text-clay-green">
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
      <div className="flex-shrink-0 bg-white border-t-2.5 border-clay-ink">

        {/* Pending file preview */}
        {pendingFile && (
          <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
            <div className="flex items-center gap-2 flex-1 min-w-0 border-2 border-clay-ink bg-clay-mint rounded-xl px-3 py-2">
              <span className="text-clay-ink flex-shrink-0">
                {fileIcon(pendingFile.type)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-clay-ink truncate">{pendingFile.name}</p>
                <p className="text-[10px] font-bold text-clay-ink/60">{(pendingFile.size / 1024).toFixed(0)} KB</p>
              </div>
              {uploading && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-16 h-2 border border-clay-ink bg-white rounded-full overflow-hidden">
                    <div className="h-full bg-clay-green transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-clay-ink">{uploadProgress}%</span>
                </div>
              )}
            </div>
            {!uploading && (
              <button onClick={clearPendingFile} className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border-2 border-clay-ink bg-clay-coral text-clay-ink hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* File error */}
        {fileError && (
          <p className="px-4 pt-1.5 text-xs font-bold text-rose-600">{fileError}</p>
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
            className="flex-shrink-0 h-11 w-11 flex items-center justify-center rounded-2xl border-2 border-clay-ink bg-clay-yellow text-clay-ink hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-40"
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
            className="flex-1 resize-none rounded-2xl border-2 border-clay-ink bg-white px-4 py-2.5 text-sm font-semibold text-clay-ink placeholder-clay-ink/40 outline-none transition-all focus:translate-x-[1px] focus:translate-y-[1px] focus:shadow-clay-pressed max-h-32 overflow-y-auto"
          />

          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border-2 border-clay-ink bg-clay-green text-white shadow-clay-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-clay-pressed disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
