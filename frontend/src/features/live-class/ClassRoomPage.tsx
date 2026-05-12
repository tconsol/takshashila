import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Hand, MessageSquare, LogOut, Send } from 'lucide-react';
import { useClassSocket } from '../../sockets/class.socket';
import { useAuthStore } from '../../stores/auth.store';
import type { ClassChatMessage } from '../../sockets/socket.events';

export function ClassRoomPage() {
  const { classPublicId } = useParams<{ classPublicId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ClassChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { sendChatMessage, raiseHand, onChatMessage, onStatusChanged } = useClassSocket(classPublicId ?? null);

  useEffect(() => {
    const unsubChat = onChatMessage((msg) => {
      setMessages((prev) => [...prev, msg]);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    const unsubStatus = onStatusChanged(({ status }) => {
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        navigate(-1);
      }
    });
    return () => { unsubChat(); unsubStatus(); };
  }, [onChatMessage, onStatusChanged, navigate]);

  function handleSend() {
    if (!input.trim()) return;
    sendChatMessage(input.trim());
    setInput('');
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium">Live Class</span>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Leave
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 bg-gray-900 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Video stream placeholder</p>
          </div>

          <div className="w-80 flex flex-col bg-gray-800 border-l border-gray-700">
            <div className="px-4 py-2 border-b border-gray-700 text-xs font-medium text-gray-400 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Chat
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.from === user?.publicId ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-gray-400 mb-0.5">{m.role}</span>
                  <div className={`max-w-[200px] rounded-lg px-3 py-2 text-sm ${m.from === user?.publicId ? 'bg-blue-600' : 'bg-gray-700'}`}>
                    {m.message}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="px-3 py-3 border-t border-gray-700 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message…"
                className="flex-1 rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleSend}
                className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 py-3 bg-gray-800 border-t border-gray-700">
          <button
            onClick={raiseHand}
            className="flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300"
          >
            <Hand className="h-4 w-4" /> Raise Hand
          </button>
        </div>
      </div>
    </div>
  );
}
