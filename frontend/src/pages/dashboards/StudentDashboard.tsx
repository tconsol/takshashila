import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Video, BookOpen, BarChart3, Coins, ArrowUpRight, Plus,
  Sparkles, Target, GraduationCap, Star, MessageSquare, Flame, Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuthStore } from '../../stores/auth.store';
import { DashboardHero } from '../../components/shared/DashboardHero';
import { EmptyState } from '../../components/shared/EmptyState';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { Avatar } from '../../components/ui/Avatar';
import { LiveClassBanner } from '../../features/live-class/LiveClassBanner';
import { useMyTutor, useStudentPrincipal } from '../../hooks/use-students';
import { useParentLinkRequests } from '../../hooks/use-student-parent-requests';
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
    // Refresh when the student returns to the dashboard (e.g. after a class
    // completes) so completed/attendance counts aren't stale.
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 10_000,
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
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 10_000,
  });
}

// ─── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200): number {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return val;
}

// ─── Framer Motion variants ───────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 22, delay: i * 0.09 },
  }),
};

const slideLeft = {
  hidden: { opacity: 0, x: -22 },
  show: (i = 0) => ({
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24, delay: 0.35 + i * 0.08 },
  }),
};

const popIn = {
  hidden: { opacity: 0, scale: 0.88 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 240, damping: 18, delay: 0.4 },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCreditsLabel = (cents: number) =>
  `${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} cr`;

const TIPS = [
  'Consistency beats intensity show up every day! 🎯',
  'Every class brings you closer to your goal 🚀',
  'Small progress is still progress. Keep going! 💪',
  'Learning is a superpower. Use it well! ⚡',
  'Your future self will thank you for studying today 🌟',
  'Ask questions. Curious minds grow the fastest 🧠',
  'One more class today = one step ahead tomorrow 🏆',
];

function getGreeting(firstName: string) {
  const h = new Date().getHours();
  if (h < 12) return { text: `Good morning, ${firstName}!`, emoji: '🌅' };
  if (h < 17) return { text: `Good afternoon, ${firstName}!`, emoji: '☀️' };
  return { text: `Good evening, ${firstName}!`, emoji: '🌙' };
}

// ─── Animated attendance ring ─────────────────────────────────────────────────
function AttendanceRing({ rate }: { rate: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const [dash, setDash] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDash((rate / 100) * circ), 100);
    return () => clearTimeout(t);
  }, [rate, circ]);

  const color = rate >= 75 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center h-16 w-16">
      <svg className="-rotate-90" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-gray-200 dark:text-gray-700" />
        <circle
          cx="32" cy="32" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - dash}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.2,0.64,1)' }}
        />
      </svg>
      <span className="absolute text-xs font-bold text-gray-800 dark:text-white">{rate}%</span>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export function StudentDashboard() {
  const user = useAuthStore((s) => s.user);
  const userTimezone = user?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data: stats, isLoading: statsLoading } = useStudentStats();
  const { data: classes = [], isLoading: classesLoading } = useStudentClasses();
  const { data: balanceCents = 0 } = useWalletBalance();
  const { data: myTutor } = useMyTutor();
  const { data: myPrincipal } = useStudentPrincipal();
  const { data: parentRequests = [] } = useParentLinkRequests();

  const upcoming   = useCountUp(stats?.upcoming ?? 0);
  const submissions = useCountUp(stats?.submissions ?? 0);
  const attendance  = useCountUp(stats?.attendanceRate ?? 0);
  const walletAnim  = useCountUp(balanceCents);

  const greeting = getGreeting(user?.firstName ?? 'there');
  const tip = TIPS[new Date().getDay() % TIPS.length];

  return (
    <div className="space-y-6">
      <DashboardHero
        role="STUDENT"
        eyebrow="My Learning"
        title={`${greeting.emoji} ${greeting.text}`}
        description={tip}
        icon={<Sparkles className="h-6 w-6" />}
        actions={
          <Link to="/dashboard/student/tutors">
            <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-white/30 border shrink-0">
              <Plus className="h-4 w-4" /> Book a class
            </Button>
          </Link>
        }
      />

      <LiveClassBanner />

      {/* Parent link requests banner */}
      {parentRequests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          className="flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 shrink-0">
              <Users className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-violet-900">
                {parentRequests.length === 1
                  ? '1 parent wants to link to your account'
                  : `${parentRequests.length} parents want to link to your account`}
              </p>
              <p className="text-xs text-violet-600 mt-0.5">Review and accept or decline their requests</p>
            </div>
          </div>
          <Link to="/dashboard/student/parent-requests" className="shrink-0">
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white border-violet-600">
              Review <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </motion.div>
      )}

      {/* Stats cards staggered entrance */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: 'Upcoming Classes',
            value: statsLoading ? '…' : String(upcoming),
            icon: <Video className="h-5 w-5" />,
            ring: 'from-indigo-500 to-blue-500',
            tile: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300',
            hint: 'Scheduled sessions',
          },
          {
            title: 'Wallet Balance',
            value: formatCreditsLabel(walletAnim),
            icon: <Coins className="h-5 w-5" />,
            ring: 'from-emerald-500 to-teal-500',
            tile: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
            hint: 'Credits available',
          },
          {
            title: 'Submissions',
            value: statsLoading ? '…' : String(submissions),
            icon: <BookOpen className="h-5 w-5" />,
            ring: 'from-orange-500 to-amber-500',
            tile: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300',
            hint: 'Worksheets done',
          },
          {
            title: 'Attendance',
            value: statsLoading ? '…' : `${attendance}%`,
            icon: <BarChart3 className="h-5 w-5" />,
            ring: 'from-violet-500 to-purple-500',
            tile: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300',
            badge: (stats?.attendanceRate ?? 0) >= 75
              ? { text: 'Good standing', good: true }
              : { text: 'Needs attention', good: false },
          },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            {/* accent strip */}
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.ring}`} />
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.title}</p>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tile}`}>
                {card.icon}
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {card.value}
            </p>
            {card.hint && <p className="mt-1 text-xs text-slate-400">{card.hint}</p>}
            {card.badge && (
              <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                card.badge.good
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-rose-50 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400'
              }`}>
                {card.badge.good ? '↗' : '↘'} {card.badge.text}
              </span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Streak + attendance ring row */}
      {!statsLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, type: 'spring', stiffness: 260, damping: 22 }}
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-orange-200 dark:border-orange-900/50 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 px-5 py-3.5"
        >
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
            <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">
              {(stats?.completed ?? 0)} classes completed
            </span>
          </div>
          <div className="hidden sm:block h-4 w-px bg-orange-200 dark:bg-orange-800" />
          <div className="flex items-center gap-3">
            <AttendanceRing rate={stats?.attendanceRate ?? 0} />
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Attendance rate</p>
              <p className="text-xs text-gray-500">
                {(stats?.attendanceRate ?? 0) >= 75
                  ? 'Great keep it up! 🏆'
                  : 'Aim for 75% to stay on track'}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Classes + tutor grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 22 }}
        >
          <Card>
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
                  {classes.map((cls, i) => (
                    <motion.div
                      key={cls.publicId}
                      custom={i}
                      variants={slideLeft}
                      initial="hidden"
                      animate="show"
                      className="flex items-center justify-between rounded-xl border border-gray-100 p-3.5 transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:hover:border-brand-800/60 dark:hover:bg-brand-900/10"
                    >
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
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tutor card / demo card + principal card */}
        <motion.div variants={popIn} initial="hidden" animate="show" className="flex flex-col gap-4">
          {myPrincipal && (
            <Card className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 text-violet-600 ring-1 ring-violet-100 dark:from-violet-900/30 dark:to-indigo-900/30 dark:text-violet-300">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">My Organization</p>
              </div>
              {myPrincipal.organizationName && (
                <p className="text-base font-bold text-gray-900 dark:text-white truncate">{myPrincipal.organizationName}</p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Principal: {`${myPrincipal.firstName} ${myPrincipal.lastName}`.trim()}
              </p>
            </Card>
          )}
          {myTutor ? (
            <Card className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={myTutor.displayName} size="lg" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">My Tutor</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white truncate">{myTutor.displayName}</p>
                  {myTutor.isVerified && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Verified
                    </span>
                  )}
                </div>
              </div>

              {myTutor.subjects?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {myTutor.subjects.slice(0, 4).map((s) => (
                    <motion.span
                      key={s}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      className="rounded-full bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-300"
                    >
                      {s}
                    </motion.span>
                  ))}
                </div>
              )}

              {myTutor.rating > 0 && (
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-gray-800 dark:text-white">{myTutor.rating.toFixed(1)}</span>
                  <span className="text-xs">rating</span>
                </div>
              )}

              {myTutor.bio && (
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{myTutor.bio}</p>
              )}

              <Link to="/chat" className="mt-auto">
                <Button variant="outline" fullWidth size="sm">
                  <MessageSquare className="h-4 w-4" /> Message Tutor
                </Button>
              </Link>
            </Card>
          ) : (
            <Card tone="gradient" padding="lg" className="overflow-hidden relative">
              {/* Floating sparkles */}
              {['top-3 right-4', 'top-10 right-12', 'top-6 right-20'].map((pos, i) => (
                <motion.span
                  key={i}
                  className={`absolute ${pos} text-yellow-400 text-lg pointer-events-none`}
                  animate={{ y: [0, -6, 0], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
                >
                  ✨
                </motion.span>
              ))}

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-pink-600 ring-1 ring-pink-100 dark:bg-gray-900/60 dark:text-pink-300">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
                Try a free demo
              </h3>
              <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
                You have{' '}
                <span className="font-semibold text-pink-600 dark:text-pink-400">3 demo credits</span>
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
          )}
        </motion.div>
      </div>
    </div>
  );
}
