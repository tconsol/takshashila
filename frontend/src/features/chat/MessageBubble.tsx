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
  return (
    <svg
      width="16" height="10" viewBox="0 0 20 12" fill="none"
      className={`flex-shrink-0 text-accent-ink ${isRead ? 'opacity-100' : 'opacity-60'}`}
    >
      <path d="M1 6L4.5 9.5L10.5 2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9.5L18.5 1.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
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
        className="max-w-[260px] max-h-[220px] rounded object-cover block cursor-pointer"
        onClick={() => window.open(url, '_blank')}
        onError={() => setError(true)}
      />
      <button
        onClick={(e) => { e.stopPropagation(); downloadBlob(url, name); }}
        className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded bg-ink/60 text-paper hover:bg-ink/80 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  if (isVideo) return (
    <div className="relative mt-1 mb-0.5">
      <video src={url} controls className="max-w-[260px] rounded" style={{ maxHeight: 200 }} />
      <button
        onClick={() => downloadBlob(url, name)}
        className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded bg-ink/60 text-paper hover:bg-ink/80 transition-colors"
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
      className={`flex items-center gap-2.5 mt-1 mb-0.5 px-3 py-2.5 rounded border w-full text-left hover:opacity-80 transition-opacity ${
        isMine ? 'border-accent-ink/20 bg-accent-ink/10' : 'border-rule bg-surface-sunk'
      }`}
    >
      <div className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded ${isMine ? 'bg-accent-ink/20' : 'bg-surface'}`}>
        {isDoc ? <FileText className={`h-5 w-5 ${isMine ? 'text-accent-ink' : 'text-accent'}`} />
          : mime === 'application/pdf' ? <FileText className={`h-5 w-5 ${isMine ? 'text-accent-ink' : 'text-danger'}`} />
          : <Film className={`h-5 w-5 ${isMine ? 'text-accent-ink' : 'text-ink-muted'}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${isMine ? 'text-accent-ink' : 'text-ink'}`}>{name}</p>
        {sizeLabel && <p className={`text-[10px] ${isMine ? 'text-accent-ink/60' : 'text-ink-faint'}`}>{sizeLabel}</p>}
      </div>
      <Download className={`h-4 w-4 flex-shrink-0 ${isMine ? 'text-accent-ink/70' : 'text-ink-faint'}`} />
    </button>
  );
}

function MenuItem({ icon, label, onClick, danger = false }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex items-center gap-3 w-full px-4 py-2.5 text-xs font-medium transition-colors hover:bg-paper/10 ${danger ? 'text-danger' : 'text-paper'}`}
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
    <span className="inline-flex items-center gap-1 whitespace-nowrap align-bottom">
      <span className={`text-[10px] font-semibold leading-none ${isMine ? 'text-accent-ink/90' : 'text-ink-faint'}`}>
        {formatTime(message.createdAt)}
      </span>
      {isMine && (
        <>
          <DoubleTick isRead={message.isRead} />
          <span className="text-[9px] font-semibold leading-none text-accent-ink/90">
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
          isSelected ? 'bg-accent border-accent' : 'border-rule-strong bg-surface'
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
          <span className="text-[11px] font-semibold text-ink-muted px-1 mb-0.5">{senderName}</span>
        )}

        {/* Reply preview */}
        {message.replyToPublicId && (
          <div className={`mb-1 max-w-full px-3 py-1.5 rounded border-l-2 text-xs ${
            isMine
              ? 'bg-ink/20 border-accent-ink/80 text-accent-ink/95'
              : 'bg-accent-wash border-accent text-ink-2'
          }`}>
            <p className={`font-semibold text-[10px] mb-0.5 ${isMine ? 'text-accent-ink' : 'text-accent'}`}>{message.replyToSender}</p>
            <p className={`truncate ${isMine ? 'text-accent-ink/85' : 'text-ink-muted'}`}>{message.replyToBody || '📎 Attachment'}</p>
          </div>
        )}

        {/* Hover action buttons */}
        {!isSelectionMode && (
          <div className={`flex items-center gap-1 mb-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>

            {/* Emoji reaction button */}
            <div ref={emojiRef} className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowEmojiPanel((p) => p ? null : 'quick'); setMenuView(null); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-full bg-surface border border-rule text-ink-faint hover:text-ink-2 hover:border-rule-strong shadow-lift"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>

              {showEmojiPanel === 'quick' && (
                <div className={`absolute bottom-8 ${isMine ? 'right-0' : 'left-0'} z-30 flex items-center gap-1 bg-ink rounded-md px-2 py-1.5 border border-paper/10 shadow-pop`}>
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
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-paper/15 text-paper text-xs font-semibold hover:bg-paper/25 transition-colors ml-1"
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
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-full bg-surface border border-rule text-ink-faint hover:text-ink-2 hover:border-rule-strong shadow-lift"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {menuView && (
                <div className={`absolute bottom-8 ${isMine ? 'right-0' : 'left-0'} z-30 bg-ink text-paper rounded-md border border-paper/10 py-1.5 min-w-[170px] shadow-pop`}>
                  {menuView === 'main' && (
                    <>
                      <MenuItem icon={<Reply className="h-4 w-4" />} label="Reply" onClick={() => { setMenuView(null); onReply(message); }} />
                      <MenuItem icon={<Pin className="h-4 w-4" />} label={message.pinnedUntil && new Date(message.pinnedUntil) > new Date() ? 'Unpin' : 'Pin'} onClick={() => { setMenuView(null); onPin(message); }} />
                      <div className="h-px bg-paper/10 my-1" />
                      <MenuItem icon={<CheckSquare className="h-4 w-4" />} label="Select" onClick={() => { setMenuView(null); onEnterSelectionMode(message.publicId); }} />
                      <div className="h-px bg-paper/10 my-1" />
                      <MenuItem icon={<Trash2 className="h-4 w-4" />} label="Delete" danger onClick={() => setMenuView('delete')} />
                    </>
                  )}
                  {menuView === 'delete' && (
                    <>
                      <button
                        onClick={() => setMenuView('main')}
                        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-paper/60 hover:text-paper hover:bg-paper/10 transition-colors"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Back
                      </button>
                      <div className="h-px bg-paper/10 my-1" />
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
          className={`rounded-lg overflow-hidden ${isSelectionMode ? 'cursor-pointer' : ''} ${
            isSelected ? 'ring-2 ring-accent ring-offset-1' : ''
          } ${isMine ? 'bg-accent text-accent-ink rounded-br-sm' : 'bg-surface border border-rule text-ink rounded-bl-sm shadow-lift'} px-3.5 py-2`}
        >
          {hasMedia && <MediaContent message={message} isMine={isMine} />}
          {hasText && (
            <div className="overflow-hidden">
              <span className="float-right ml-2 mt-1">{meta}</span>
              <span className={`text-[14px] font-semibold leading-relaxed whitespace-pre-wrap break-words ${isMine ? 'text-accent-ink' : 'text-ink'}`}>
                {message.body}
              </span>
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
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium transition-colors ${
                    reacted
                      ? 'bg-accent-wash border-accent/50 text-accent'
                      : 'bg-surface border-rule text-ink-muted hover:border-rule-strong'
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
