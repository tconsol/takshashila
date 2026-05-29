import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Paperclip, X, FileText, Film, Image, RotateCcw, Trash2, Smile, Mic, Pause, Play, Pin } from 'lucide-react';
import EmojiPickerLib from 'emoji-picker-react';
import { useAuthStore } from '../../stores/auth.store';
import { useSocket } from '../../sockets/use-socket';
import { MessageBubble } from './MessageBubble';
import { Spinner } from '../../components/ui/Loading';
import { useMessages, useSendMessage, useMarkRead, useDeleteMessage, useReactToMessage, usePinMessage, useUnpinMessage } from './use-chat';
import { validateChatFile, uploadChatMedia } from '../../services/chat-media.service';
import { api } from '../../lib/axios';
import type { IMessage } from './chat.types';

interface PendingDelete {
  messagePublicId: string;
  forEveryone: boolean;
  message: IMessage;
}

interface ReplyState {
  publicId: string;
  body: string;
  sender: string;
}

type RecordingPhase = 'idle' | 'recording' | 'paused';

// ─── Pin Modal ────────────────────────────────────────────────────────────────
function PinModal({ onConfirm, onCancel }: { onConfirm: (hours: number) => void; onCancel: () => void }) {
  const [choice, setChoice] = useState<24 | 168 | 720>(168);
  const options: { label: string; hours: 24 | 168 | 720 }[] = [
    { label: '24 hours', hours: 24 },
    { label: '7 days', hours: 168 },
    { label: '30 days', hours: 720 },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-1">Choose how long your pin lasts</h3>
        <p className="text-xs text-slate-500 mb-5">You can unpin at any time.</p>
        <div className="flex flex-col gap-3 mb-6">
          {options.map((opt) => (
            <label key={opt.hours} className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setChoice(opt.hours)}
                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  choice === opt.hours ? 'border-indigo-500 bg-white' : 'border-slate-300 bg-white'
                }`}
              >
                {choice === opt.hours && <div className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}
              </div>
              <span className="text-sm font-medium text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(choice)}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors"
          >
            Pin
          </button>
        </div>
      </div>
    </div>
  );
}

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

function formatSeconds(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(1, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function WaveformBars() {
  return (
    <div className="flex items-center gap-[2px] h-6">
      {Array.from({ length: 28 }).map((_, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full bg-white/60 animate-pulse"
          style={{
            height: `${Math.random() * 60 + 20}%`,
            animationDelay: `${(i * 50) % 700}ms`,
            animationDuration: `${600 + (i * 37) % 400}ms`,
          }}
        />
      ))}
    </div>
  );
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Attachment
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Reply
  const [replyTo, setReplyTo] = useState<ReplyState | null>(null);

  // Voice recording
  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>('idle');
  const [recordingSecs, setRecordingSecs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage } = useMessages(conversationPublicId);
  const { mutateAsync: send, isPending: sending } = useSendMessage(conversationPublicId);
  const { mutate: markRead } = useMarkRead();
  const { mutateAsync: deleteMessage } = useDeleteMessage(conversationPublicId);
  const { mutateAsync: reactToMessage } = useReactToMessage(conversationPublicId);
  const { mutateAsync: pinMessage } = usePinMessage(conversationPublicId);
  const { mutateAsync: unpinMessage } = useUnpinMessage(conversationPublicId);

  // Pin state
  const [pinnedMessage, setPinnedMessage] = useState<IMessage | null>(null);
  const [pinTarget, setPinTarget] = useState<IMessage | null>(null);

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ─── Selection handlers ────────────────────────────────────────────────────
  function handleEnterSelectionMode(publicId: string) {
    setIsSelectionMode(true);
    setSelectedIds(new Set([publicId]));
  }
  function handleToggleSelect(publicId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId); else next.add(publicId);
      return next;
    });
  }
  function handleExitSelectionMode() { setIsSelectionMode(false); setSelectedIds(new Set()); }
  function handleDeleteSelected() {
    Array.from(selectedIds).forEach((id) => handleDeleteRequest(id, false));
    handleExitSelectionMode();
  }

  // ─── Data load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!data) return;
    const msgs = data.pages.flatMap((p) => p.items);
    setAllMessages(msgs);
    const now = new Date();
    const pinned = msgs.find((m) => m.pinnedUntil && new Date(m.pinnedUntil) > now) ?? null;
    setPinnedMessage(pinned);
  }, [data]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [allMessages]);

  useEffect(() => {
    markRead(conversationPublicId);
    socket?.emit('chat:read', conversationPublicId);
  }, [conversationPublicId, markRead, socket]);

  // ─── Socket events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    socket.emit('chat:join', conversationPublicId);

    const handleMessage = (msg: IMessage) => {
      if (msg.conversationPublicId === conversationPublicId) {
        setAllMessages((prev) => prev.find((m) => m.publicId === msg.publicId) ? prev : [...prev, msg]);
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
      if (payload.conversationPublicId === conversationPublicId && payload.readerPublicId !== user?.publicId) {
        setAllMessages((prev) =>
          prev.map((m) => m.senderPublicId === user?.publicId && !m.isRead
            ? { ...m, isRead: true, readAt: new Date().toISOString() }
            : m),
        );
      }
    };
    const handleMessageDeleted = (payload: { messagePublicId: string; conversationPublicId: string }) => {
      if (payload.conversationPublicId === conversationPublicId)
        setAllMessages((prev) => prev.filter((m) => m.publicId !== payload.messagePublicId));
    };
    const handleReaction = (payload: { conversationPublicId: string; message: IMessage }) => {
      if (payload.conversationPublicId === conversationPublicId)
        setAllMessages((prev) => prev.map((m) => m.publicId === payload.message.publicId ? payload.message : m));
    };
    const handleMessagePinned = (payload: { conversationPublicId: string; message: IMessage }) => {
      if (payload.conversationPublicId === conversationPublicId) {
        setAllMessages((prev) => prev.map((m) => m.publicId === payload.message.publicId ? payload.message : m));
        setPinnedMessage(payload.message);
      }
    };
    const handleMessageUnpinned = (payload: { conversationPublicId: string; messagePublicId: string }) => {
      if (payload.conversationPublicId === conversationPublicId) {
        setAllMessages((prev) => prev.map((m) => m.publicId === payload.messagePublicId ? { ...m, pinnedUntil: undefined, pinnedBy: undefined } : m));
        setPinnedMessage((prev) => prev?.publicId === payload.messagePublicId ? null : prev);
      }
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:read-ack', handleReadAck);
    socket.on('chat:message-deleted', handleMessageDeleted);
    socket.on('chat:reaction', handleReaction);
    socket.on('chat:message-pinned', handleMessagePinned);
    socket.on('chat:message-unpinned', handleMessageUnpinned);
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:read-ack', handleReadAck);
      socket.off('chat:message-deleted', handleMessageDeleted);
      socket.off('chat:reaction', handleReaction);
      socket.off('chat:message-pinned', handleMessagePinned);
      socket.off('chat:message-unpinned', handleMessageUnpinned);
    };
  }, [socket, conversationPublicId, user?.publicId, markRead, otherName]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (!emojiPickerRef.current?.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  // ─── Delete with undo ─────────────────────────────────────────────────────
  function handleDeleteRequest(messagePublicId: string, forEveryone: boolean) {
    const msg = allMessages.find((m) => m.publicId === messagePublicId);
    if (!msg) return;
    if (pendingDelete && deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteMessage({ messagePublicId: pendingDelete.messagePublicId, forEveryone: pendingDelete.forEveryone }).catch(() => {
        setAllMessages((prev) => [...prev, pendingDelete.message].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      });
    }
    setAllMessages((prev) => prev.filter((m) => m.publicId !== messagePublicId));
    const item: PendingDelete = { messagePublicId, forEveryone, message: msg };
    setPendingDelete(item);
    deleteTimerRef.current = setTimeout(async () => {
      setPendingDelete(null); deleteTimerRef.current = null;
      try { await deleteMessage({ messagePublicId, forEveryone }); }
      catch { setAllMessages((prev) => [...prev, msg].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())); }
    }, 3000);
  }

  function handleUndo() {
    if (!pendingDelete) return;
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
    setAllMessages((prev) => [...prev, pendingDelete.message].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    setPendingDelete(null);
  }

  // ─── Reaction ─────────────────────────────────────────────────────────────
  async function handleReact(messagePublicId: string, emoji: string) {
    try {
      const updated = await reactToMessage({ messagePublicId, emoji });
      setAllMessages((prev) => prev.map((m) => m.publicId === updated.publicId ? updated : m));
    } catch {}
  }

  // ─── Reply ────────────────────────────────────────────────────────────────
  function handleReply(message: IMessage) {
    const senderName = message.senderPublicId === user?.publicId ? 'You' : otherName;
    setReplyTo({ publicId: message.publicId, body: message.body || (message.mediaName ? `📎 ${message.mediaName}` : ''), sender: senderName });
    textareaRef.current?.focus();
  }

  // ─── Pin ──────────────────────────────────────────────────────────────────
  function handlePin(message: IMessage) {
    const isCurrentlyPinned = message.pinnedUntil && new Date(message.pinnedUntil) > new Date();
    if (isCurrentlyPinned) {
      unpinMessage(message.publicId).then(() => {
        setAllMessages((prev) => prev.map((m) => m.publicId === message.publicId ? { ...m, pinnedUntil: undefined, pinnedBy: undefined } : m));
        setPinnedMessage((prev) => prev?.publicId === message.publicId ? null : prev);
      }).catch(() => {});
    } else {
      setPinTarget(message);
    }
  }

  async function confirmPin(durationHours: number) {
    if (!pinTarget) return;
    setPinTarget(null);
    try {
      const updated = await pinMessage({ messagePublicId: pinTarget.publicId, durationHours });
      setAllMessages((prev) => prev.map((m) => m.publicId === updated.publicId ? updated : m));
      setPinnedMessage(updated);
    } catch {}
  }

  // ─── Voice recording ──────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setRecordingPhase('recording');
      setRecordingSecs(0);
      recordingTimerRef.current = setInterval(() => setRecordingSecs((s) => s + 1), 1000);
    } catch {
      setFileError('Microphone permission denied');
    }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingPhase('paused');
    }
  }

  function resumeRecording() {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      recordingTimerRef.current = setInterval(() => setRecordingSecs((s) => s + 1), 1000);
      setRecordingPhase('recording');
    }
  }

  function cancelRecording() {
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setRecordingPhase('idle');
    setRecordingSecs(0);
  }

  async function sendVoiceMessage() {
    if (!mediaRecorderRef.current) return;
    setUploading(true);
    setRecordingPhase('idle');
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    await new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      recorder.onstop = () => resolve();
      if (recorder.state !== 'inactive') recorder.stop();
      else resolve();
    });

    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());

    try {
      const rawMime = mediaRecorderRef.current?.mimeType ?? 'audio/webm';
      const mimeType = rawMime.split(';')[0].trim();
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });

      const { data: urlRes } = await api.post('/media/upload-url', {
        originalName: file.name, mimeType: file.type,
        sizeBytes: file.size, mediaType: 'VOICE',
      });
      const { uploadUrl, gcsObjectKey } = urlRes.data;
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      const { data: confirmRes } = await api.post('/media/confirm', {
        gcsObjectKey, originalName: file.name, mimeType: file.type, sizeBytes: file.size, mediaType: 'VOICE',
      });
      const mediaPublicId = confirmRes.data?.publicId ?? confirmRes.publicId;

      const msg = await send({
        mediaPublicId, mediaMimeType: file.type,
        mediaName: file.name, mediaSizeBytes: file.size,
        ...(replyTo ? { replyToPublicId: replyTo.publicId, replyToBody: replyTo.body, replyToSender: replyTo.sender } : {}),
      });
      setAllMessages((prev) => prev.find((m) => m.publicId === msg.publicId) ? prev : [...prev, msg]);
      setReplyTo(null);
    } catch {
      setFileError('Failed to send voice message');
    } finally {
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setRecordingSecs(0);
      setUploading(false);
    }
  }

  // ─── Text/file send ───────────────────────────────────────────────────────
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

  function clearPendingFile() { setPendingFile(null); setUploadProgress(0); setFileError(null); }

  async function handleSend() {
    const body = input.trim();
    if (sending || uploading) return;
    if (!body && !pendingFile) return;
    setInput('');
    const replyPayload = replyTo
      ? { replyToPublicId: replyTo.publicId, replyToBody: replyTo.body, replyToSender: replyTo.sender }
      : {};
    setReplyTo(null);

    if (pendingFile) {
      setUploading(true); setUploadProgress(0);
      try {
        const media = await uploadChatMedia(pendingFile, setUploadProgress);
        const msg = await send({ body: body || undefined, ...media, ...replyPayload });
        setAllMessages((prev) => prev.find((m) => m.publicId === msg.publicId) ? prev : [...prev, msg]);
        setPendingFile(null); setUploadProgress(0);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : 'Upload failed');
      } finally { setUploading(false); }
    } else {
      const msg = await send({ body, ...replyPayload });
      setAllMessages((prev) => prev.find((m) => m.publicId === msg.publicId) ? prev : [...prev, msg]);
    }
  }

  const displayName = otherName || otherRole.toLowerCase().replace('_', ' ');
  const initials = getInitials(displayName);
  const canSend = (input.trim() || pendingFile) && !sending && !uploading;
  const isVoiceMode = recordingPhase !== 'idle';

  return (
    <>
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {otherName || <span className="capitalize">{otherRole.toLowerCase().replace('_', ' ')}</span>}
          </p>
          {otherRole && otherName && (
            <p className="text-[11px] font-medium text-indigo-600 capitalize leading-none mt-0.5">
              {otherRole.toLowerCase().replace('_', ' ')}
            </p>
          )}
          {typingName && (
            <p className="text-xs font-medium text-indigo-500 animate-pulse leading-none mt-0.5">{typingName} is typing…</p>
          )}
        </div>
      </div>

      {/* Pinned message banner */}
      {pinnedMessage && (
        <div className="group flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-white">
          <Pin className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
          <p className="flex-1 text-xs font-medium text-slate-800 truncate">
            {pinnedMessage.body || (pinnedMessage.mediaName ? `📎 ${pinnedMessage.mediaName}` : 'Pinned message')}
          </p>
          <button
            onClick={() => unpinMessage(pinnedMessage.publicId).then(() => setPinnedMessage(null)).catch(() => {})}
            className="flex-shrink-0 hidden group-hover:flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
          >
            <X className="h-2.5 w-2.5" />
            Unpin
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50 min-h-0">
        {hasNextPage && (
          <div className="text-center mb-3">
            <button onClick={() => fetchNextPage()} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
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
                  <span className="px-3 py-0.5 rounded-full bg-slate-200 text-[11px] font-medium text-slate-500">
                    {getDateLabel(msgDate)}
                  </span>
                </div>
              )}
              <MessageBubble
                message={msg} isMine={isMine} senderName={otherName} showName={showName}
                currentUserPublicId={user?.publicId}
                onDeleteRequest={handleDeleteRequest}
                onReact={handleReact}
                onReply={handleReply}
                onPin={handlePin}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.has(msg.publicId)}
                onToggleSelect={handleToggleSelect}
                onEnterSelectionMode={handleEnterSelectionMode}
              />
            </div>
          );
        })}

        {allMessages.length === 0 && !isLoading && (
          <p className="text-center text-sm text-slate-400 py-8">No messages yet. Say hello!</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Selection mode bar */}
      {isSelectionMode && (
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 text-white border-t border-slate-700">
          <div className="flex items-center gap-3">
            <button onClick={handleExitSelectionMode} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30 hover:bg-white/10 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
          </div>
          <button
            onClick={handleDeleteSelected} disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-400/50 bg-rose-500/20 text-rose-300 font-medium text-xs hover:bg-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      {/* Undo toast */}
      {pendingDelete && (
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium">
          <span>Message deleted</span>
          <button onClick={handleUndo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/30 bg-white/10 hover:bg-white/20 transition-colors">
            <RotateCcw className="h-3 w-3" /> Undo
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200">

        {/* Reply preview */}
        {replyTo && (
          <div className="flex items-center gap-2 px-4 pt-2.5 pb-1 border-b border-slate-100">
            <div className="flex-1 min-w-0 border-l-4 border-indigo-500 pl-2">
              <p className="text-[10px] font-semibold text-indigo-600">{replyTo.sender}</p>
              <p className="text-xs text-slate-600 truncate">{replyTo.body}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        )}

        {/* Pending file preview */}
        {pendingFile && (
          <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
            <div className="flex items-center gap-2 flex-1 min-w-0 border border-slate-200 bg-indigo-50 rounded-xl px-3 py-2">
              <span className="text-indigo-600 flex-shrink-0">{fileIcon(pendingFile.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{pendingFile.name}</p>
                <p className="text-[10px] text-slate-500">{(pendingFile.size / 1024).toFixed(0)} KB</p>
              </div>
              {uploading && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="text-[10px] font-medium text-slate-600">{uploadProgress}%</span>
                </div>
              )}
            </div>
            {!uploading && (
              <button onClick={clearPendingFile} className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {fileError && <p className="px-4 pt-1.5 text-xs font-medium text-rose-600">{fileError}</p>}

        {/* Voice recording bar */}
        {isVoiceMode ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-900">
            {/* Delete */}
            <button onClick={cancelRecording} className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-rose-500/30 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>

            {/* Recording indicator + timer */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`h-2.5 w-2.5 rounded-full bg-rose-500 ${recordingPhase === 'recording' ? 'animate-pulse' : 'opacity-50'}`} />
              <span className="text-white font-semibold text-sm tabular-nums">{formatSeconds(recordingSecs)}</span>
            </div>

            {/* Waveform animation */}
            <div className="flex-1 min-w-0">
              <WaveformBars />
            </div>

            {/* Pause / Resume */}
            <button
              onClick={recordingPhase === 'recording' ? pauseRecording : resumeRecording}
              className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              {recordingPhase === 'recording' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>

            {/* Send */}
            <button
              onClick={sendVoiceMessage}
              disabled={uploading}
              className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          /* Normal input row */
          <div className="flex items-end gap-2 px-4 py-3">
            <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,.ppt,.pptx" className="hidden" onChange={handleFileSelect} />

            {/* Emoji picker button */}
            <div ref={emojiPickerRef} className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((p) => !p)}
                className="h-11 w-11 flex items-center justify-center rounded-2xl bg-amber-50 border border-slate-200 text-slate-600 hover:bg-amber-100 transition-colors"
              >
                <Smile className="h-5 w-5" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-14 left-0 z-30">
                  <EmojiPickerLib
                    onEmojiClick={(data) => {
                      setInput((prev) => prev + data.emoji);
                      textareaRef.current?.focus();
                    }}
                    height={380}
                    width={320}
                    searchPlaceholder="Search emoji"
                    skinTonesDisabled
                  />
                </div>
              )}
            </div>

            {/* Attach button */}
            <button
              type="button"
              onClick={() => { setFileError(null); fileInputRef.current?.click(); }}
              disabled={uploading}
              className="flex-shrink-0 h-11 w-11 flex items-center justify-center rounded-2xl bg-sky-50 border border-slate-200 text-slate-600 hover:bg-sky-100 transition-colors disabled:opacity-40"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            {/* Text area */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); handleTypingEmit(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message…"
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 max-h-32 overflow-y-auto"
            />

            {/* Mic button (only when input is empty and no file) */}
            {!input.trim() && !pendingFile ? (
              <button
                type="button"
                onClick={startRecording}
                className="flex-shrink-0 h-11 w-11 flex items-center justify-center rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Mic className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="flex-shrink-0 h-11 w-11 flex items-center justify-center rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Pin duration modal */}
    {pinTarget && (
      <PinModal onConfirm={confirmPin} onCancel={() => setPinTarget(null)} />
    )}
    </>
  );
}
