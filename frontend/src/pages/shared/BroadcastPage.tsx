import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Megaphone, Send, Mail, Users, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { broadcastService } from '../../services/broadcast.service';

const ROLES = [
  { value: 'STUDENT', label: 'Students' },
  { value: 'TUTOR', label: 'Tutors' },
  { value: 'PRINCIPAL', label: 'Principals' },
  { value: 'PARENT', label: 'Parents' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'ADMIN', label: 'Admins' },
];

const MAX_TITLE = 120;
const MAX_BODY = 4000;

export function BroadcastPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [alsoEmail, setAlsoEmail] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Audience is re-estimated as the selection changes, so the sender always
  // sees the real reach before committing to an irreversible send.
  const { data: audience } = useQuery({
    queryKey: ['broadcast-audience', roles],
    queryFn: () => broadcastService.estimateAudience(roles),
    staleTime: 30_000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['broadcast-history'],
    queryFn: broadcastService.history,
    staleTime: 30_000,
  });

  const { mutate: send, isPending, error, reset } = useMutation({
    mutationFn: () => broadcastService.send({ title, body, roles, alsoEmail }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['broadcast-history'] });
      setTitle(''); setBody(''); setRoles([]); setAlsoEmail(false);
      setConfirming(false);
    },
  });

  const toggleRole = (role: string) =>
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  const canSend = title.trim().length > 0 && body.trim().length > 0 && (audience?.total ?? 0) > 0;

  const audienceLabel = useMemo(
    () => (roles.length === 0 ? 'Everyone' : roles.map((r) => ROLES.find((o) => o.value === r)?.label ?? r).join(', ')),
    [roles],
  );

  const totalSent = history.reduce((s, h) => s + h.recipients, 0);
  const totalRead = history.reduce((s, h) => s + h.readCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        eyebrow="Broadcast"
        description="Send a message to everyone, or to a specific group of roles."
        icon={<Megaphone className="h-5 w-5" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          index={0}
          title="Current Audience"
          value={(audience?.total ?? 0).toLocaleString()}
          accent="brand"
          icon={<Users className="h-5 w-5" />}
          hint={audienceLabel}
        />
        <StatsCard
          index={1}
          title="Announcements Sent"
          value={history.length.toLocaleString()}
          accent="violet"
          icon={<Megaphone className="h-5 w-5" />}
          hint={`${totalSent.toLocaleString()} deliveries`}
        />
        <StatsCard
          index={2}
          title="Read Rate"
          value={totalSent > 0 ? `${Math.round((totalRead / totalSent) * 100)}%` : '—'}
          accent="green"
          icon={<CheckCircle2 className="h-5 w-5" />}
          hint={`${totalRead.toLocaleString()} opened`}
        />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Compose</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              Delivered in-app immediately. Announcements cannot be recalled once sent.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="eyebrow mb-2">Audience</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRoles([])}
                  className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    roles.length === 0
                      ? 'border-accent bg-accent-wash text-accent'
                      : 'border-rule text-ink-muted hover:border-accent hover:text-accent'
                  }`}
                >
                  Everyone
                </button>
                {ROLES.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => toggleRole(role.value)}
                    className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      roles.includes(role.value)
                        ? 'border-accent bg-accent-wash text-accent'
                        : 'border-rule text-ink-muted hover:border-accent hover:text-accent'
                    }`}
                  >
                    {role.label}
                    {audience && roles.includes(role.value) && (
                      <span className="ml-1.5 text-ink-faint">
                        {audience.byRole.find((r) => r.role === role.value)?.count ?? 0}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Title"
              value={title}
              maxLength={MAX_TITLE}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Scheduled maintenance this Sunday"
              hint={`${title.length}/${MAX_TITLE}`}
            />

            <div>
              <p className="eyebrow mb-2">Message</p>
              <textarea
                value={body}
                maxLength={MAX_BODY}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="What do you need people to know?"
                className="w-full rounded-t-[3px] border-0 border-b-2 border-rule-strong bg-surface-sunk px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:bg-surface-hover"
              />
              <p className="mt-1 text-xs text-ink-muted">{body.length}/{MAX_BODY}</p>
            </div>

            <label className="flex cursor-pointer items-start justify-between gap-4 rounded border border-rule p-3.5">
              <span>
                <span className="block text-sm font-semibold text-ink">Also send as email</span>
                <span className="block text-xs text-ink-muted">
                  Queued per recipient. Student accounts without a real address are skipped.
                </span>
              </span>
              <input
                type="checkbox"
                checked={alsoEmail}
                onChange={(e) => setAlsoEmail(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-rule-strong text-accent focus:ring-accent"
              />
            </label>

            {error && <p className="text-sm font-medium text-danger">{(error as Error).message}</p>}

            <div className="flex items-center justify-between gap-3 border-t border-rule pt-4">
              <p className="text-xs text-ink-muted">
                Reaching <span className="font-semibold text-ink">{(audience?.total ?? 0).toLocaleString()}</span>{' '}
                {audienceLabel.toLowerCase()}
                {alsoEmail && <> · <Mail className="inline h-3 w-3" /> email too</>}
              </p>
              <Button disabled={!canSend} onClick={() => { reset(); setConfirming(true); }}>
                <Send className="h-4 w-4" /> Send announcement
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Sent</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">Most recent announcements and how many opened them</p>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">Nothing sent yet.</p>
          ) : (
            <div className="space-y-2.5">
              {history.map((item) => (
                <div key={item.broadcastId} className="rounded border border-rule p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{item.body}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {item.channel === 'BOTH' && <Badge variant="info" tone="soft">Emailed</Badge>}
                      <Badge variant="success" tone="soft">
                        {item.recipients > 0 ? Math.round((item.readCount / item.recipients) * 100) : 0}% read
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-ink-faint">
                    {item.sentByName} · {format(new Date(item.sentAt), 'MMM d, yyyy h:mm a')} ·{' '}
                    {item.recipients.toLocaleString()} recipients
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="Send announcement"
        message={`This will reach ${(audience?.total ?? 0).toLocaleString()} people (${audienceLabel})${
          alsoEmail ? ' in-app and by email' : ' in-app'
        }. Announcements cannot be recalled once sent.`}
        confirmLabel="Send now"
        loading={isPending}
        error={error ? (error as Error).message : undefined}
        onCancel={() => setConfirming(false)}
        onConfirm={() => send()}
      />
    </div>
  );
}
