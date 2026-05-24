import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, Search, X, Send } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth.store';
import { ConversationList } from '../../features/chat/ConversationList';
import { ChatWindow } from '../../features/chat/ChatWindow';
import { useConversations, useStartConversation } from '../../features/chat/use-chat';
import { Spinner } from '../../components/ui/Loading';
import { api } from '../../lib/axios';
import type { IConversation } from '../../features/chat/chat.types';

interface Contact {
  userPublicId: string;
  displayName: string;
  role: string;
}

function useContacts() {
  const { user } = useAuthStore();
  const role = user?.role ?? '';

  return useQuery<Contact[]>({
    queryKey: ['chat', 'contacts', role],
    queryFn: async () => {
      const contacts: Contact[] = [];

      if (role === 'TUTOR') {
        // My students
        const s = await api.get('/students/my-students', { params: { limit: '100' } }).catch(() => null);
        (s?.data?.data?.items ?? []).forEach((p: { userPublicId: string; firstName?: string; lastName?: string; displayName?: string }) => {
          contacts.push({ userPublicId: p.userPublicId, displayName: p.displayName ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(), role: 'STUDENT' });
        });
        // My principal
        const pr = await api.get('/tutors/my-principal').catch(() => null);
        const principal = pr?.data?.data ?? pr?.data;
        if (principal?.userPublicId) {
          contacts.push({ userPublicId: principal.userPublicId, displayName: `${principal.firstName ?? ''} ${principal.lastName ?? ''}`.trim(), role: 'PRINCIPAL' });
        }
      }

      if (role === 'STUDENT') {
        // My tutor
        const me = await api.get('/students/me').catch(() => null);
        const profile = me?.data?.data ?? me?.data;
        if (profile?.tutorPublicId) {
          const t = await api.get(`/tutors/${profile.tutorPublicId}`).catch(() => null);
          const tutor = t?.data?.data ?? t?.data;
          if (tutor?.userPublicId) {
            contacts.push({ userPublicId: tutor.userPublicId, displayName: tutor.displayName ?? '', role: 'TUTOR' });
          }
        }
        // My principal
        const pr = await api.get('/students/me/principal').catch(() => null);
        const principal = pr?.data?.data ?? pr?.data;
        if (principal?.userPublicId) {
          contacts.push({ userPublicId: principal.userPublicId, displayName: `${principal.firstName ?? ''} ${principal.lastName ?? ''}`.trim(), role: 'PRINCIPAL' });
        }
      }

      if (role === 'PRINCIPAL') {
        // My tutors
        const t = await api.get('/tutors/my-tutors', { params: { limit: '100' } }).catch(() => null);
        (t?.data?.data?.items ?? []).forEach((p: { userPublicId: string; displayName?: string }) => {
          contacts.push({ userPublicId: p.userPublicId, displayName: p.displayName ?? '', role: 'TUTOR' });
        });
        // My students
        const s = await api.get('/students/principal/my-students', { params: { limit: '100' } }).catch(() => null);
        (s?.data?.data?.items ?? []).forEach((p: { userPublicId: string; firstName?: string; lastName?: string; displayName?: string }) => {
          contacts.push({ userPublicId: p.userPublicId, displayName: p.displayName ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(), role: 'STUDENT' });
        });
      }

      if (role === 'PARENT') {
        // Children and their tutors
        const ch = await api.get('/parents/me/children').catch(() => null);
        const children = ch?.data?.data ?? [];
        for (const child of children) {
          if (child.tutorPublicId) {
            const t = await api.get(`/tutors/${child.tutorPublicId}`).catch(() => null);
            const tutor = t?.data?.data ?? t?.data;
            if (tutor?.userPublicId && !contacts.find((c) => c.userPublicId === tutor.userPublicId)) {
              contacts.push({ userPublicId: tutor.userPublicId, displayName: tutor.displayName ?? '', role: 'TUTOR' });
            }
          }
        }
      }

      if (['ADMIN', 'SUPER_ADMIN', 'SUPPORT'].includes(role)) {
        // admins see all — handled by search below; return empty initial list
      }

      return contacts;
    },
    staleTime: 5 * 60 * 1000,
  });
}

const ROLE_COLORS: Record<string, string> = {
  TUTOR: 'bg-clay-sky/30',
  STUDENT: 'bg-clay-mint/30',
  PRINCIPAL: 'bg-clay-purple/30',
  PARENT: 'bg-clay-yellow/30',
  ADMIN: 'bg-clay-coral/30',
  SUPER_ADMIN: 'bg-clay-coral/30',
  SUPPORT: 'bg-clay-yellow/30',
};

