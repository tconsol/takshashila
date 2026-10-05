import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Users, ChevronRight, PinOff } from 'lucide-react';
import { useSocket } from '../../sockets/use-socket';
import { useClassSocket } from '../../sockets/class.socket';
import { useAgora } from '../../hooks/use-agora';
import { useWhiteboardSync } from '../../hooks/use-whiteboard-sync';
import { useAuthStore } from '../../stores/auth.store';
import { realtime } from '../../lib/realtime';
import { classesService } from '../../services/classes.service';
import type { PresenceProgress } from '../../services/classes.service';
import { useConfirm } from '../../hooks/use-confirm';
import { PRESENCE_HEARTBEAT_MS, isUnderRequired, leaveWarning } from './exit-rule';
import { SocketEvent } from '../../sockets/socket.events';
import { VideoGrid } from './VideoGrid';
import { ControlBar } from './ControlBar';
import { WhiteboardPanel } from './WhiteboardPanel';
import type { ClassChatMessage } from '../../sockets/socket.events';

/** How often a student's room page re-checks whether its class has ended. */
const CLASS_STATUS_POLL_MS = 8000;

export function ClassRoomPage() {
  const { classPublicId } = useParams<{ classPublicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const { confirm, confirmDialog } = useConfirm();

  const [messages, setMessages] = useState<ClassChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  // How long this person has been present against what the class needs (from the server's heartbeat reply).
  const [progress, setProgress] = useState<PresenceProgress | null>(null);
  // uid (string) → display name  e.g. "3645669908" → "Ravi Kumar (Tutor)"
  const [participantNames, setParticipantNames] = useState<Map<string, string>>(new Map());
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [handRaisedNotice, setHandRaisedNotice] = useState<string | null>(null);
  const [screenSharerUid, setScreenSharerUid] = useState<string | null>(null);
  // 'local' | remote uid | null. Survives presentation changes on purpose: a
  // deliberate pin should outrank someone starting to share.
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const handTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A group session's records share one room: the key tells which "class ended" news is about this room.
  const roomKeyRef = useRef<string | null>(null);
  const leavingRef = useRef(false);
  const progressRef = useRef<PresenceProgress | null>(null);
  const classEndRef = useRef<number | null>(null);
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
    classesService.join(classPublicId).then((cls) => {
      roomKeyRef.current = cls.groupPublicId ?? null;
      const end = Date.parse(cls.scheduledEndUTC);
      classEndRef.current = Number.isNaN(end) ? null : end;
      setJoined(true);
    }).catch((err) => {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to join class';
      setJoinError(msg);
    });
  }, [classPublicId]);

  // Presence: tell the server we are here every 30 s. It counts the time toward the required
  // attendance (a short gap still counts), and answers with how long we have been here.
  // Only the class's own tutor and student are counted; observers are not.
  useEffect(() => {
    if (!classPublicId || !joined || (user?.role !== 'TUTOR' && user?.role !== 'STUDENT')) return;
    const beat = () => {
      if (leavingRef.current) return;
      classesService.presence(classPublicId).then((p) => {
        if (!p) return;
        progressRef.current = p;
        setProgress(p);
      }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    // A background tab throttles timers: beat as soon as the tab is visible again.
    const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
    // Tab or window closed: the browser cannot tell that from a lost connection, so say goodbye while we can.
    const onPageHide = () => { if (!leavingRef.current) classesService.sendLeave(classPublicId); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [classPublicId, joined, user?.role]);

  // Closing the tab while still short of the required time: ask first. Browsers show their own
  // generic text here; a custom message is not allowed.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      if (isUnderRequired(progressRef.current, classEndRef.current)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

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
    // The same "class ended" news arrives over the class socket and over the broadcast layer
    // (Pusher), which also reaches us when another server instance handled the request.
    const onEnded = (p: { classPublicId?: string; roomPublicId?: string; status?: string }) => {
      if (p.status !== 'COMPLETED' && p.status !== 'CANCELLED' && p.status !== 'INCOMPLETE') return;
      const about = p.classPublicId === classPublicId
        || p.roomPublicId === classPublicId
        || (!!roomKeyRef.current && p.roomPublicId === roomKeyRef.current);
      if (!about || leavingRef.current) return;
      leavingRef.current = true;
      void handleLeave();
    };
    const unsubStatus = onStatusChanged(onEnded);
    const unsubRealtime = realtime.on('class:status-changed', (p) => onEnded(p as Parameters<typeof onEnded>[0]));
    return () => { unsubChat(); unsubStatus(); unsubRealtime(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChatMessage, onStatusChanged]);

  // Safety net: the "class ended" push can be missed (the request may be handled by another
  // server instance than the one holding this socket). So a student/observer also checks their
  // own class every few seconds. The tutor is not polled: in a group, one student's record
  // ending (e.g. they cancel) must not throw the tutor out of the room.
  useEffect(() => {
    if (!classPublicId || isTutor) return;
    const timer = setInterval(() => {
      if (leavingRef.current) return;
      classesService.getById(classPublicId).then((cls) => {
        if ((cls.status === 'COMPLETED' || cls.status === 'CANCELLED' || cls.status === 'INCOMPLETE') && !leavingRef.current) {
          leavingRef.current = true;
          void handleLeave();
        }
      }).catch(() => {});
    }, CLASS_STATUS_POLL_MS);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classPublicId, isTutor]);

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

  /** The Leave button: warns first when leaving now could cost this person. */
  async function handleLeaveClick() {
    if (leavingRef.current) return;
    const current = progressRef.current;
    if (current && isUnderRequired(current, classEndRef.current)) {
      const warning = leaveWarning(current, isTutor);
      const { confirmed } = await confirm({
        title: warning.title,
        message: warning.message,
        confirmLabel: 'Leave anyway',
        tone: 'danger',
      });
      if (!confirmed) return;
    }
    leavingRef.current = true;
    await handleLeave();
  }

  async function handleLeave() {
    if (classPublicId) classesService.sendLeave(classPublicId);
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
          {progress && (
            <span
              className={`hidden rounded-lg px-2.5 py-1.5 text-xs sm:inline ${
                progress.attendedMinutes >= progress.requiredMinutes
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-amber-500/15 text-amber-300'
              }`}
              title="Minutes you have been present, against the minutes this class needs"
            >
              {Math.floor(progress.attendedMinutes)} / {progress.requiredMinutes} min
            </span>
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
        onLeave={handleLeaveClick}
      />

      {confirmDialog}

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
