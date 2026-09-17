import { useEffect, useRef } from 'react';
import { MicOff, Pin, PinOff, MonitorUp, VideoOff } from 'lucide-react';
import type { ICameraVideoTrack, ILocalVideoTrack, IRemoteVideoTrack, UID } from 'agora-rtc-sdk-ng';
import type { AgoraParticipant } from '../../hooks/use-agora';
import { cn } from '../../lib/utils';

/**
 * Meet-style stage. One of three layouts, in priority order:
 *   1. a participant is pinned  → they hold the stage
 *   2. someone is presenting    → the screen holds the stage
 *   3. neither                  → everyone in an even grid
 * In the first two the remaining people stay visible in a filmstrip, so you
 * never lose the room while looking at one person.
 */

const LOCAL_KEY = 'local';

interface Tile {
  key: string;
  label: string;
  videoTrack: ICameraVideoTrack | ILocalVideoTrack | IRemoteVideoTrack | null;
  isLocal: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isPresenting: boolean;
}

/** Deterministic tile tint so a camera-off avatar isn't a flat grey void. */
const AVATAR_TINTS = [
  'from-sky-500/30 to-sky-700/10 text-sky-200',
  'from-emerald-500/30 to-emerald-700/10 text-emerald-200',
  'from-amber-500/30 to-amber-700/10 text-amber-200',
  'from-rose-500/30 to-rose-700/10 text-rose-200',
  'from-violet-500/30 to-violet-700/10 text-violet-200',
  'from-teal-500/30 to-teal-700/10 text-teal-200',
];

function tintFor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

function initialsOf(label: string) {
  return label
    .replace(/\(.*?\)/g, '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface VideoTileProps {
  tile: Tile;
  isSpeaking: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  /** Stage tiles letterbox the source; filmstrip and grid tiles fill and crop. */
  contain?: boolean;
  compact?: boolean;
}

function VideoTile({ tile, isSpeaking, isPinned, onTogglePin, contain, compact }: VideoTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const showVideo = !!tile.videoTrack && !tile.isCameraOff;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !tile.videoTrack || tile.isCameraOff) return;
    // `fit` decides letterbox vs crop — a shared screen must never be cropped.
    tile.videoTrack.play(el, { fit: contain ? 'contain' : 'cover' });
    return () => { tile.videoTrack?.stop(); };
  }, [tile.videoTrack, tile.isCameraOff, contain]);

  return (
    <div
      className={cn(
        'group relative flex h-full w-full min-h-0 items-center justify-center overflow-hidden',
        'rounded-2xl bg-neutral-900 ring-1 ring-white/10',
        'transition-[box-shadow,transform] duration-200 ease-out',
        isSpeaking && 'ring-2 ring-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.15)]',
        isPinned && !isSpeaking && 'ring-2 ring-sky-400/80',
      )}
    >
      {showVideo ? (
        <div
          ref={containerRef}
          className="h-full w-full [&>div]:h-full [&>div]:w-full [&>video]:h-full [&>video]:w-full"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-gradient-to-br font-semibold tracking-tight ring-1 ring-white/10',
              tintFor(tile.key),
              compact ? 'h-11 w-11 text-sm' : 'h-20 w-20 text-2xl',
            )}
          >
            {initialsOf(tile.label) || '?'}
          </div>
          {tile.isCameraOff && !compact && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <VideoOff className="h-3.5 w-3.5" /> Camera off
            </span>
          )}
        </div>
      )}

      {/* Pin — always visible once pinned, otherwise on hover/focus */}
      <button
        onClick={onTogglePin}
        title={isPinned ? 'Unpin' : 'Pin to stage'}
        aria-label={isPinned ? `Unpin ${tile.label}` : `Pin ${tile.label} to stage`}
        className={cn(
          'absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full',
          'bg-black/55 text-white backdrop-blur-sm transition-all duration-150',
          'hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
          isPinned
            ? 'opacity-100 bg-sky-500/90 hover:bg-sky-500'
            : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
      </button>

      {tile.isPresenting && (
        <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-sky-500/90 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          <MonitorUp className="h-3.5 w-3.5" /> Presenting
        </span>
      )}

      {/* Name plate */}
      <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
        <span
          className={cn(
            'flex min-w-0 items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1 backdrop-blur-sm',
            compact ? 'text-[11px]' : 'text-xs',
          )}
        >
          {tile.isMuted && <MicOff className="h-3.5 w-3.5 shrink-0 text-rose-400" />}
          <span className="truncate font-medium text-white">
            {tile.isLocal ? `${tile.label} (You)` : tile.label}
          </span>
        </span>
        {isPinned && (
          <span className="shrink-0 rounded-lg bg-sky-500/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Pinned
          </span>
        )}
      </div>
    </div>
  );
}

