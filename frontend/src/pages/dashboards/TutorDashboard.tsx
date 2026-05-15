import { useQuery } from '@tanstack/react-query';
import {
  Users, Video, BookOpen, DollarSign, Clock, GraduationCap,
  CalendarDays, ArrowUpRight, Plus, AlertTriangle,
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
import { DemoRequestsSection } from '../../components/shared/DemoRequestsSection';
import { api } from '../../lib/axios';

interface ClassItem {
  publicId: string;
  subject: string;
  scheduledStartUTC: string;
  classType: string;
  status: string;
}

function useTutorStats() {
  return useQuery({
    queryKey: ['analytics', 'tutor', 'me'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/tutor/me');
      return (data?.data ?? data ?? {}) as {
        upcoming: number;
        completed: number;
        totalStudents: number;
        earningsCents?: number;
      };
    },
  });
}

function useTutorClasses() {
  return useQuery<ClassItem[]>({
    queryKey: ['classes', 'tutor', 'upcoming'],
    queryFn: async () => {
      const { data } = await api.get('/classes/my/tutor', { params: { status: 'SCHEDULED', limit: 5 } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data?.data?.items ?? []).map((c: any) => ({
        ...c,
        subject: c.subject ?? c.title ?? '',
        scheduledStartUTC: c.scheduledStartUTC ?? c.startUTC ?? '',
      }));
    },
  });
}

function useTutorWalletBalance() {
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

function useProfileCompleteness() {
  return useQuery({
    queryKey: ['tutors', 'me'],
    queryFn: () => api.get('/tutors/me').then((r) => r.data.data),
  });
}

export function TutorDashboard() {
  const userTimezone =
    useAuthStore((s) => s.user?.timezone) ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data: stats, isLoading: statsLoading } = useTutorStats();
  const { data: classes = [], isLoading: classesLoading } = useTutorClasses();
  const { data: balanceCents = 0 } = useTutorWalletBalance();
  const { data: tutorProfile } = useProfileCompleteness();

  const profileIncomplete =
    tutorProfile &&
    (tutorProfile.subjects?.length === 0 || !tutorProfile.bio || tutorProfile.hourlyRateCents === 0);

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Tutor Studio"
        title="Your Teaching Day"
        description="Manage classes, students and earnings all in one place."
        icon={<GraduationCap className="h-5 w-5" />}
        actions={
          <>
            <Link to="/dashboard/tutor/schedule">
              <Button variant="outline" size="sm">
                <CalendarDays className="h-4 w-4" /> Schedule
              </Button>
            </Link>
            <Link to="/dashboard/tutor/classes">
              <Button size="sm" variant="gradient">
                <Plus className="h-4 w-4" /> New class
              </Button>
            </Link>
          </>
        }
      />

      <LiveClassBanner />

      <DemoRequestsSection />

      {profileIncomplete && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-800/40 dark:bg-amber-900/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-amber-800 dark:text-amber-300">Your tutor profile is incomplete.</span>
            <span className="ml-1.5 text-amber-700 dark:text-amber-400">
              Add your subjects, bio, and hourly rate so students can find and book you.
            </span>
          </div>
          <Link to="/profile">
            <Button size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/40">
              Complete profile
            </Button>
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Students"
          value={statsLoading ? '…' : String(stats?.totalStudents ?? 0)}
          accent="brand"
          icon={<Users className="h-5 w-5" />}
        />
        <StatsCard
          title="Upcoming Classes"
          value={statsLoading ? '…' : String(stats?.upcoming ?? 0)}
          accent="sky"
          icon={<Video className="h-5 w-5" />}
        />
        <StatsCard
          title="Completed Classes"
          value={statsLoading ? '…' : String(stats?.completed ?? 0)}
          accent="violet"
          icon={<BookOpen className="h-5 w-5" />}
        />
        <StatsCard
          title="Wallet Balance"
          value={formatINR(balanceCents)}
          accent="green"
          icon={<DollarSign className="h-5 w-5" />}
          hint="Available for payout"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Upcoming Classes</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Next sessions on your schedule</p>
            </div>
            <Link to="/dashboard/tutor/classes" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {classesLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : classes.length === 0 ? (
              <EmptyState
                compact
                icon={<Video className="h-6 w-6" />}
                title="No upcoming classes"
                description="Open your schedule to publish availability and start receiving bookings."
                action={
                  <Link to="/dashboard/tutor/schedule">
                    <Button size="sm" variant="gradient">
                      <CalendarDays className="h-4 w-4" /> Open schedule
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
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-emerald-600 ring-1 ring-emerald-100 dark:bg-gray-900/60 dark:text-emerald-300">
            <Clock className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
            Maximise your slots
          </h3>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
            Publish weekly availability so students can book recurring sessions instantly.
          </p>
          <Link to="/dashboard/tutor/schedule" className="mt-5 block">
            <Button variant="gradient" fullWidth>
              <CalendarDays className="h-4 w-4" /> Manage availability
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
