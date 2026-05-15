import { useEffect, useRef } from 'react';
import { MicOff, VideoOff, Monitor } from 'lucide-react';
import type { ICameraVideoTrack, ILocalVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import type { AgoraParticipant } from '../../hooks/use-agora';
import type { UID } from 'agora-rtc-sdk-ng';

interface VideoTileProps {
  videoTrack: ICameraVideoTrack | ILocalVideoTrack | IRemoteVideoTrack | null;
  label: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isScreenSharing?: boolean;
}

function VideoTile({ videoTrack, label, isLocal, isMuted, isCameraOff, isScreenSharing }: VideoTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !videoTrack || isCameraOff) return;
    videoTrack.play(containerRef.current);
    return () => {
      videoTrack.stop();
    };
  }, [videoTrack, isCameraOff]);

  const initials = label
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const showVideo = videoTrack && !isCameraOff;

  return (
    <div className="relative overflow-hidden rounded-xl bg-gray-800 flex items-center justify-center w-full h-full min-h-0">
      {showVideo ? (
        <div
          ref={containerRef}
          className="w-full h-full [&>div]:w-full [&>div]:h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 w-full h-full">
          {isScreenSharing ? (
            <div className="flex flex-col items-center gap-2 text-blue-400">
              <Monitor className="h-12 w-12" />
              <span className="text-xs font-medium">Screen Sharing</span>
            </div>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-white text-xl font-bold shadow-lg">
                {initials || '?'}
              </div>
              {isCameraOff && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <VideoOff className="h-3 w-3" /> Camera off
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Name tag */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 backdrop-blur-sm">
        <span className="text-xs font-medium text-white">{isLocal ? `${label} (You)` : label}</span>
        {isMuted && <MicOff className="h-3 w-3 text-red-400" />}
      </div>

      {isLocal && (
        <div className="absolute top-2 right-2 rounded-md bg-indigo-600/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm tracking-wide">
          YOU
        </div>
      )}
    </div>
  );
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
  // 'local' = local user is spotlight, string uid = remote uid is spotlight, null = grid
  screenSharerUid: string | null;
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
}: VideoGridProps) {
  const peers = Array.from(participants.values());
  const activeLocalTrack = isScreenSharing && localScreenTrack ? localScreenTrack : localVideoTrack;

  // ─── Spotlight layout (screen share active) ──────────────────────────────
  if (screenSharerUid) {
    const isLocalSpotlight = screenSharerUid === 'local';
    const spotlightPeer = isLocalSpotlight
      ? null
      : peers.find((p) => String(p.uid) === screenSharerUid) ?? null;
    const otherPeers = isLocalSpotlight
      ? peers
      : peers.filter((p) => String(p.uid) !== screenSharerUid);

    return (
      <div className="flex w-full h-full gap-2 p-3 min-h-0">
        {/* Large spotlight tile */}
        <div className="flex-1 min-w-0 min-h-0">
          {isLocalSpotlight ? (
            <VideoTile
              videoTrack={activeLocalTrack}
              label={localLabel}
              isLocal
              isMuted={isMuted}
              isCameraOff={false}
              isScreenSharing={!localScreenTrack}
            />
          ) : spotlightPeer ? (
            <VideoTile
              videoTrack={spotlightPeer.videoTrack}
              label={participantNames.get(String(spotlightPeer.uid)) ?? 'Participant'}
              isMuted={!spotlightPeer.audioTrack}
            />
          ) : null}
        </div>

        {/* Thumbnail strip */}
        <div className="flex flex-col gap-2 w-36 shrink-0 overflow-y-auto">
          {!isLocalSpotlight && (
            <div className="h-24 shrink-0 flex-shrink-0">
              <VideoTile
                videoTrack={localVideoTrack}
                label={localLabel}
                isLocal
                isMuted={isMuted}
                isCameraOff={isCameraOff}
              />
            </div>
          )}
          {otherPeers.map((p) => (
            <div key={String(p.uid)} className="h-24 shrink-0 flex-shrink-0">
              <VideoTile
                videoTrack={p.videoTrack}
                label={participantNames.get(String(p.uid)) ?? 'Participant'}
                isMuted={!p.audioTrack}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Normal grid layout ──────────────────────────────────────────────────
  const total = 1 + peers.length;
  const gridCols = total === 1 ? 'grid-cols-1' : 'grid-cols-2';
  const gridRows = total <= 2 ? 'grid-rows-1' : 'grid-rows-2';

  return (
    <div className={`grid ${gridCols} ${gridRows} gap-2 w-full h-full p-3`}>
      <VideoTile
        videoTrack={activeLocalTrack}
        label={localLabel}
        isLocal
        isMuted={isMuted}
        isCameraOff={isScreenSharing ? false : isCameraOff}
        isScreenSharing={isScreenSharing && !localScreenTrack}
      />
      {peers.map((p) => (
        <VideoTile
          key={String(p.uid)}
          videoTrack={p.videoTrack}
          label={participantNames.get(String(p.uid)) ?? 'Participant'}
          isMuted={!p.audioTrack}
        />
      ))}
    </div>
  );
}