/** Even-ish grid that keeps tiles close to 16:9 as the room grows. */
function gridClassFor(count: number) {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
  if (count <= 4) return 'grid-cols-2';
  if (count <= 9) return 'grid-cols-2 md:grid-cols-3';
  return 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4';
}

interface VideoGridProps {
  localVideoTrack: ICameraVideoTrack | null;
  localScreenTrack: ILocalVideoTrack | null;
  localLabel: string;
  participants: Map<UID, AgoraParticipant>;
  participantNames: Map<string, string>;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing?: boolean;
  /** 'local' | remote uid | null — who is presenting. */
  screenSharerUid: string | null;
  speakingUids: Set<string>;
  localUid: UID | null;
  pinnedKey: string | null;
  onTogglePin: (key: string) => void;
}

export function VideoGrid({
  localVideoTrack,
  localScreenTrack,
  localLabel,
  participants,
  participantNames,
  isMuted,
  isCameraOff,
  isScreenSharing,
  screenSharerUid,
  speakingUids,
  localUid,
  pinnedKey,
  onTogglePin,
}: VideoGridProps) {
  const presentingLocally = !!isScreenSharing;

  const localTile: Tile = {
    key: LOCAL_KEY,
    label: localLabel,
    videoTrack: presentingLocally && localScreenTrack ? localScreenTrack : localVideoTrack,
    isLocal: true,
    isMuted,
    // While presenting, the screen track is live even with the camera off.
    isCameraOff: presentingLocally ? !localScreenTrack : isCameraOff,
    isPresenting: presentingLocally,
  };

  const peerTiles: Tile[] = Array.from(participants.values()).map((p) => {
    const key = String(p.uid);
    return {
      key,
      label: participantNames.get(key) ?? 'Participant',
      videoTrack: p.videoTrack,
      isLocal: false,
      isMuted: !p.audioTrack,
      isCameraOff: !p.videoTrack,
      isPresenting: screenSharerUid === key,
    };
  });

  const allTiles = [localTile, ...peerTiles];

  const isSpeaking = (tile: Tile) =>
    tile.isLocal
      ? speakingUids.has(String(localUid)) && !isMuted
      : speakingUids.has(tile.key);

  // A pin beats a presentation — that is the point of pinning.
  const stageKey =
    (pinnedKey && allTiles.some((t) => t.key === pinnedKey) ? pinnedKey : null) ??
    (screenSharerUid && allTiles.some((t) => t.key === screenSharerUid) ? screenSharerUid : null);

  const renderTile = (tile: Tile, opts?: { contain?: boolean; compact?: boolean }) => (
    <VideoTile
      key={tile.key}
      tile={tile}
      isSpeaking={isSpeaking(tile)}
      isPinned={pinnedKey === tile.key}
      onTogglePin={() => onTogglePin(tile.key)}
      contain={opts?.contain}
      compact={opts?.compact}
    />
  );

  if (stageKey) {
    const stageTile = allTiles.find((t) => t.key === stageKey)!;
    const rest = allTiles.filter((t) => t.key !== stageKey);

    return (
      <div className="flex h-full w-full min-h-0 flex-col gap-3 p-3 lg:flex-row">
        <div className="min-h-0 min-w-0 flex-1">
          {renderTile(stageTile, { contain: stageTile.isPresenting })}
        </div>

        {rest.length > 0 && (
          <div
            className={cn(
              'flex shrink-0 gap-3',
              // Bottom rail on narrow screens, right rail on desktop.
              'h-24 flex-row overflow-x-auto overflow-y-hidden',
              'lg:h-auto lg:w-52 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden',
              '[scrollbar-width:thin]',
            )}
          >
            {rest.map((tile) => (
              <div
                key={tile.key}
                className="aspect-video h-full shrink-0 lg:h-auto lg:w-full"
              >
                {renderTile(tile, { compact: true })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid h-full w-full auto-rows-fr gap-3 p-3',
        gridClassFor(allTiles.length),
      )}
    >
      {allTiles.map((tile) => renderTile(tile))}
    </div>
  );
}
