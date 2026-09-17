import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Users, ChevronRight, PinOff } from 'lucide-react';
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
  // 'local' | remote uid | null. Survives presentation changes on purpose: a
  // deliberate pin should outrank someone starting to share.
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
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
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-white">

      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-neutral-900/80 px-5 py-2.5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            LIVE
          </span>
          <span className="truncate text-sm font-medium text-neutral-200">Live Class</span>
          {!agora.isJoined && !agora.error && (
            <span className="animate-pulse text-xs text-amber-400">Connecting…</span>
          )}
          {handRaisedNotice && (
            <span className="hidden animate-pulse items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 sm:flex">
              {handRaisedNotice}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {(agora.error || joinError) && (
            <span className="hidden max-w-[28ch] truncate text-xs text-amber-400 md:inline">
              {agora.error ?? joinError}
            </span>
          )}
          {pinnedKey && (
            <button
              onClick={() => setPinnedKey(null)}
              className="flex items-center gap-1.5 rounded-lg bg-sky-500/15 px-2.5 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/25"
            >
              <PinOff className="h-3.5 w-3.5" />
              Unpin
            </button>
          )}
          <span className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300">
            <Users className="h-3.5 w-3.5" />
            {participantCount}
          </span>
          <button
            onClick={() => setIsChatOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Chat</span>
            <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${isChatOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Video area */}
        <div className="min-h-0 flex-1 overflow-hidden">
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
            speakingUids={agora.speakingUids}
            localUid={agora.localUid}
            pinnedKey={pinnedKey}
            onTogglePin={(key) => setPinnedKey((cur) => (cur === key ? null : key))}
          />
        </div>

        {/* Chat panel */}
        {isChatOpen && (
          <aside className="flex min-h-0 w-full max-w-[20rem] shrink-0 flex-col border-l border-white/10 bg-neutral-900">
            <div className="flex shrink-0 items-center gap-1.5 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              <MessageSquare className="h-3.5 w-3.5" />
              In-class chat
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <p className="mt-8 text-center text-xs text-neutral-600">
                  No messages yet — say hello.
                </p>
              )}
              {messages.map((m, i) => {
                const mine = m.from === user?.publicId;
                return (
                  <div key={i} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!mine && (
                      <span className="mb-1 text-[10px] font-medium text-neutral-500">
                        {m.name || m.role}
                      </span>
                    )}
                    <div
                      className={`max-w-[15rem] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        mine
                          ? 'rounded-br-md bg-sky-600 text-white'
                          : 'rounded-bl-md bg-white/5 text-neutral-200 ring-1 ring-white/10'
                      }`}
                    >
                      {m.message}
                    </div>
                    <span className="mt-1 text-[9px] text-neutral-600">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="flex shrink-0 gap-2 border-t border-white/10 p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type a message…"
                className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 outline-none transition placeholder:text-neutral-500 focus:ring-2 focus:ring-sky-500"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 transition-colors hover:bg-sky-500 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Control bar */}
      <ControlBar
        isMuted={agora.isMuted}
        isCameraOff={agora.isCameraOff}
        isScreenSharing={agora.isScreenSharing}
        isWhiteboardOpen={isWhiteboardOpen}
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
