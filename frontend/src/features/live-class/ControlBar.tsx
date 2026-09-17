import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PenLine, Hand, PhoneOff,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface ControlBarProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isWhiteboardOpen: boolean;
  onToggleMute: () => Promise<void>;
  onToggleCamera: () => Promise<void>;
  onStartScreenShare: () => Promise<void>;
  onStopScreenShare: () => Promise<void>;
  onToggleWhiteboard: () => void;
  onRaiseHand: () => void;
  isHandRaised: boolean;
  onLeave: () => void;
}

export function ControlBar({
  isMuted,
  isCameraOff,
  isScreenSharing,
  isWhiteboardOpen,
  onToggleMute,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  onToggleWhiteboard,
  onRaiseHand,
  isHandRaised,
  onLeave,
}: ControlBarProps) {
  const btnBase =
    'flex h-11 w-11 items-center justify-center rounded-full transition-all duration-150 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-neutral-900 active:scale-95';
  const idle = 'bg-white/10 hover:bg-white/20';
  const danger = 'bg-rose-600 hover:bg-rose-500';

  return (
    <div className="flex shrink-0 items-center justify-center gap-2.5 border-t border-white/10 bg-neutral-900/90 px-6 py-3 backdrop-blur">
      {/* Mic */}
      <button
        onClick={onToggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        className={cn(btnBase, isMuted ? danger : idle)}
      >
        {isMuted ? <MicOff className="h-5 w-5 text-white" /> : <Mic className="h-5 w-5 text-white" />}
      </button>

      {/* Camera */}
      <button
        onClick={onToggleCamera}
        title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        className={cn(btnBase, isCameraOff ? danger : idle)}
      >
        {isCameraOff ? <VideoOff className="h-5 w-5 text-white" /> : <Video className="h-5 w-5 text-white" />}
      </button>

      {/* Screen share */}
      <button
        onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        className={cn(btnBase, isScreenSharing ? 'bg-sky-600 hover:bg-sky-500' : idle)}
      >
        {isScreenSharing
          ? <MonitorOff className="h-5 w-5 text-white" />
          : <Monitor className="h-5 w-5 text-white" />}
      </button>

      {/* Whiteboard */}
      <button
        onClick={onToggleWhiteboard}
        title={isWhiteboardOpen ? 'Close whiteboard' : 'Open whiteboard'}
        className={cn(btnBase, isWhiteboardOpen ? 'bg-violet-600 hover:bg-violet-500' : idle)}
      >
        <PenLine className="h-5 w-5 text-white" />
      </button>

      {/* Raise hand */}
      <button
        onClick={onRaiseHand}
        title={isHandRaised ? 'Lower hand' : 'Raise hand'}
        className={cn(btnBase, isHandRaised ? 'bg-amber-400 hover:bg-amber-300' : idle)}
      >
        <Hand className={cn('h-5 w-5', isHandRaised ? 'text-neutral-900' : 'text-amber-300')} />
      </button>

      {/* Divider */}
      <div className="mx-1 h-8 w-px bg-white/10" />

      {/* Leave */}
      <button
        onClick={onLeave}
        title="Leave class"
        className={cn(btnBase, danger, 'w-auto gap-2 rounded-xl px-4')}
      >
        <PhoneOff className="h-5 w-5 text-white" />
        <span className="text-sm font-medium text-white">Leave</span>
      </button>
    </div>
  );
}
