import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, Video, ArrowUpRight, UserPlus, Building2,
  Sparkles, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { EmptyState } from '../../components/shared/EmptyState';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Loading';
import { api } from '../../lib/axios';

interface PendingTutor {
  publicId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  subjects?: string[];
  status?: string;
  createdAt?: string;
}

function usePrincipalStats() {
  return useQuery({
    queryKey: ['analytics', 'principal', 'me'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/principal/me');
      return (data?.data ?? data ?? {}) as { tutors: number; students: number; classes: number };
    },
  });
}

function usePendingTutors() {
  return useQuery<PendingTutor[]>({
    queryKey: ['tutors', 'pending'],
    queryFn: async () => {
      const { data } = await api.get('/tutors/pending', { params: { limit: 5 } });
      return data?.data?.items ?? [];
    },
  });
}

function useInviteTutor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; firstName: string; lastName: string; subjects: string[] }) =>
      api.post('/tutors/invite', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tutors'] }),
  });
}

export function PrincipalDashboard() {
  const { data: stats, isLoading: statsLoading } = usePrincipalStats();
  const { data: pendingTutors = [], isLoading: tutorsLoading } = usePendingTutors();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Principal Console"
        title="Your Tutor Network"
        description="Onboard tutors, track performance and grow your institution."
        icon={<Building2 className="h-5 w-5" />}
        actions={
          <>
            <Link to="/dashboard/principal/tutors">
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4" /> All tutors
              </Button>
            </Link>
            <Button size="sm" variant="gradient" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> Invite tutor
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Active Tutors"     value={statsLoading ? '…' : String(stats?.tutors ?? 0)}   accent="brand"  icon={<GraduationCap className="h-5 w-5" />} />
        <StatsCard title="Total Students"    value={statsLoading ? '…' : String(stats?.students ?? 0)} accent="green"  icon={<Users className="h-5 w-5" />} />
        <StatsCard title="Classes (30d)"     value={statsLoading ? '…' : String(stats?.classes ?? 0)}  accent="violet" icon={<Video className="h-5 w-5" />} />
        <StatsCard title="Pending Approvals" value={tutorsLoading ? '…' : String(pendingTutors.length)} accent="amber"  icon={<AlertCircle className="h-5 w-5" />} hint="Awaiting your review" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Tutors Awaiting Approval</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Review and approve verified tutor profiles</p>
            </div>
            <Link to="/dashboard/principal/tutors" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {tutorsLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : pendingTutors.length === 0 ? (
              <EmptyState
                compact
                icon={<GraduationCap className="h-6 w-6" />}
                title="No pending tutor approvals"
                description="When tutors submit for verification, they'll appear here."
                action={
                  <Button size="sm" variant="gradient" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="h-4 w-4" /> Invite your first tutor
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {pendingTutors.map((t) => (
                  <div key={t.publicId} className="flex items-center justify-between rounded-xl border border-gray-100 p-3.5 transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:hover:border-brand-800/60 dark:hover:bg-brand-900/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-violet-100 text-sm font-semibold text-brand-700 dark:from-brand-900/40 dark:to-violet-900/40 dark:text-brand-300">
                        {(t.firstName?.[0] ?? 'T').toUpperCase()}{(t.lastName?.[0] ?? '').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {t.firstName} {t.lastName}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {t.email ?? '—'}
                          {t.subjects?.length ? ` · ${t.subjects.slice(0, 2).join(', ')}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" tone="soft">{t.status ?? 'UNDER_VERIFICATION'}</Badge>
                      <Link to="/dashboard/principal/tutors">
                        <Button size="sm">Review</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card tone="gradient" padding="lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-brand-600 ring-1 ring-brand-100 dark:bg-gray-900/60 dark:text-brand-300">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
            Grow your tutor network
          </h3>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
            Send a branded invitation to bring an expert tutor onto your institution.
          </p>
          <Button
            className="mt-5 w-full"
            variant="gradient"
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus className="h-4 w-4" /> Invite a tutor
          </Button>
          <p className="mt-3 text-[11px] text-gray-500">
            Or <Link to="/dashboard/principal/tutors" className="text-brand-600 hover:underline">view all tutors</Link> in your network.
          </p>
        </Card>
      </div>

      <InviteTutorModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

function InviteTutorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [subjectsInput, setSubjectsInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const invite = useInviteTutor();

  const reset = () => {
    setFirstName(''); setLastName(''); setEmail(''); setSubjectsInput(''); setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email || !firstName || !lastName) {
      setError('Please fill in all required fields.');
      return;
    }
    try {
      await invite.mutateAsync({
        email,
        firstName,
        lastName,
        subjects: subjectsInput.split(',').map((s) => s.trim()).filter(Boolean),
      });
      reset();
      onClose();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to send invite. Please try again.';
      setError(msg);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Invite a tutor"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button variant="gradient" loading={invite.isPending} onClick={handleSubmit}>
            <UserPlus className="h-4 w-4" /> Send invite
          </Button>
        </>
      }
    >
      <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
        We'll email the tutor a sign-up link. Once they complete their profile, they'll appear
        in your approval queue.
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" placeholder="Asha" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last name" placeholder="Verma" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input
          label="Email"
          type="email"
          placeholder="asha@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Subjects <span className="text-gray-400 font-normal">(optional, comma-separated)</span>
          </label>
          <input
            value={subjectsInput}
            onChange={(e) => setSubjectsInput(e.target.value)}
            placeholder="Mathematics, Physics, Chemistry"
            className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
      </div>
    </Modal>
  );
}
