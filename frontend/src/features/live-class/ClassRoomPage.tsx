import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Users, ChevronRight } from 'lucide-react';
import { useSocket } from '../../sockets/use-socket';
import { useClassSocket } from '../../sockets/class.socket';
import { useAgora } from '../../hooks/use-agora';
import { useWhiteboardSync } from '../../hooks/use-whiteboard-sync';
import { useAuthStore } from '../../stores/auth.store';
import { classesService } from '../../services/classes.service';
import { SocketEvent } from '../../sockets/socket.events';
import { VideoGrid } from './VideoGrid';
import { ControlBar } from './ControlBar';
import { WhiteboardPanel } from './WhiteboardPanel';
import type { ClassChatMessage } from '../../sockets/socket.events';

export function ClassRoomPage() {
  const { classPublicId } = useParams<{ classPublicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { socket } = useSocket();

  const [messages, setMessages] = useState<ClassChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  // uid (string) → display name  e.g. "3645669908" → "Ravi Kumar (Tutor)"
  const [participantNames, setParticipantNames] = useState<Map<string, string>>(new Map());
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [handRaisedNotice, setHandRaisedNotice] = useState<string | null>(null);
  const [screenSharerUid, setScreenSharerUid] = useState<string | null>(null);
  const handTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isTutor = user?.role === 'TUTOR';
  const myFullName = user ? `${user.firstName} ${user.lastName}`.trim() : 'You';

  const { sendChatMessage, raiseHand, onChatMessage, onStatusChanged } = useClassSocket(
    classPublicId ?? null,
    myFullName,
  );

  const agora = useAgora(classPublicId ?? null);
  const { remoteElements, broadcastUpdate } = useWhiteboardSync(classPublicId ?? null, socket ?? null);

  // Auto-join: transitions SCHEDULED → LIVE, no-op if already LIVE
  useEffect(() => {
    if (!classPublicId) return;
    classesService.join(classPublicId).catch((err) => {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to join class';
      setJoinError(msg);
    });
  }, [classPublicId]);

  // When we get our own Agora UID, broadcast our name to others in the room
  useEffect(() => {
    if (!socket || !classPublicId || !agora.localUid) return;
    socket.emit(SocketEvent.CLASS_ANNOUNCE, {
      classPublicId,
      agoraUid: agora.localUid,
      name: myFullName,
      role: user?.role ?? '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora.localUid, socket, classPublicId]);

  // Listen for other participants' name announcements
  useEffect(() => {
    if (!socket) return;
    const handler = ({ agoraUid, name, role }: { agoraUid: number; name: string; role: string }) => {
      setParticipantNames((prev) => {
        const next = new Map(prev);
        next.set(String(agoraUid), `${name} (${role.charAt(0) + role.slice(1).toLowerCase()})`);
        return next;
      });
    };
    socket.on(SocketEvent.CLASS_ANNOUNCE, handler);
    return () => { socket.off(SocketEvent.CLASS_ANNOUNCE, handler); };
  }, [socket]);

  // Re-announce ourselves whenever a new Agora participant joins so late-joiners get our name
  useEffect(() => {
    if (!socket || !classPublicId || !agora.localUid || agora.participants.size === 0) return;
    socket.emit(SocketEvent.CLASS_ANNOUNCE, {
      classPublicId,
      agoraUid: agora.localUid,
      name: myFullName,
      role: user?.role ?? '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora.participants.size]);

  // Listen for hand-raise events from other participants
  useEffect(() => {
    if (!socket) return;
    const handler = ({ userPublicId }: { userPublicId: string }) => {
      const name = participantNames.get(userPublicId) ?? 'A participant';
      setHandRaisedNotice(`${name} raised their hand ✋`);
      if (handTimerRef.current) clearTimeout(handTimerRef.current);
      handTimerRef.current = setTimeout(() => setHandRaisedNotice(null), 4000);
    };
    socket.on(SocketEvent.CLASS_HAND_RAISED, handler);
    return () => { socket.off(SocketEvent.CLASS_HAND_RAISED, handler); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, participantNames]);

  // Listen for remote screen share start/stop → update spotlight
  useEffect(() => {
    if (!socket) return;
    const handler = ({ agoraUid, active }: { agoraUid: number; active: boolean }) => {
      setScreenSharerUid(active ? String(agoraUid) : null);
    };
    socket.on(SocketEvent.CLASS_SCREEN_SHARE, handler);
    return () => { socket.off(SocketEvent.CLASS_SCREEN_SHARE, handler); };
  }, [socket]);

  useEffect(() => {
    const unsubChat = onChatMessage((msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    const unsubStatus = onStatusChanged(({ status }) => {
      if (status === 'COMPLETED' || status === 'CANCELLED') handleLeave();
    });
    return () => { unsubChat(); unsubStatus(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChatMessage, onStatusChanged]);

  function handleSend() {
    if (!input.trim()) return;
    sendChatMessage(input.trim());
    setInput('');
  }

  async function handleStartScreenShare() {
    await agora.startScreenShare();
    setScreenSharerUid('local');
    socket?.emit(SocketEvent.CLASS_SCREEN_SHARE, { classPublicId, agoraUid: agora.localUid, active: true });
  }

  async function handleStopScreenShare() {
    await agora.stopScreenShare();
    setScreenSharerUid(null);
    socket?.emit(SocketEvent.CLASS_SCREEN_SHARE, { classPublicId, agoraUid: agora.localUid, active: false });
  }

  function handleRaiseHand() {
    if (isHandRaised) {
      setIsHandRaised(false);
    } else {
      raiseHand();
      setIsHandRaised(true);
      if (handTimerRef.current) clearTimeout(handTimerRef.current);
      handTimerRef.current = setTimeout(() => setIsHandRaised(false), 12000);
    }
  }

  async function handleLeave() {
    await agora.cleanup();
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    const dashPath =
      user?.role === 'TUTOR' ? '/dashboard/tutor' :
      user?.role === 'STUDENT' ? '/dashboard/student' :
      '/dashboard';
    navigate(dashPath, { replace: true });
  }

  const participantCount = 1 + agora.participants.size;

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
          <span className="text-sm font-medium text-gray-200">Live Class</span>
          {!agora.isJoined && !agora.error && (
            <span className="text-xs text-amber-400 animate-pulse">Connecting…</span>
          )}
          {handRaisedNotice && (
            <span className="flex items-center gap-1.5 rounded-full bg-yellow-500/20 px-2.5 py-1 text-xs font-medium text-yellow-400 animate-pulse">
              {handRaisedNotice}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {(agora.error || joinError) && (
            <span className="text-xs text-amber-400">{agora.error ?? joinError}</span>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Users className="h-3.5 w-3.5" />
            <span>{participantCount}</span>
          </div>
          <button
            onClick={() => setIsChatOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
            <ChevronRight className={`h-3 w-3 transition-transform ${isChatOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Video area */}
        <div className="flex-1 bg-gray-950 overflow-hidden min-h-0">
          <VideoGrid
            localVideoTrack={agora.localVideoTrack}
            localScreenTrack={agora.localScreenTrack}
            localLabel={myFullName}
            participants={agora.participants}
            participantNames={participantNames}
            isMuted={agora.isMuted}
            isCameraOff={agora.isCameraOff}
            isScreenSharing={agora.isScreenSharing}
            screenSharerUid={screenSharerUid}
          />
        </div>

        {/* Chat panel */}
        {isChatOpen && (
          <div className="flex w-72 shrink-0 flex-col bg-gray-900 border-l border-gray-800 min-h-0">
            <div className="px-4 py-2.5 border-b border-gray-800 text-xs font-semibold text-gray-400 flex items-center gap-1.5 shrink-0">
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {messages.length === 0 && (
                <p className="text-center text-xs text-gray-600 mt-6">No messages yet</p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${m.from === user?.publicId ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-gray-500 mb-0.5">{m.name || m.role}</span>
                  <div
                    className={`max-w-[200px] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.from === user?.publicId
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-800 text-gray-200'
                    }`}
                  >
                    {m.message}
                  </div>
                  <span className="text-[9px] text-gray-600 mt-0.5">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2 border-t border-gray-800 p-3 shrink-0">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type a message…"
                className="flex-1 rounded-xl bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                onClick={handleSend}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 hover:bg-brand-700 transition-colors shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Control bar */}
      <ControlBar
        classPublicId={classPublicId ?? ''}
        isMuted={agora.isMuted}
        isCameraOff={agora.isCameraOff}
        isScreenSharing={agora.isScreenSharing}
        isWhiteboardOpen={isWhiteboardOpen}
        isTutor={isTutor}
        localVideoTrack={agora.localVideoTrack}
        localAudioTrack={agora.localAudioTrack}
        onToggleMute={agora.toggleMute}
        onToggleCamera={agora.toggleCamera}
        onStartScreenShare={handleStartScreenShare}
        onStopScreenShare={handleStopScreenShare}
        onToggleWhiteboard={() => setIsWhiteboardOpen((v) => !v)}
        onRaiseHand={handleRaiseHand}
        isHandRaised={isHandRaised}
        onLeave={handleLeave}
      />

      {isWhiteboardOpen && (
        <WhiteboardPanel
          remoteElements={remoteElements}
          onUpdate={broadcastUpdate}
          onClose={() => setIsWhiteboardOpen(false)}
        />
      )}
    </div>
  );
}