function NewChatModal({ onClose, onStarted }: { onClose: () => void; onStarted: (conv: IConversation) => void }) {
  const [search, setSearch] = useState('');
  const { data: contacts = [], isLoading } = useContacts();
  const { mutateAsync: startConversation, isPending } = useStartConversation();
  const [starting, setStarting] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.displayName.toLowerCase().includes(q) || c.role.toLowerCase().includes(q),
    );
  }, [contacts, search]);

  async function handleStart(contact: Contact) {
    setStarting(contact.userPublicId);
    try {
      const conv = await startConversation({ recipientPublicId: contact.userPublicId, recipientRole: contact.role });
      onStarted(conv);
    } finally {
      setStarting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border-2.5 border-clay-ink bg-white shadow-clay flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-clay-ink bg-clay-mint rounded-t-[26px] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-clay-ink bg-white">
              <MessageSquare className="h-4 w-4 text-clay-ink" />
            </div>
            <span className="font-extrabold text-clay-ink">New Conversation</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-clay-ink bg-clay-coral hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
          >
            <X className="h-4 w-4 text-clay-ink" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 flex-shrink-0 border-b border-clay-ink/10">
          <div className="flex items-center gap-2 rounded-xl border-2 border-clay-ink/30 bg-clay-bg px-3 py-2 focus-within:border-clay-ink transition-colors">
            <Search className="h-4 w-4 text-clay-ink/40 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search by name or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm font-semibold text-clay-ink placeholder-clay-ink/40 outline-none"
            />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-clay-ink/40">
              <MessageSquare className="h-8 w-8" />
              <p className="text-sm font-extrabold">No contacts found</p>
            </div>
          ) : (
            filtered.map((contact) => (
              <button
                key={contact.userPublicId}
                disabled={isPending}
                onClick={() => handleStart(contact)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-clay-bg transition-colors text-left"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-clay-ink text-sm font-extrabold text-clay-ink flex-shrink-0 ${ROLE_COLORS[contact.role] ?? 'bg-clay-surface'}`}>
                  {contact.displayName.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-clay-ink truncate">{contact.displayName || '—'}</p>
                  <p className="text-[11px] font-extrabold text-clay-green-dark capitalize">{contact.role.toLowerCase().replace('_', ' ')}</p>
                </div>
                {starting === contact.userPublicId ? (
                  <Spinner />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-clay-ink bg-clay-green text-white flex-shrink-0">
                    <Send className="h-3.5 w-3.5" />
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<IConversation | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);

  const { data: conversations = [] } = useConversations();

  // Auto-resolve conversation from URL param once conversations load
  useEffect(() => {
    if (conversationId && !selected && conversations.length > 0) {
      const match = conversations.find((c) => c.publicId === conversationId);
      if (match) setSelected(match);
    }
  }, [conversationId, conversations, selected]);

  const activeId = selected?.publicId ?? conversationId ?? null;

  function handleSelect(conv: IConversation) {
    setSelected(conv);
    navigate(`/chat/${conv.publicId}`, { replace: true });
  }

  function handleNewChat() {
    setShowNewChat(true);
  }

  function handleStarted(conv: IConversation) {
    setShowNewChat(false);
    handleSelect(conv);
  }

  // Derive other party info — from selected state OR from conversations list (URL param case)
  const activeConv = selected ?? (activeId ? conversations.find((c) => c.publicId === activeId) ?? null : null);
  const otherIdx = activeConv ? activeConv.participantPublicIds.findIndex((id) => id !== user?.publicId) : -1;
  const otherName = (otherIdx >= 0 ? activeConv?.participantNames?.[otherIdx] : '') ?? '';
  const otherRole = (otherIdx >= 0 ? activeConv?.participantRoles?.[otherIdx] : '') ?? '';

  return (
    <>
      <div className="flex h-full overflow-hidden rounded-[28px] border-2.5 border-clay-ink bg-white dark:bg-gray-900 shadow-clay">
        {/* Conversation list sidebar */}
        <div className="w-80 flex-shrink-0 border-r-2.5 border-clay-ink flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 px-4 py-3 border-b-2.5 border-clay-ink bg-clay-mint flex items-center justify-between">
            <h2 className="font-extrabold text-clay-ink flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-clay-ink bg-white">
                <MessageSquare className="h-4 w-4 text-clay-ink" />
              </div>
              Messages
            </h2>
            <button
              onClick={handleNewChat}
              className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-clay-ink bg-clay-green text-white hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <ConversationList selectedId={activeId} onSelect={handleSelect} onNewChat={handleNewChat} />
        </div>

        {/* Chat window */}
        <div className="flex-1 min-w-0 overflow-hidden bg-clay-bg">
          {activeId ? (
            <ChatWindow
              conversationPublicId={activeId}
              otherName={otherName}
              otherRole={otherRole}
            />
          ) : (
            /* Empty state */
            <div className="flex h-full flex-col items-center justify-center gap-5 text-clay-ink px-8">
              <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border-2.5 border-clay-ink bg-clay-mint shadow-clay">
                <MessageSquare className="h-11 w-11 text-clay-ink" />
              </div>
              <div className="text-center">
                <p className="text-base font-extrabold text-clay-ink">No conversation selected</p>
                <p className="text-xs font-semibold text-clay-ink/50 mt-1">Pick one from the list or start a new chat</p>
              </div>
              <button
                onClick={handleNewChat}
                className="flex items-center gap-2 rounded-[18px] border-2.5 border-clay-ink bg-clay-green px-5 py-2.5 text-sm font-extrabold text-white shadow-clay-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-clay-pressed transition-all"
              >
                <Plus className="h-4 w-4" />
                Start New Chat
              </button>
            </div>
          )}
        </div>
      </div>

      {showNewChat && (
        <NewChatModal onClose={() => setShowNewChat(false)} onStarted={handleStarted} />
      )}
    </>
  );
}
