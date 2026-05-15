import { useRef, useState, useEffect } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PenLine, Circle, Square, Hand, PhoneOff,
} from 'lucide-react';
import { api } from '../../lib/axios';
import { classesService } from '../../services/classes.service';
import { SocketEvent } from '../../sockets/socket.events';
import { useSocket } from '../../sockets/use-socket';
import { cn } from '../../lib/utils';
import type { ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

interface ControlBarProps {
  classPublicId: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isWhiteboardOpen: boolean;
  isTutor: boolean;
  localVideoTrack: ICameraVideoTrack | null;
  localAudioTrack: IMicrophoneAudioTrack | null;
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
  classPublicId,
  isMuted,
  isCameraOff,
  isScreenSharing,
  isWhiteboardOpen,
  isTutor,
  localVideoTrack,
  localAudioTrack,
  onToggleMute,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  onToggleWhiteboard,
  onRaiseHand,
  isHandRaised,
  onLeave,
}: ControlBarProps) {
  const { socket } = useSocket();
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!isRecording) { setRecordingSeconds(0); return; }
    const id = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  async function startRecording() {
    const recordStream = new MediaStream();

    const videoMediaTrack = localVideoTrack?.getMediaStreamTrack();
    if (videoMediaTrack) recordStream.addTrack(videoMediaTrack);

    const audioMediaTrack = localAudioTrack?.getMediaStreamTrack();
    if (audioMediaTrack) recordStream.addTrack(audioMediaTrack);

    if (recordStream.getTracks().length === 0) return;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    const recorder = new MediaRecorder(recordStream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
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
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-2.5 py-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-mono font-semibold text-red-400">{formatTime(recordingSeconds)}</span>
            </div>
          )}
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
              : <Circle className="h-4 w-4 text-red-400" />}
          </button>
        </div>
      )}

      {/* Raise hand */}
      <button
        onClick={onRaiseHand}
        title={isHandRaised ? 'Lower hand' : 'Raise hand'}
        className={cn(btnBase, isHandRaised ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-yellow-500/20 hover:bg-yellow-500/30')}
      >
        <Hand className={cn('h-5 w-5', isHandRaised ? 'text-white' : 'text-yellow-400')} />
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
