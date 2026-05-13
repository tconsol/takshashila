import { useEffect, useRef } from 'react';
import { MicOff, VideoOff } from 'lucide-react';
import type { RtcParticipant } from '../../hooks/use-webrtc';

interface VideoTileProps {
  stream: MediaStream | null;
  label: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
}

function VideoTile({ stream, label, isLocal, isMuted, isCameraOff }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = label
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gray-800 flex items-center justify-center aspect-video">
      {stream && !isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-white text-xl font-bold shadow-lg">
            {initials}
          </div>
          {isCameraOff && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <VideoOff className="h-3 w-3" /> Camera off
            </span>
          )}
        </div>
      )}

      {/* Name tag */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/50 px-2 py-1 backdrop-blur-sm">
        <span className="text-xs font-medium text-white">{isLocal ? `${label} (You)` : label}</span>
        {isMuted && <MicOff className="h-3 w-3 text-red-400" />}
      </div>

      {isLocal && (
        <div className="absolute top-2 right-2 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          YOU
        </div>
      )}
    </div>
  );
}

interface VideoGridProps {
  localStream: MediaStream | null;
  localLabel: string;
  participants: Map<string, RtcParticipant>;
  isMuted: boolean;
  isCameraOff: boolean;
  getParticipantLabel: (p: RtcParticipant) => string;
}

export function VideoGrid({
  localStream,
  localLabel,
  participants,
  isMuted,
  isCameraOff,
  getParticipantLabel,
}: VideoGridProps) {
  const peers = Array.from(participants.values());
  const total = 1 + peers.length;

  const gridClass =
    total === 1
      ? 'grid-cols-1'
      : total === 2
      ? 'grid-cols-2'
      : 'grid-cols-2';

  return (
    <div className={`grid ${gridClass} gap-3 w-full h-full p-3 content-center`}>
      <VideoTile
        stream={localStream}
        label={localLabel}
        isLocal
        isMuted={isMuted}
        isCameraOff={isCameraOff}
      />
      {peers.map((p) => (
        <VideoTile
          key={p.socketId}
          stream={p.stream}
          label={getParticipantLabel(p)}
          isMuted={false}
        />
      ))}
    </div>
  );
}
