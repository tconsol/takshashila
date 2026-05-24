import { useState, useEffect, useRef } from 'react';
import { FileText, Film, Download, AlertCircle, ChevronDown, Reply, Pin, CheckSquare, Trash2, ChevronLeft, Smile } from 'lucide-react';
import EmojiPickerLib from 'emoji-picker-react';
import { formatTime } from '../../utils/date';
import { getMediaReadUrl } from '../../services/chat-media.service';
import type { IMessage } from './chat.types';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Props {
  message: IMessage;
  isMine: boolean;
  senderName?: string;
  showName?: boolean;
  currentUserPublicId?: string;
  onDeleteRequest: (messagePublicId: string, forEveryone: boolean) => void;
  onReact: (messagePublicId: string, emoji: string) => void;
  onReply: (message: IMessage) => void;
  onPin: (message: IMessage) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (messagePublicId: string) => void;
  onEnterSelectionMode: (messagePublicId: string) => void;
}

type MenuView = 'main' | 'delete';

function DoubleTick({ isRead }: { isRead: boolean }) {
  const color = isRead ? '#93c5fd' : 'rgba(255,255,255,0.55)';
  return (
    <svg width="18" height="11" viewBox="0 0 20 12" fill="none" className="flex-shrink-0">
      <path d="M1 6L4.5 9.5L10.5 2" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9.5L18.5 1.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

async function downloadBlob(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, '_blank');
  }
}

function MediaContent({ message, isMine }: { message: IMessage; isMine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!message.mediaPublicId) return;
    getMediaReadUrl(message.mediaPublicId).then(setUrl).catch(() => setError(true));
  }, [message.mediaPublicId]);

  if (!message.mediaPublicId) return null;
  const mime = message.mediaMimeType ?? '';
  const name = message.mediaName ?? 'File';
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');

  if (error) return (
    <div className="flex items-center gap-2 text-xs opacity-70 py-1">
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span>Could not load file</span>
    </div>
  );

  if (!url) return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin opacity-50" />
      <span className="text-xs opacity-60">Loading…</span>
    </div>
  );

  if (isAudio) return (
    <div className="mt-1 mb-0.5">
      <audio src={url} controls className="max-w-[260px] h-10" style={{ colorScheme: isMine ? 'dark' : 'light' }} />
    </div>
  );

  if (isImage) return (
    <div className="relative mt-1 mb-0.5 inline-block">
      <img
        src={url} alt={name}
        className="max-w-[260px] max-h-[220px] rounded-xl object-cover block cursor-pointer"
        onClick={() => window.open(url, '_blank')}
        onError={() => setError(true)}
      />
      <button
        onClick={(e) => { e.stopPropagation(); downloadBlob(url, name); }}
        className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/75 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  if (isVideo) return (
    <div className="relative mt-1 mb-0.5">
      <video src={url} controls className="max-w-[260px] rounded-xl" style={{ maxHeight: 200 }} />
      <button
        onClick={() => downloadBlob(url, name)}
        className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/75 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const sizeLabel = message.mediaSizeBytes ? `${(message.mediaSizeBytes / 1024).toFixed(0)} KB` : '';
  const isDoc = mime.includes('word') || mime.includes('presentation') || mime.includes('powerpoint');
  return (
    <button
      onClick={() => downloadBlob(url, name)}
      className={`flex items-center gap-2.5 mt-1 mb-0.5 px-3 py-2.5 rounded-xl border w-full text-left hover:opacity-80 transition-opacity ${
        isMine ? 'border-white/20 bg-white/10' : 'border-clay-ink/20 bg-clay-bg'
      }`}
    >
      <div className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg ${isMine ? 'bg-white/20' : 'bg-clay-mint'}`}>
        {isDoc ? <FileText className={`h-5 w-5 ${isMine ? 'text-white' : 'text-clay-ink'}`} />
          : mime === 'application/pdf' ? <FileText className={`h-5 w-5 ${isMine ? 'text-white' : 'text-rose-500'}`} />
          : <Film className={`h-5 w-5 ${isMine ? 'text-white' : 'text-clay-ink'}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold truncate ${isMine ? 'text-white' : 'text-clay-ink'}`}>{name}</p>
        {sizeLabel && <p className={`text-[10px] ${isMine ? 'text-white/60' : 'text-clay-ink/50'}`}>{sizeLabel}</p>}
      </div>
      <Download className={`h-4 w-4 flex-shrink-0 ${isMine ? 'text-white/70' : 'text-clay-ink/50'}`} />
    </button>
  );
}

function MenuItem({ icon, label, onClick, danger = false }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex items-center gap-3 w-full px-4 py-2.5 text-xs font-extrabold transition-colors hover:bg-white/10 ${danger ? 'text-rose-400' : 'text-white'}`}
    >
      {icon}
      {label}
    </button>
  );
}

