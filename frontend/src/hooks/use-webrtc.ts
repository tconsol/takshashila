import { useState, useRef, useCallback, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { SocketEvent } from '../sockets/socket.events';
import type { RtcPeerInfo, RtcOfferPayload, RtcAnswerPayload, RtcIceCandidatePayload } from '../sockets/socket.events';

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined;
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  }
  return servers;
}

const ICE_SERVERS = buildIceServers();

export interface RtcParticipant {
  socketId: string;
  userPublicId: string;
  role: string;
  stream: MediaStream | null;
}

export function useWebRTC(classPublicId: string | null, socket: Socket | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, RtcParticipant>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  const updateParticipant = useCallback((socketId: string, update: Partial<RtcParticipant>) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      const existing = next.get(socketId);
      if (existing) next.set(socketId, { ...existing, ...update });
      return next;
    });
  }, []);

  const createPeerConnection = useCallback(
    (remoteSocketId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.onicecandidate = ({ candidate }) => {
        if (candidate && socket) {
          socket.emit(SocketEvent.RTC_ICE_CANDIDATE, { to: remoteSocketId, candidate });
        }
      };

      pc.ontrack = ({ streams }) => {
        updateParticipant(remoteSocketId, { stream: streams[0] ?? null });
      };

      pc.onconnectionstatechange = async () => {
        if (pc.connectionState === 'failed' && socket && classPublicId) {
          try {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            socket.emit(SocketEvent.RTC_OFFER, { to: remoteSocketId, offer, classPublicId });
          } catch { /* ignore — peer may have left */ }
        }
      };

      pcsRef.current.set(remoteSocketId, pc);
      return pc;
    },
    [socket, classPublicId, updateParticipant],
  );

  const setLocalStreamAndRef = useCallback((stream: MediaStream | null) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
  }, []);

  // ─── Socket event handlers ────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !classPublicId) return;

    async function onPeerJoined(info: RtcPeerInfo) {
      setParticipants((prev) => {
        const next = new Map(prev);
        if (!next.has(info.socketId)) {
          next.set(info.socketId, { ...info, stream: null });
        }
        return next;
      });
      const pc = createPeerConnection(info.socketId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket!.emit(SocketEvent.RTC_OFFER, { to: info.socketId, offer, classPublicId });
      } catch { /* peer may have disconnected */ }
    }

    async function onOffer({ from, fromUserPublicId, offer }: RtcOfferPayload) {
      setParticipants((prev) => {
        const next = new Map(prev);
        if (!next.has(from)) {
          next.set(from, { socketId: from, userPublicId: fromUserPublicId, role: '', stream: null });
        }
        return next;
      });
      const pc = createPeerConnection(from);
      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket!.emit(SocketEvent.RTC_ANSWER, { to: from, answer });
      } catch { /* ignore */ }
    }

    async function onAnswer({ from, answer }: RtcAnswerPayload) {
      const pc = pcsRef.current.get(from);
      if (pc) {
        try { await pc.setRemoteDescription(answer); } catch { /* ignore */ }
      }
    }

    async function onIceCandidate({ from, candidate }: RtcIceCandidatePayload) {
      const pc = pcsRef.current.get(from);
      if (pc) {
        try { await pc.addIceCandidate(candidate); } catch { /* ignore */ }
      }
    }

    function onPeerLeft({ socketId }: { socketId: string }) {
      const pc = pcsRef.current.get(socketId);
      if (pc) {
        pc.close();
        pcsRef.current.delete(socketId);
      }
      setParticipants((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    }

    socket.on(SocketEvent.RTC_PEER_JOINED, onPeerJoined);
    socket.on(SocketEvent.RTC_OFFER, onOffer);
    socket.on(SocketEvent.RTC_ANSWER, onAnswer);
    socket.on(SocketEvent.RTC_ICE_CANDIDATE, onIceCandidate);
    socket.on(SocketEvent.RTC_PEER_LEFT, onPeerLeft);

    return () => {
      socket.off(SocketEvent.RTC_PEER_JOINED, onPeerJoined);
      socket.off(SocketEvent.RTC_OFFER, onOffer);
      socket.off(SocketEvent.RTC_ANSWER, onAnswer);
      socket.off(SocketEvent.RTC_ICE_CANDIDATE, onIceCandidate);
      socket.off(SocketEvent.RTC_PEER_LEFT, onPeerLeft);
    };
  }, [socket, classPublicId, createPeerConnection]);

  // ─── Controls ─────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = isMuted;
    });
    setIsMuted((prev) => !prev);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = isCameraOff;
    });
    setIsCameraOff((prev) => !prev);
  }, [isCameraOff]);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const videoTrack = screenStream.getVideoTracks()[0];
      screenTrackRef.current = videoTrack;

      pcsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });

      const oldTrack = localStreamRef.current?.getVideoTracks()[0];
      if (localStreamRef.current && oldTrack) {
        localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(videoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      setIsScreenSharing(true);

      videoTrack.onended = stopScreenShare;
    } catch { /* user cancelled */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopScreenShare = useCallback(async () => {
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;

    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const camTrack = camStream.getVideoTracks()[0];

      pcsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(camTrack);
      });

      if (localStreamRef.current) {
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(camTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
    } catch { /* ignore */ }

    setIsScreenSharing(false);
  }, []);

  const cleanup = useCallback(() => {
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setParticipants(new Map());
    if (socket && classPublicId) {
      socket.emit(SocketEvent.RTC_LEAVE, classPublicId);
    }
  }, [socket, classPublicId]);

  return {
    localStream,
    participants,
    isMuted,
    isCameraOff,
    isScreenSharing,
    setLocalStream: setLocalStreamAndRef,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    cleanup,
  };
}
