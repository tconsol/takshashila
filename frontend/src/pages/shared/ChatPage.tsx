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
        const s = await api.get('/students/my-students', { params: { limit: '100' } }).catch(() => null);
        (s?.data?.data?.items ?? []).forEach((p: { userPublicId: string; firstName?: string; lastName?: string; displayName?: string }) => {
          contacts.push({ userPublicId: p.userPublicId, displayName: p.displayName ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(), role: 'STUDENT' });
        });
        const pr = await api.get('/tutors/my-principal').catch(() => null);
        const principal = pr?.data?.data ?? pr?.data;
        if (principal?.userPublicId) {
          contacts.push({ userPublicId: principal.userPublicId, displayName: `${principal.firstName ?? ''} ${principal.lastName ?? ''}`.trim(), role: 'PRINCIPAL' });
        }
      }

      if (role === 'STUDENT') {
        const me = await api.get('/students/me').catch(() => null);
        const profile = me?.data?.data ?? me?.data;
        if (profile?.tutorPublicId) {
          const t = await api.get(`/tutors/${profile.tutorPublicId}`).catch(() => null);
          const tutor = t?.data?.data ?? t?.data;
          if (tutor?.userPublicId) {
            contacts.push({ userPublicId: tutor.userPublicId, displayName: tutor.displayName ?? '', role: 'TUTOR' });
          }
        }
        const pr = await api.get('/students/me/principal').catch(() => null);
        const principal = pr?.data?.data ?? pr?.data;
        if (principal?.userPublicId) {
          contacts.push({ userPublicId: principal.userPublicId, displayName: `${principal.firstName ?? ''} ${principal.lastName ?? ''}`.trim(), role: 'PRINCIPAL' });
        }
      }

      if (role === 'PRINCIPAL') {
        const t = await api.get('/tutors/my-tutors', { params: { limit: '100' } }).catch(() => null);
        (t?.data?.data?.items ?? []).forEach((p: { userPublicId: string; displayName?: string }) => {
          contacts.push({ userPublicId: p.userPublicId, displayName: p.displayName ?? '', role: 'TUTOR' });
        });
        const s = await api.get('/students/principal/my-students', { params: { limit: '100' } }).catch(() => null);
        (s?.data?.data?.items ?? []).forEach((p: { userPublicId: string; firstName?: string; lastName?: string; displayName?: string }) => {
          contacts.push({ userPublicId: p.userPublicId, displayName: p.displayName ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(), role: 'STUDENT' });
        });
      }

      if (role === 'PARENT') {
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

      return contacts;
    },
    staleTime: 5 * 60 * 1000,
  });
}

const ROLE_COLORS: Record<string, { bg: string; text: string; gradient: string }> = {
  TUTOR:       { bg: 'bg-sky-50',     text: 'text-sky-600',     gradient: 'from-sky-400 to-blue-500' },
  STUDENT:     { bg: 'bg-emerald-50', text: 'text-emerald-600', gradient: 'from-emerald-400 to-teal-500' },
  PRINCIPAL:   { bg: 'bg-violet-50',  text: 'text-violet-600',  gradient: 'from-violet-400 to-purple-500' },
  PARENT:      { bg: 'bg-pink-50',    text: 'text-pink-600',    gradient: 'from-pink-400 to-rose-500' },
  ADMIN:       { bg: 'bg-rose-50',    text: 'text-rose-600',    gradient: 'from-rose-400 to-red-500' },
  SUPER_ADMIN: { bg: 'bg-rose-50',    text: 'text-rose-600',    gradient: 'from-rose-400 to-red-500' },
  SUPPORT:     { bg: 'bg-amber-50',   text: 'text-amber-600',   gradient: 'from-amber-400 to-orange-500' },
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
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
              <MessageSquare className="h-4 w-4 text-indigo-600" />
            </div>
            <span className="font-semibold text-slate-900">New Conversation</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 flex-shrink-0 border-b border-slate-100">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-colors">
            <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search by name or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
            />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
              <MessageSquare className="h-8 w-8" />
              <p className="text-sm font-medium">No contacts found</p>
            </div>
          ) : (
            filtered.map((contact) => {
              const roleColor = ROLE_COLORS[contact.role] ?? { bg: 'bg-slate-100', text: 'text-slate-600', gradient: 'from-slate-400 to-slate-500' };
              const initials = contact.displayName.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
              return (
                <button
                  key={contact.userPublicId}
                  disabled={isPending}
                  onClick={() => handleStart(contact)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${roleColor.gradient} text-sm font-semibold text-white flex-shrink-0`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{contact.displayName || '—'}</p>
                    <p className={`text-[11px] font-medium capitalize ${roleColor.text}`}>{contact.role.toLowerCase().replace('_', ' ')}</p>
                  </div>
                  {starting === contact.userPublicId ? (
                    <Spinner />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white flex-shrink-0">
                      <Send className="h-3.5 w-3.5" />
                    </div>
                  )}
                </button>
              );
            })
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

  const activeConv = selected ?? (activeId ? conversations.find((c) => c.publicId === activeId) ?? null : null);
  const otherIdx = activeConv ? activeConv.participantPublicIds.findIndex((id) => id !== user?.publicId) : -1;
  const otherName = (otherIdx >= 0 ? activeConv?.participantNames?.[otherIdx] : '') ?? '';
  const otherRole = (otherIdx >= 0 ? activeConv?.participantRoles?.[otherIdx] : '') ?? '';

  return (
    <>
      <div className="flex h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Conversation list sidebar */}
        <div className="w-80 flex-shrink-0 border-r border-slate-200 flex flex-col overflow-hidden">
          {/* Sidebar header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
                <MessageSquare className="h-4 w-4 text-indigo-600" />
              </div>
              Messages
            </h2>
            <button
              onClick={handleNewChat}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <ConversationList selectedId={activeId} onSelect={handleSelect} onNewChat={handleNewChat} />
        </div>

        {/* Chat window */}
        <div className="flex-1 min-w-0 overflow-hidden bg-slate-50">
          {activeId ? (
            <ChatWindow
              conversationPublicId={activeId}
              otherName={otherName}
              otherRole={otherRole}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-5 px-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-50">
                <MessageSquare className="h-9 w-9 text-indigo-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-800">No conversation selected</p>
                <p className="text-xs text-slate-500 mt-1">Pick one from the list or start a new chat</p>
              </div>
              <button
                onClick={handleNewChat}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
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
