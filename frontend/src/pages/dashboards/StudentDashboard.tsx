import { useQuery } from '@tanstack/react-query';
import {
  Video, BookOpen, BarChart3, Wallet, ArrowUpRight, Plus,
  Sparkles, Target, GraduationCap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuthStore } from '../../stores/auth.store';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { EmptyState } from '../../components/shared/EmptyState';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { LiveClassBanner } from '../../features/live-class/LiveClassBanner';
import { api } from '../../lib/axios';

interface ClassItem {
  publicId: string;
  subject: string;
  scheduledStartUTC: string;
  classType: string;
  status: string;
}

function useStudentStats() {
  return useQuery({
    queryKey: ['analytics', 'student', 'me'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/student/me');
      return (data?.data ?? data ?? {}) as {
        upcoming: number;
        completed: number;
        submissions: number;
        attendanceRate: number;
      };
    },
  });
}

function useStudentClasses() {
  return useQuery<ClassItem[]>({
    queryKey: ['classes', 'student', 'upcoming'],
    queryFn: async () => {
      const { data } = await api.get('/classes/my/student', { params: { status: 'SCHEDULED', limit: 3 } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data?.data?.items ?? []).map((c: any) => ({
        ...c,
        subject: c.subject ?? c.title ?? '',
        scheduledStartUTC: c.scheduledStartUTC ?? c.startUTC ?? '',
      }));
    },
  });
}

function useWalletBalance() {
  return useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: async () => {
      const { data } = await api.get('/wallets/me');
      return data?.data?.balanceCents ?? 0;
    },
  });
}

const formatINR = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export function StudentDashboard() {
  const userTimezone =
    useAuthStore((s) => s.user?.timezone) ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data: stats, isLoading: statsLoading } = useStudentStats();
  const { data: classes = [], isLoading: classesLoading } = useStudentClasses();
  const { data: balanceCents = 0 } = useWalletBalance();

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="My Learning"
        title="Welcome back"
        description="Pick up where you left off your classes, progress and credits."
        icon={<Sparkles className="h-5 w-5" />}
        actions={
          <Link to="/dashboard/student/tutors">
            <Button size="sm" variant="gradient">
              <Plus className="h-4 w-4" /> Book a class
            </Button>
          </Link>
        }
      />

      <LiveClassBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Upcoming Classes"
          value={statsLoading ? '…' : String(stats?.upcoming ?? 0)}
          accent="brand"
          icon={<Video className="h-5 w-5" />}
        />
        <StatsCard
          title="Wallet Balance"
          value={formatINR(balanceCents)}
          accent="green"
          icon={<Wallet className="h-5 w-5" />}
          hint="Credits available"
        />
        <StatsCard
          title="Submissions"
          value={statsLoading ? '…' : String(stats?.submissions ?? 0)}
          accent="orange"
          icon={<BookOpen className="h-5 w-5" />}
        />
        <StatsCard
          title="Attendance"
          value={statsLoading ? '…' : `${stats?.attendanceRate ?? 0}%`}
          accent="violet"
          icon={<BarChart3 className="h-5 w-5" />}
          change={
            (stats?.attendanceRate ?? 0) >= 75
              ? { value: 'Good standing', positive: true }
              : { value: 'Needs attention', positive: false }
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Upcoming Classes</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Your next sessions</p>
            </div>
            <Link to="/dashboard/student/classes" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {classesLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : classes.length === 0 ? (
              <EmptyState
                compact
                icon={<GraduationCap className="h-6 w-6" />}
                title="No upcoming classes"
                description="Browse expert tutors and book your first session demo classes available."
                action={
                  <Link to="/dashboard/student/tutors">
                    <Button size="sm" variant="gradient">
                      <Plus className="h-4 w-4" /> Find a tutor
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {classes.map((cls) => (
                  <div key={cls.publicId} className="flex items-center justify-between rounded-xl border border-gray-100 p-3.5 transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:hover:border-brand-800/60 dark:hover:bg-brand-900/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-violet-50 text-brand-600 ring-1 ring-brand-100 dark:from-brand-900/30 dark:to-violet-900/30 dark:text-brand-300">
                        <Video className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{cls.subject}</p>
                        <p className="text-xs text-gray-500">
                          {formatInTimeZone(new Date(cls.scheduledStartUTC), userTimezone, 'EEE, MMM d · h:mm a zzz')}
                        </p>
                      </div>
                    </div>
                    <Badge variant={cls.classType === 'DEMO' ? 'warning' : 'info'} tone="soft">
                      {cls.classType}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card tone="gradient" padding="lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-pink-600 ring-1 ring-pink-100 dark:bg-gray-900/60 dark:text-pink-300">
            <Target className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
            Try a free demo
          </h3>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
            You have <span className="font-semibold text-pink-600 dark:text-pink-400">3 demo credits</span>
            {' '}to explore tutors before committing.
          </p>
          <Link to="/dashboard/student/tutors" className="mt-5 block">
            <Button variant="gradient" fullWidth>
              <BookOpen className="h-4 w-4" /> Browse tutors
            </Button>
          </Link>
          <p className="mt-3 text-[11px] text-gray-500">
            1 demo per tutor · non-transferable
          </p>
        </Card>
      </div>
    </div>
  );
}
