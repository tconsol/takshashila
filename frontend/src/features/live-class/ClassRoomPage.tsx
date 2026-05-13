import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Users, ChevronRight } from 'lucide-react';
import { useSocket } from '../../sockets/use-socket';
import { useClassSocket } from '../../sockets/class.socket';
import { useWebRTC } from '../../hooks/use-webrtc';
import { useWhiteboardSync } from '../../hooks/use-whiteboard-sync';
import { useAuthStore } from '../../stores/auth.store';
import { SocketEvent } from '../../sockets/socket.events';
import { VideoGrid } from './VideoGrid';
import { ControlBar } from './ControlBar';
import { WhiteboardPanel } from './WhiteboardPanel';
import type { ClassChatMessage } from '../../sockets/socket.events';
import type { RtcParticipant } from '../../hooks/use-webrtc';

export function ClassRoomPage() {
  const { classPublicId } = useParams<{ classPublicId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { socket } = useSocket();

  const [messages, setMessages] = useState<ClassChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isTutor = user?.role === 'TUTOR';

  const { sendChatMessage, raiseHand, onChatMessage, onStatusChanged } = useClassSocket(
    classPublicId ?? null,
  );

  const webrtc = useWebRTC(classPublicId ?? null, socket ?? null);
  const { remoteElements, broadcastUpdate } = useWhiteboardSync(classPublicId ?? null, socket ?? null);

  // Initialize media then signal readiness
  useEffect(() => {
    if (!socket || !classPublicId || isInitialized) return;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        webrtc.setLocalStream(stream);
        socket!.emit(SocketEvent.RTC_READY, { classPublicId });
        setIsInitialized(true);
      } catch {
        setMediaError('Camera or microphone permission denied. You can still chat.');
        socket!.emit(SocketEvent.RTC_READY, { classPublicId });
        setIsInitialized(true);
      }
    }

    init();
    return () => { webrtc.cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, classPublicId]);

  // Chat + status listeners
  useEffect(() => {
    const unsubChat = onChatMessage((msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    const unsubStatus = onStatusChanged(({ status }) => {
      if (status === 'COMPLETED' || status === 'CANCELLED') navigate(-1);
    });
    return () => { unsubChat(); unsubStatus(); };
  }, [onChatMessage, onStatusChanged, navigate]);

  function handleSend() {
    if (!input.trim()) return;
    sendChatMessage(input.trim());
    setInput('');
  }

  function handleLeave() {
    webrtc.cleanup();
    navigate(-1);
  }

  function getParticipantLabel(p: RtcParticipant): string {
    return p.role === 'TUTOR' ? 'Tutor' : p.role === 'STUDENT' ? 'Student' : p.userPublicId.slice(0, 8);
  }

  const remoteStreams = Array.from(webrtc.participants.values())
    .map((p) => p.stream)
    .filter((s): s is MediaStream => s !== null);

  const participantCount = 1 + webrtc.participants.size;

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
        </div>
        <div className="flex items-center gap-3">
          {mediaError && (
            <span className="text-xs text-amber-400">{mediaError}</span>
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
      <div className="flex flex-1 overflow-hidden">

        {/* Video area */}
        <div className="flex-1 bg-gray-950 overflow-hidden">
          <VideoGrid
            localStream={webrtc.localStream}
            localLabel={user ? `${user.firstName} ${user.lastName}`.trim() : 'You'}
            participants={webrtc.participants}
            isMuted={webrtc.isMuted}
            isCameraOff={webrtc.isCameraOff}
            getParticipantLabel={getParticipantLabel}
          />
        </div>

        {/* Chat panel */}
        {isChatOpen && (
          <div className="flex w-72 shrink-0 flex-col bg-gray-900 border-l border-gray-800">
            <div className="px-4 py-2.5 border-b border-gray-800 text-xs font-semibold text-gray-400 flex items-center gap-1.5">
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
                  <span className="text-[10px] text-gray-500 mb-0.5 capitalize">{m.role.toLowerCase()}</span>
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

            <div className="flex gap-2 border-t border-gray-800 p-3">
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
        isMuted={webrtc.isMuted}
        isCameraOff={webrtc.isCameraOff}
        isScreenSharing={webrtc.isScreenSharing}
        isWhiteboardOpen={isWhiteboardOpen}
        isTutor={isTutor}
        localStream={webrtc.localStream}
        remoteStreams={remoteStreams}
        socket={socket ?? null}
        onToggleMute={webrtc.toggleMute}
        onToggleCamera={webrtc.toggleCamera}
        onStartScreenShare={webrtc.startScreenShare}
        onStopScreenShare={webrtc.stopScreenShare}
        onToggleWhiteboard={() => setIsWhiteboardOpen((v) => !v)}
        onRaiseHand={raiseHand}
        onLeave={handleLeave}
      />

      {/* Whiteboard overlay */}
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
