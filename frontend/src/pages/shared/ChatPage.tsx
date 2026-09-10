import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, Search, X, Users, Send } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth.store';
import { ConversationList } from '../../features/chat/ConversationList';
import { ChatWindow } from '../../features/chat/ChatWindow';
import { useConversations, useStartConversation } from '../../features/chat/use-chat';
import { Spinner } from '../../components/ui/Loading';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
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

      if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SUPPORT') {
        // Admin sees all users via search contacts are fetched dynamically per query
        // Return empty here; admin uses AdminNewChatModal with live search instead
        return contacts;
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

// ── Admin: live search across all platform users ──────────────────────────────
function AdminNewChatModal({ onClose, onStarted }: { onClose: () => void; onStarted: (conv: IConversation) => void }) {
  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const { mutateAsync: startConversation } = useStartConversation();
  const [starting, setStarting] = useState<string | null>(null);

  // Debounce input 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: results = [], isFetching } = useQuery<Contact[]>({
    queryKey: ['admin-user-search', debouncedQ],
    queryFn: async () => {
      if (debouncedQ.length < 2) return [];
      const { data } = await api.get('/users/search', { params: { q: debouncedQ } });
      return (data?.data ?? []).map((u: { publicId: string; firstName?: string; lastName?: string; email?: string; role: string; studentId?: string }) => ({
        userPublicId: u.publicId,
        displayName: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || u.studentId || u.publicId.slice(0, 8),
        role: u.role,
        email: u.email,
      }));
    },
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  });

  async function handleStart(contact: Contact) {
    setStarting(contact.userPublicId);
    try {
      const conv = await startConversation({ recipientPublicId: contact.userPublicId, recipientRole: contact.role });
      onStarted(conv);
    } finally {
      setStarting(null);
    }
  }

  const showEmpty = debouncedQ.length >= 2 && !isFetching && results.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-md bg-surface border border-rule shadow-pop flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded border border-rule bg-surface-sunk text-accent">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-ink text-sm">Message Any User</p>
              <p className="text-xs text-ink-muted">Search across all platform users</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded border border-rule bg-surface-sunk text-ink-muted hover:bg-danger-wash hover:text-danger hover:border-danger/35 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 flex-shrink-0 border-b border-rule">
          <div className="flex items-center gap-2 rounded border border-rule bg-surface-sunk px-3 py-2 transition-colors focus-within:border-accent">
            <Search className="h-4 w-4 text-ink-faint flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search by name, email or student ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-ink-2 placeholder-ink-faint outline-none"
            />
            {isFetching && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />}
          </div>
          {debouncedQ.length < 2 && (
            <p className="mt-2 text-xs text-ink-faint text-center">Type at least 2 characters to search</p>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {showEmpty ? (
            <div className="py-10 text-center">
              <Users className="h-8 w-8 mx-auto text-ink-faint mb-2" />
              <p className="text-sm text-ink-muted">No users found for "{debouncedQ}"</p>
            </div>
          ) : (
            <ul className="divide-y divide-rule">
              {results.map((c) => {
                const isStarting = starting === c.userPublicId;
                return (
                  <li key={c.userPublicId}>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
                      onClick={() => handleStart(c)}
                      disabled={!!starting}
                    >
                      <Avatar name={c.displayName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{c.displayName}</p>
                        {(c as Contact & { email?: string }).email && (
                          <p className="text-xs text-ink-faint truncate">{(c as Contact & { email?: string }).email}</p>
                        )}
                      </div>
                      <Badge size="sm">{c.role.replace('_', ' ')}</Badge>
                      {isStarting && <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-md bg-surface border border-rule shadow-pop flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded border border-rule bg-surface-sunk text-accent">
              <MessageSquare className="h-4 w-4" />
            </div>
            <span className="font-semibold text-ink">New Conversation</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded border border-rule bg-surface-sunk text-ink-muted hover:bg-danger-wash hover:text-danger hover:border-danger/35 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 flex-shrink-0 border-b border-rule">
          <div className="flex items-center gap-2 rounded border border-rule bg-surface-sunk px-3 py-2 transition-colors focus-within:border-accent">
            <Search className="h-4 w-4 text-ink-faint flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search by name or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-ink-2 placeholder-ink-faint outline-none"
            />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-ink-faint">
              <MessageSquare className="h-8 w-8" />
              <p className="text-sm font-medium">No contacts found</p>
            </div>
          ) : (
            filtered.map((contact) => (
              <button
                key={contact.userPublicId}
                disabled={isPending}
                onClick={() => handleStart(contact)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
              >
                <Avatar name={contact.displayName || contact.role} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{contact.displayName || ''}</p>
                  <p className="eyebrow leading-none mt-1 normal-case tracking-normal text-[11px] font-medium text-ink-muted">
                    {contact.role.toLowerCase().replace('_', ' ')}
                  </p>
                </div>
                {starting === contact.userPublicId ? (
                  <Spinner />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-ink flex-shrink-0">
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
      <div className="flex flex-1 min-h-[560px] min-w-0 overflow-hidden rounded-md border border-rule bg-surface shadow-lift">
        {/* Conversation list sidebar */}
        <div className="w-80 flex-shrink-0 border-r border-rule flex flex-col overflow-hidden">
          {/* Sidebar header */}
          <div className="flex-shrink-0 px-4 py-3.5 border-b border-rule flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded border border-rule bg-surface-sunk text-accent">
                <MessageSquare className="h-4 w-4" />
              </div>
              Messages
            </h2>
            <button
              onClick={handleNewChat}
              className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-ink hover:bg-accent-hover transition-colors"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <ConversationList selectedId={activeId} onSelect={handleSelect} onNewChat={handleNewChat} />
        </div>

        {/* Chat window */}
        <div className="flex-1 min-w-0 overflow-hidden bg-paper">
          {activeId ? (
            <ChatWindow
              conversationPublicId={activeId}
              otherName={otherName}
              otherRole={otherRole}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-5 px-8">
              <div className="flex h-16 w-16 items-center justify-center rounded border border-rule bg-surface-sunk">
                <MessageSquare className="h-7 w-7 text-ink-faint" />
              </div>
              <div className="text-center">
                <p className="font-display text-lg font-semibold text-ink">No conversation selected</p>
                <p className="text-xs text-ink-muted mt-1">Pick one from the list or start a new chat</p>
              </div>
              <button
                onClick={handleNewChat}
                className="flex items-center gap-2 rounded bg-accent hover:bg-accent-hover px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors"
              >
                <Plus className="h-4 w-4" />
                Start New Chat
              </button>
            </div>
          )}
        </div>
      </div>

      {showNewChat && (
        (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'SUPPORT')
          ? <AdminNewChatModal onClose={() => setShowNewChat(false)} onStarted={handleStarted} />
          : <NewChatModal onClose={() => setShowNewChat(false)} onStarted={handleStarted} />
      )}
    </>
  );
}
