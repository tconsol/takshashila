import { useState, useEffect } from 'react';
import { FileText, Film, Download, AlertCircle } from 'lucide-react';
import { formatTime } from '../../utils/date';
import { getMediaReadUrl } from '../../services/chat-media.service';
import type { IMessage } from './chat.types';

interface Props {
  message: IMessage;
  isMine: boolean;
  senderName?: string;
  showName?: boolean;
}

function DoubleTick({ isRead }: { isRead: boolean }) {
  const color = isRead ? '#60a5fa' : 'rgba(255,255,255,0.6)';
  return (
    <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="flex-shrink-0 relative top-[0.5px]">
      <path d="M1 6L4.5 9.5L10.5 2" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9.5L18.5 1.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MediaContent({ message, isMine }: { message: IMessage; isMine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!message.mediaPublicId) return;
    getMediaReadUrl(message.mediaPublicId)
      .then(setUrl)
      .catch(() => setError(true));
  }, [message.mediaPublicId]);

  if (!message.mediaPublicId) return null;

  const mime = message.mediaMimeType ?? '';
  const name = message.mediaName ?? 'File';
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs opacity-70 py-1">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>Could not load file</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin opacity-50" />
        <span className="text-xs opacity-60">Loading…</span>
      </div>
    );
  }

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1 mb-0.5">
        <img
          src={url}
          alt={name}
          className="max-w-[260px] max-h-[220px] rounded-xl object-cover"
          onError={() => setError(true)}
        />
      </a>
    );
  }

  if (isVideo) {
    return (
      <video
        src={url}
        controls
        className="mt-1 mb-0.5 max-w-[260px] rounded-xl"
        style={{ maxHeight: 200 }}
      />
    );
  }

  // PDF / doc / other — download card
  const sizeLabel = message.mediaSizeBytes
    ? `${(message.mediaSizeBytes / 1024).toFixed(0)} KB`
    : '';
  const isDoc = mime.includes('word') || mime.includes('presentation') || mime.includes('powerpoint');

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={name}
      className={`flex items-center gap-2.5 mt-1 mb-0.5 px-3 py-2.5 rounded-xl border transition-opacity hover:opacity-80 ${
        isMine
          ? 'border-white/20 bg-white/10'
          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
      }`}
    >
      <div className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg ${
        isMine ? 'bg-white/20' : 'bg-brand-100 dark:bg-brand-900/30'
      }`}>
        {isDoc
          ? <FileText className={`h-5 w-5 ${isMine ? 'text-white' : 'text-brand-600 dark:text-brand-400'}`} />
          : mime === 'application/pdf'
            ? <FileText className={`h-5 w-5 ${isMine ? 'text-white' : 'text-red-500'}`} />
            : <Film className={`h-5 w-5 ${isMine ? 'text-white' : 'text-brand-600'}`} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${isMine ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
          {name}
        </p>
        {sizeLabel && (
          <p className={`text-[10px] ${isMine ? 'text-white/60' : 'text-gray-400'}`}>{sizeLabel}</p>
        )}
      </div>
      <Download className={`h-4 w-4 flex-shrink-0 ${isMine ? 'text-white/70' : 'text-gray-400'}`} />
    </a>
  );
}

export function MessageBubble({ message, isMine, senderName, showName }: Props) {
  const hasMedia = !!message.mediaPublicId;
  const hasText = !!message.body;

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <div className={`max-w-[72%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMine && showName && senderName && (
          <span className="text-[11px] font-extrabold text-clay-green-dark px-1 mb-0.5">
            {senderName}
          </span>
        )}
        <div
          className={`rounded-2xl border-2 border-clay-ink px-3.5 py-2 ${
            isMine
              ? 'bg-clay-green text-white rounded-br-md'
              : 'bg-white text-clay-ink rounded-bl-md'
          }`}
        >
          {/* Media */}
          {hasMedia && <MediaContent message={message} isMine={isMine} />}

          {/* Text body */}
          {hasText && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.body}</p>
          )}

          {/* Time + ticks */}
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className={`text-[10px] font-bold leading-none ${isMine ? 'text-white/80' : 'text-clay-ink/50'}`}>
              {formatTime(message.createdAt)}
            </span>
            {isMine && (
              <span className="flex flex-col items-end">
                <DoubleTick isRead={message.isRead} />
                <span className={`text-[9px] font-bold leading-none ${message.isRead ? 'text-clay-yellow' : 'text-white/60'}`}>
                  {message.isRead ? 'Seen' : 'Delivered'}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
