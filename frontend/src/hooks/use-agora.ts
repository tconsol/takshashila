import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
  type ILocalVideoTrack,
  type IRemoteVideoTrack,
  type IRemoteAudioTrack,
  type IAgoraRTCRemoteUser,
  type UID,
} from 'agora-rtc-sdk-ng';
import { classesService } from '../services/classes.service';

AgoraRTC.setLogLevel(4);

export interface AgoraParticipant {
  uid: UID;
  videoTrack: IRemoteVideoTrack | null;
  audioTrack: IRemoteAudioTrack | null;
}

export interface UseAgoraReturn {
  localVideoTrack: ICameraVideoTrack | null;
  localAudioTrack: IMicrophoneAudioTrack | null;
  localScreenTrack: ILocalVideoTrack | null;
  localUid: UID | null;
  participants: Map<UID, AgoraParticipant>;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isJoined: boolean;
  error: string | null;
  toggleMute: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export function useAgora(classPublicId: string | null): UseAgoraReturn {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const screenTrackRef = useRef<ILocalVideoTrack | null>(null);

  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localScreenTrack, setLocalScreenTrack] = useState<ILocalVideoTrack | null>(null);
  const [localUid, setLocalUid] = useState<UID | null>(null);
  const [participants, setParticipants] = useState<Map<UID, AgoraParticipant>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateParticipant = useCallback((uid: UID, update: Partial<AgoraParticipant>) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      const existing = next.get(uid) ?? { uid, videoTrack: null, audioTrack: null };
      next.set(uid, { ...existing, ...update });
      return next;
    });
  }, []);

  const removeParticipant = useCallback((uid: UID) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      next.delete(uid);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!classPublicId) return;

    let active = true;
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;

    async function join() {
      try {
        const { appId, channel, token, uid } = await classesService.getAgoraToken(classPublicId!);
        if (!active) return;

        client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
          if (!active) return;
          await client.subscribe(user, mediaType);
          if (!active) return;
          if (mediaType === 'video') {
            updateParticipant(user.uid, { videoTrack: user.videoTrack ?? null });
          }
          if (mediaType === 'audio') {
            user.audioTrack?.play();
            updateParticipant(user.uid, { audioTrack: user.audioTrack ?? null });
          }
        });

        client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
          if (!active) return;
          if (mediaType === 'video') updateParticipant(user.uid, { videoTrack: null });
          if (mediaType === 'audio') updateParticipant(user.uid, { audioTrack: null });
        });

        client.on('user-left', (user: IAgoraRTCRemoteUser) => {
          if (!active) return;
          removeParticipant(user.uid);
        });

        await client.join(appId, channel, token, uid);
        if (!active) {
          client.leave().catch(() => {});
          return;
        }

        setIsJoined(true);
        setLocalUid(client.uid ?? null);

        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
          { encoderConfig: 'music_standard' },
          { encoderConfig: '480p_1', facingMode: 'user' },
        );

        if (!active) {
          audioTrack.close();
          videoTrack.close();
          client.leave().catch(() => {});
          return;
        }

        localAudioRef.current = audioTrack;
        localVideoRef.current = videoTrack;
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        await client.publish([audioTrack, videoTrack]);
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Failed to join classroom';
          setError(msg);
        }
      }
    }

    join();

    return () => {
      active = false;
      // Grab and null refs before async leave to prevent double-cleanup
      const clientToLeave = clientRef.current;
      clientRef.current = null;
      localAudioRef.current?.close();
      localVideoRef.current?.close();
      localAudioRef.current = null;
      localVideoRef.current = null;
      if (screenTrackRef.current) {
        screenTrackRef.current.close();
        screenTrackRef.current = null;
      }
      if (clientToLeave) {
        clientToLeave.leave().catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classPublicId]);

  const toggleMute = useCallback(async () => {
    const track = localAudioRef.current;
    if (!track) return;
    await track.setEnabled(isMuted);
    setIsMuted((v) => !v);
  }, [isMuted]);

  const toggleCamera = useCallback(async () => {
    const track = localVideoRef.current;
    if (!track) return;
    await track.setEnabled(isCameraOff);
    setIsCameraOff((v) => !v);
  }, [isCameraOff]);

  const startScreenShare = useCallback(async () => {
    const client = clientRef.current;
    if (!client || isScreenSharing) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const screenTrack = await (AgoraRTC as any).createScreenVideoTrack({ encoderConfig: '1080p_1' });
      const track = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;
      screenTrackRef.current = track;
      setLocalScreenTrack(track);
      if (localVideoRef.current) {
        await client.unpublish(localVideoRef.current);
      }
      await client.publish(track);
      setIsScreenSharing(true);
      track.on('track-ended', () => {
        stopScreenShare();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Screen share failed');
    }
  }, [isScreenSharing]);

  const stopScreenShare = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !screenTrackRef.current) return;
    await client.unpublish(screenTrackRef.current);
    screenTrackRef.current.close();
    screenTrackRef.current = null;
    setLocalScreenTrack(null);
    if (localVideoRef.current) {
      await client.publish(localVideoRef.current);
    }
    setIsScreenSharing(false);
  }, []);

  const cleanup = useCallback(async () => {
    // Null ref first to prevent double-leave from useEffect cleanup on unmount
    const client = clientRef.current;
    clientRef.current = null;

    localAudioRef.current?.close();
    localVideoRef.current?.close();
    localAudioRef.current = null;
    localVideoRef.current = null;

    if (screenTrackRef.current) {
      screenTrackRef.current.close();
      screenTrackRef.current = null;
    }
    if (client) {
      try { await client.leave(); } catch { /* ignore */ }
    }
    setLocalVideoTrack(null);
    setLocalAudioTrack(null);
    setLocalScreenTrack(null);
    setLocalUid(null);
    setParticipants(new Map());
    setIsJoined(false);
  }, []);

  return {
    localVideoTrack,
    localAudioTrack,
    localScreenTrack,
    localUid,
    participants,
    isMuted,
    isCameraOff,
    isScreenSharing,
    isJoined,
    error,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    cleanup,
  };
}
