import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { LifeBuoy, Plus, Send } from 'lucide-react';
import { api } from '../../lib/axios';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { useAuthStore } from '../../stores/auth.store';

interface Ticket {
  publicId: string;
  subject: string;
  category: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: string;
  createdAt: string;
  updatedAt: string;
}

interface TicketMessage {
  publicId: string;
  senderPublicId: string;
  body: string;
  createdAt: string;
}

const STATUS_VARIANT = { OPEN: 'info', IN_PROGRESS: 'warning', RESOLVED: 'success', CLOSED: 'default' } as const;

const CATEGORIES = [
  { value: 'BILLING', label: 'Payments, credits or payouts' },
  { value: 'CLASS', label: 'A class or a tutor' },
  { value: 'ACCOUNT', label: 'My account or sign-in' },
  { value: 'TECHNICAL', label: 'Something is not working' },
  { value: 'OTHER', label: 'Something else' },
];

const errorText = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message
  ?? (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

/**
 * Where a student, tutor, principal or parent asks for help: raise a ticket,
 * follow it and reply. (Staff work the queue from their own Support screens.)
 */
export function MySupportPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: async () => {
      const res = await api.get('/support/tickets', { params: { limit: 50 } });
      const d = res.data.data;
      return (d?.items ?? d ?? []) as Ticket[];
    },
    staleTime: 15_000,
  });

  const openTicket = tickets.find((t) => t.publicId === openId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader title="Help & Support" subtitle="Ask our team for help and follow your requests." />
        <Button variant="gradient" onClick={() => setCreating(true)} className="shrink-0">
          <Plus className="mr-1.5 h-4 w-4" /> New request
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy className="h-6 w-6" />}
          title="No support requests yet"
          description="Something wrong with a payment, a class or your account? Send us a request and we will reply here."
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <button
              key={t.publicId}
              onClick={() => setOpenId(t.publicId)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-rule bg-surface p-4 text-left shadow-card transition-colors hover:border-accent"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{t.subject}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {t.category} · opened {format(new Date(t.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[t.status] ?? 'default'} tone="soft">{t.status.replace('_', ' ')}</Badge>
            </button>
          ))}
        </div>
      )}

      <NewTicketModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['my-tickets'] }); }}
      />

      {openTicket && (
        <TicketThread ticket={openTicket} myId={me?.publicId ?? ''} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

function NewTicketModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [category, setCategory] = useState('OTHER');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.post('/support/tickets', { subject: subject.trim(), category, body: body.trim() }),
    onSuccess: () => { setSubject(''); setBody(''); setCategory('OTHER'); setError(''); onCreated(); },
    onError: (e) => setError(errorText(e)),
  });

  const ready = subject.trim().length >= 3 && body.trim().length >= 10;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New support request"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} loading={isPending} disabled={!ready}>Send request</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="What is it about?" options={CATEGORIES} value={category} onChange={(e) => setCategory(e.target.value)} />
        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A short summary" />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Tell us what happened</label>
          <textarea
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Include the class, date or amount if it helps."
            className="w-full rounded-lg border border-rule-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
          {!ready && (subject || body) && (
            <p className="mt-1 text-xs text-ink-muted">Add a subject and at least a sentence of detail.</p>
          )}
        </div>
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

function TicketThread({ ticket, myId, onClose }: { ticket: Ticket; myId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');

  const { data: messages = [] } = useQuery({
    queryKey: ['my-ticket-messages', ticket.publicId],
    queryFn: async () => (await api.get(`/support/tickets/${ticket.publicId}/messages`)).data.data as TicketMessage[],
    refetchInterval: 15_000,
  });

  const { mutate: send, isPending } = useMutation({
    mutationFn: () => api.post(`/support/tickets/${ticket.publicId}/messages`, { body: reply.trim() }),
    onSuccess: () => {
      setReply(''); setError('');
      qc.invalidateQueries({ queryKey: ['my-ticket-messages', ticket.publicId] });
    },
    onError: (e) => setError(errorText(e)),
  });

  const closed = ticket.status === 'CLOSED';

  return (
    <Modal open onClose={onClose} title={ticket.subject} size="md" footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      <div className="space-y-3">
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {messages.map((m) => {
            const mine = m.senderPublicId === myId;
            return (
              <div key={m.publicId} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-accent text-white' : 'bg-surface-hover text-ink'}`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-ink-muted'}`}>
                    {mine ? 'You' : 'Support'} · {format(new Date(m.createdAt), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {closed ? (
          <p className="text-xs text-ink-muted">This request is closed. Open a new one if you still need help.</p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply…"
              className="flex-1 rounded-lg border border-rule-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <Button onClick={() => send()} loading={isPending} disabled={!reply.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
