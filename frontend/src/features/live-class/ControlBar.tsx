import { useRef, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PenLine, Circle, Square, Hand, PhoneOff,
} from 'lucide-react';
import { api } from '../../lib/axios';
import { classesService } from '../../services/classes.service';
import { SocketEvent } from '../../sockets/socket.events';
import type { Socket } from 'socket.io-client';
import { cn } from '../../lib/utils';

interface ControlBarProps {
  classPublicId: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isWhiteboardOpen: boolean;
  isTutor: boolean;
  localStream: MediaStream | null;
  remoteStreams: MediaStream[];
  socket: Socket | null;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  onToggleWhiteboard: () => void;
  onRaiseHand: () => void;
  onLeave: () => void;
}

export function ControlBar({
  classPublicId,
  isMuted,
  isCameraOff,
  isScreenSharing,
  isWhiteboardOpen,
  isTutor,
  localStream,
  remoteStreams,
  socket,
  onToggleMute,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  onToggleWhiteboard,
  onRaiseHand,
  onLeave,
}: ControlBarProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    if (!localStream) return;

    // Mix all audio tracks via AudioContext
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    const allStreams = [localStream, ...remoteStreams].filter(Boolean);
    allStreams.forEach((s) => {
      if (s.getAudioTracks().length > 0) {
        audioCtx.createMediaStreamSource(s).connect(dest);
      }
    });

    const videoTrack = localStream.getVideoTracks()[0];
    const recordStream = videoTrack
      ? new MediaStream([videoTrack, ...dest.stream.getTracks()])
      : dest.stream;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    const recorder = new MediaRecorder(recordStream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      audioCtx.close();
      await uploadRecording(mimeType);
    };

    recorder.start(5000);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);

    socket?.emit(SocketEvent.RECORDING_STARTED, classPublicId);
  }

  async function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    socket?.emit(SocketEvent.RECORDING_STOPPED, classPublicId);
  }

  async function uploadRecording(mimeType: string) {
    if (chunksRef.current.length === 0) return;
    setIsUploadingRecording(true);
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
      const fileName = `recording-${classPublicId}-${Date.now()}.${ext}`;

      // Request signed upload URL from existing media service
      const { data: urlRes } = await api.post('/media/upload-url', {
        mediaType: 'CLASS_RECORDING',
        entityPublicId: classPublicId,
        fileName,
        contentType: mimeType,
      });

      const { uploadUrl, gcsObjectKey, publicUrl } = urlRes.data;

      await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': mimeType },
      });

      await classesService.saveRecording(classPublicId, {
        gcsObjectKey,
        recordingUrl: publicUrl,
      });
    } catch {
      // Recording upload failed silently — class completion is not blocked
    } finally {
      setIsUploadingRecording(false);
      chunksRef.current = [];
    }
  }

  const btnBase =
    'flex h-11 w-11 items-center justify-center rounded-full transition-all focus:outline-none';

  return (
    <div className="flex items-center justify-center gap-3 py-3 px-6 bg-gray-900/95 border-t border-gray-700 backdrop-blur-sm">
      {/* Mic */}
      <button
        onClick={onToggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        className={cn(btnBase, isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600')}
      >
        {isMuted ? <MicOff className="h-5 w-5 text-white" /> : <Mic className="h-5 w-5 text-white" />}
      </button>

      {/* Camera */}
      <button
        onClick={onToggleCamera}
        title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        className={cn(btnBase, isCameraOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600')}
      >
        {isCameraOff ? <VideoOff className="h-5 w-5 text-white" /> : <Video className="h-5 w-5 text-white" />}
      </button>

      {/* Screen share */}
      <button
        onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        className={cn(btnBase, isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600')}
      >
        {isScreenSharing
          ? <MonitorOff className="h-5 w-5 text-white" />
          : <Monitor className="h-5 w-5 text-white" />}
      </button>

      {/* Whiteboard */}
      <button
        onClick={onToggleWhiteboard}
        title={isWhiteboardOpen ? 'Close whiteboard' : 'Open whiteboard'}
        className={cn(btnBase, isWhiteboardOpen ? 'bg-violet-600 hover:bg-violet-700' : 'bg-gray-700 hover:bg-gray-600')}
      >
        <PenLine className="h-5 w-5 text-white" />
      </button>

      {/* Record (tutor only) */}
      {isTutor && (
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isUploadingRecording}
          title={isRecording ? 'Stop recording' : 'Start recording'}
          className={cn(
            btnBase,
            isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600',
            isUploadingRecording && 'opacity-60 cursor-not-allowed',
          )}
        >
          {isUploadingRecording
            ? <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            : isRecording
            ? <Square className="h-4 w-4 text-white fill-white" />
            : <Circle className={cn('h-4 w-4 text-red-400', isRecording && 'animate-pulse fill-red-500')} />}
        </button>
      )}

      {/* Raise hand */}
      <button
        onClick={onRaiseHand}
        title="Raise hand"
        className={cn(btnBase, 'bg-yellow-500/20 hover:bg-yellow-500/30')}
      >
        <Hand className="h-5 w-5 text-yellow-400" />
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-600 mx-1" />

      {/* Leave */}
      <button
        onClick={onLeave}
        title="Leave class"
        className={cn(btnBase, 'bg-red-600 hover:bg-red-700 w-auto px-4 gap-2 rounded-xl')}
      >
        <PhoneOff className="h-5 w-5 text-white" />
        <span className="text-sm font-medium text-white">Leave</span>
      </button>
    </div>
  );
}