export function MessageBubble({
  message, isMine, senderName, showName, currentUserPublicId,
  onDeleteRequest, onReact, onReply, onPin,
  isSelectionMode, isSelected, onToggleSelect, onEnterSelectionMode,
}: Props) {
  const [menuView, setMenuView] = useState<MenuView | null>(null);
  const [showEmojiPanel, setShowEmojiPanel] = useState<'quick' | 'full' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const hasMedia = !!message.mediaPublicId;
  const hasText = !!message.body;

  useEffect(() => {
    if (!menuView && !showEmojiPanel) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (emojiRef.current?.contains(e.target as Node)) return;
      setMenuView(null);
      setShowEmojiPanel(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuView, showEmojiPanel]);

  function handleBubbleClick(e: React.MouseEvent) {
    if (isSelectionMode) { onToggleSelect(message.publicId); return; }
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); onEnterSelectionMode(message.publicId); }
  }

  const reactions = message.reactions ?? {};
  const reactionEntries = Object.entries(reactions).filter(([, users]) => users.length > 0);

  const meta = (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap align-bottom">
      <span className={`text-[10px] font-bold leading-none ${isMine ? 'text-white/75' : 'text-clay-ink/50'}`}>
        {formatTime(message.createdAt)}
      </span>
      {isMine && (
        <>
          <DoubleTick isRead={message.isRead} />
          <span className={`text-[9px] font-bold leading-none ${message.isRead ? 'text-blue-300' : 'text-white/55'}`}>
            {message.isRead ? 'Seen' : 'Sent'}
          </span>
        </>
      )}
    </span>
  );

  return (
    <div className={`flex items-end gap-2 mb-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} group`} onClick={handleBubbleClick}>

      {/* Checkbox in selection mode */}
      <div
        className={`flex-shrink-0 self-center transition-all ${isSelectionMode ? 'w-6 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}
        onClick={(e) => { e.stopPropagation(); onToggleSelect(message.publicId); }}
      >
        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
          isSelected ? 'bg-clay-green border-clay-green' : 'border-clay-ink/40 bg-white'
        }`}>
          {isSelected && (
            <svg viewBox="0 0 12 10" fill="none" className="h-3 w-3">
              <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      {/* Bubble column */}
      <div className={`max-w-[72%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        {!isMine && showName && senderName && (
          <span className="text-[11px] font-extrabold text-clay-green-dark px-1 mb-0.5">{senderName}</span>
        )}

        {/* Reply preview */}
        {message.replyToPublicId && (
          <div className={`mb-1 max-w-full px-3 py-1.5 rounded-xl border-l-4 text-xs ${
            isMine
              ? 'bg-black/25 border-white/80 text-white/95'
              : 'bg-clay-green/15 border-clay-green text-clay-ink'
          }`}>
            <p className={`font-extrabold text-[10px] mb-0.5 ${isMine ? 'text-white' : 'text-clay-green-dark'}`}>{message.replyToSender}</p>
            <p className={`truncate ${isMine ? 'text-white/85' : 'text-clay-ink/80'}`}>{message.replyToBody || '📎 Attachment'}</p>
          </div>
        )}

        {/* Hover action buttons — hidden in selection mode */}
        {!isSelectionMode && (
          <div className={`flex items-center gap-1 mb-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>

            {/* Emoji reaction button */}
            <div ref={emojiRef} className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowEmojiPanel((p) => p ? null : 'quick'); setMenuView(null); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-full bg-clay-bg border border-clay-ink/20 text-clay-ink/60 hover:text-clay-ink hover:border-clay-ink"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>

              {showEmojiPanel === 'quick' && (
                <div className={`absolute bottom-8 ${isMine ? 'right-0' : 'left-0'} z-30 flex items-center gap-1 bg-clay-ink rounded-2xl px-2 py-1.5 border border-white/10`}>
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={(e) => { e.stopPropagation(); onReact(message.publicId, emoji); setShowEmojiPanel(null); }}
                      className="text-xl hover:scale-125 transition-transform leading-none"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowEmojiPanel('full'); }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white text-xs font-extrabold hover:bg-white/25 transition-colors ml-1"
                  >
                    +
                  </button>
                </div>
              )}

              {showEmojiPanel === 'full' && (
                <div className={`absolute bottom-8 ${isMine ? 'right-0' : 'left-0'} z-30`}>
                  <EmojiPickerLib
                    onEmojiClick={(data) => { onReact(message.publicId, data.emoji); setShowEmojiPanel(null); }}
                    height={380}
                    width={320}
                    searchPlaceholder="Search reaction"
                    skinTonesDisabled
                  />
                </div>
              )}
            </div>

            {/* Chevron-down menu button */}
            <div ref={menuRef} className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuView((v) => v ? null : 'main'); setShowEmojiPanel(null); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-full bg-clay-bg border border-clay-ink/20 text-clay-ink/60 hover:text-clay-ink hover:border-clay-ink"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {menuView && (
                <div className={`absolute bottom-8 ${isMine ? 'right-0' : 'left-0'} z-30 bg-clay-ink text-white rounded-2xl border border-white/10 py-1.5 min-w-[170px]`}>
                  {menuView === 'main' && (
                    <>
                      <MenuItem icon={<Reply className="h-4 w-4" />} label="Reply" onClick={() => { setMenuView(null); onReply(message); }} />
                      <MenuItem icon={<Pin className="h-4 w-4" />} label={message.pinnedUntil && new Date(message.pinnedUntil) > new Date() ? 'Unpin' : 'Pin'} onClick={() => { setMenuView(null); onPin(message); }} />
                      <div className="h-px bg-white/10 my-1" />
                      <MenuItem icon={<CheckSquare className="h-4 w-4" />} label="Select" onClick={() => { setMenuView(null); onEnterSelectionMode(message.publicId); }} />
                      <div className="h-px bg-white/10 my-1" />
                      <MenuItem icon={<Trash2 className="h-4 w-4" />} label="Delete" danger onClick={() => setMenuView('delete')} />
                    </>
                  )}
                  {menuView === 'delete' && (
                    <>
                      <button
                        onClick={() => setMenuView('main')}
                        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-extrabold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Back
                      </button>
                      <div className="h-px bg-white/10 my-1" />
                      <MenuItem icon={<Trash2 className="h-4 w-4" />} label="Delete for me" danger onClick={() => { setMenuView(null); onDeleteRequest(message.publicId, false); }} />
                      {isMine && (
                        <MenuItem icon={<Trash2 className="h-4 w-4" />} label="Delete for everyone" danger onClick={() => { setMenuView(null); onDeleteRequest(message.publicId, true); }} />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`rounded-2xl border-2 overflow-hidden ${isSelectionMode ? 'cursor-pointer' : ''} ${
            isSelected ? 'border-clay-green ring-2 ring-clay-green/40' : 'border-clay-ink'
          } ${isMine ? 'bg-clay-green text-white rounded-br-md' : 'bg-white text-clay-ink rounded-bl-md'} px-3.5 py-2`}
        >
          {hasMedia && <MediaContent message={message} isMine={isMine} />}
          {hasText && (
            <div className="overflow-hidden">
              <span className="float-right ml-2 mt-1">{meta}</span>
              <span className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.body}</span>
            </div>
          )}
          {!hasText && hasMedia && <div className="flex justify-end mt-1">{meta}</div>}
        </div>

        {/* Emoji reactions display */}
        {reactionEntries.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {reactionEntries.map(([emoji, users]) => {
              const reacted = currentUserPublicId ? users.includes(currentUserPublicId) : false;
              return (
                <button
                  key={emoji}
                  onClick={(e) => { e.stopPropagation(); onReact(message.publicId, emoji); }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold transition-colors ${
                    reacted
                      ? 'bg-clay-green/20 border-clay-green text-clay-ink'
                      : 'bg-white border-clay-ink/20 text-clay-ink hover:border-clay-ink'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[11px]">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
