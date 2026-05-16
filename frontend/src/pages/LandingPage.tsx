import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Video, Calendar, Users, Wallet, MessageSquare, BarChart3,
  CheckCircle2, Star, ArrowRight, GraduationCap, BookOpen, Shield,
  Zap, Sparkles, Rocket, Heart, Search, Bell, Trophy,
  Headphones, TrendingUp, ShieldCheck, Play, Layout,
  Mic, MicOff, Monitor, PhoneOff, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { ROLE_DASHBOARD_PATHS } from '../constants/roles';
import { InfiniteCarouselWall } from '../components/lightswind/InfiniteCarouselWall';
import { CtaBanner } from '../components/shared/CtaBanner';

/* ─── constants ─────────────────────────────────────────────────── */

const ROTATING_SUBJECTS = ['Mathematics', 'Physics', 'English', 'Coding', 'Chemistry', 'Biology'];

const SUBJECTS_MARQUEE = [
  'Mathematics', 'Science', 'English', 'Coding', 'Physics', 'Chemistry',
  'Biology', 'History', 'Geography', 'Economics', 'Computer Science', 'Public Speaking',
];

const STATS = [
  { label: 'Active students', num: 50000, display: '50K+',  accent: 'from-brand-500 to-violet-500',   glow: 'shadow-brand-400/30' },
  { label: 'Expert tutors',   num: 5000,  display: '5K+',   accent: 'from-emerald-500 to-teal-500',   glow: 'shadow-emerald-400/30' },
  { label: 'Subjects',        num: 100,   display: '100+',  accent: 'from-amber-500 to-orange-500',   glow: 'shadow-amber-400/30' },
  { label: 'Avg. rating',     num: 49,    display: '4.9★',  accent: 'from-pink-500 to-rose-500',      glow: 'shadow-pink-400/30' },
];

const SKILL_TABS = [
  {
    id: 'foundations',
    title: 'Strong foundations',
    subtitle: 'Concept clarity in every chapter',
    points: [
      'Clear explanations with real-life examples',
      'Step-by-step methods for every problem type',
      'Practice right inside the live class',
    ],
  },
  {
    id: 'problem',
    title: 'Problem-solving power',
    subtitle: 'From simple sums to tricky questions',
    points: [
      'Decode any question slowly and confidently',
      'Strategies for time-bound exams',
      'Build speed without losing accuracy',
    ],
  },
  {
    id: 'thinking',
    title: 'Critical thinking',
    subtitle: 'Not just answers, but reasoning',
    points: [
      'Ask why and how in every topic',
      'Compare different solution paths',
      'Understand mistakes and fix them',
    ],
  },
  {
    id: 'confidence',
    title: 'Classroom confidence',
    subtitle: 'Speak up and lead discussions',
    points: [
      'Safe space to ask any doubt',
      'Regular small wins and appreciation',
      'Present solutions to peers and tutor',
    ],
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Begin at your level',
    desc: 'Quick assessment so your tutor knows exactly where to start.',
    color: 'from-emerald-400 to-teal-500',
    glow: 'shadow-emerald-500/25',
    bg: 'from-emerald-50 to-teal-50',
  },
  {
    step: '02',
    title: 'Progress fast',
    desc: 'Live classes, real-time feedback and targeted practice.',
    color: 'from-sky-400 to-blue-500',
    glow: 'shadow-sky-500/25',
    bg: 'from-sky-50 to-blue-50',
  },
  {
    step: '03',
    title: 'Ace exams & shine',
    desc: 'Confidence to tackle any exam, debate or presentation.',
    color: 'from-brand-500 to-violet-600',
    glow: 'shadow-brand-500/25',
    bg: 'from-brand-50 to-violet-50',
  },
];

/* ─── animation variants ─────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

/* ─── helpers ────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-brand-50/60 px-4 py-1.5 text-sm font-semibold text-brand-700 dark:border-brand-800/50 dark:bg-brand-900/20 dark:text-brand-300">
      <Sparkles className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function AnimatedStat({ display, label, accent, glow }: (typeof STATS)[0]) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      className={`group relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-6 shadow-lg ${glow} transition-all hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900`}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-0 transition-opacity group-hover:opacity-100 ${accent}" />
      <motion.p
        className={`bg-gradient-to-r ${accent} bg-clip-text text-4xl font-black text-transparent md:text-5xl`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, ease: 'backOut' }}
      >
        {display}
      </motion.p>
      <p className="mt-1.5 text-sm font-medium text-gray-500">{label}</p>
    </motion.div>
  );
}

/* ─── main component ─────────────────────────────────────────────── */

export function LandingPage() {
  const { isAuthenticated, user } = useAuthStore();
  const [activeSkill, setActiveSkill] = useState(SKILL_TABS[0].id);
  const [wordIdx, setWordIdx] = useState(0);
  const currentSkill = SKILL_TABS.find((s) => s.id === activeSkill)!;

  useEffect(() => {
    const id = setInterval(() => setWordIdx((i) => (i + 1) % ROTATING_SUBJECTS.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-white">

      {/* ══════════════════════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-gray-100/80 bg-white/80 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-950/80">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-md shadow-brand-500/30">
              <GraduationCap className="h-4.5 w-4.5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight">Takshashila</span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {[
              { label: 'Find Tutors', href: '/tutors', icon: Search },
              { label: 'Features',   href: '#features' },
              { label: 'How it works', href: '#how-it-works' },
              { label: 'Reviews',    href: '#testimonials' },
            ].map(({ label, href, icon: Icon }) => (
              href.startsWith('#') ? (
                <a key={label} href={href} className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-400">
                  {label}
                </a>
              ) : (
                <Link key={label} to={href} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-400">
                  {Icon && <Icon className="h-3.5 w-3.5" />} {label}
                </Link>
              )
            ))}
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <Link
                to={ROLE_DASHBOARD_PATHS[user.role]}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition-all hover:shadow-lg hover:shadow-violet-500/30"
              >
                Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden text-sm font-medium text-gray-600 transition-colors hover:text-brand-600 dark:text-gray-300 sm:block">
                  Sign in
                </Link>
                <Link
                  to="/register/student"
                  className="relative overflow-hidden inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-500/25 transition-all hover:shadow-lg hover:shadow-violet-500/35"
                >
                  <motion.span
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ translateX: ['−100%', '250%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
                  />
                  Get started free
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pb-20 pt-16 lg:pt-24 lg:pb-28">
        {/* Background layers */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          {/* Grid */}
          <div
            className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(116,48,227,0.5) 1px, transparent 1px), linear-gradient(to right, rgba(116,48,227,0.5) 1px, transparent 1px)',
              backgroundSize: '52px 52px',
            }}
          />
          {/* Radial spotlight */}
          <div className="absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-brand-400/12 via-violet-400/8 to-transparent blur-3xl" />
          {/* Orbs */}
          <motion.div
            className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-gradient-to-br from-brand-300/20 via-violet-300/15 to-transparent blur-3xl"
            animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -right-24 top-20 h-80 w-80 rounded-full bg-gradient-to-br from-pink-300/15 via-rose-300/10 to-transparent blur-3xl"
            animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2">

            {/* LEFT */}
            <motion.div
              className="space-y-7"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              {/* Badge */}
              <motion.div variants={fadeUp}>
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-white/70 px-4 py-1.5 text-sm font-medium text-brand-700 shadow-sm backdrop-blur-xl dark:border-brand-800/50 dark:bg-brand-900/20 dark:text-brand-300">
                  <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Trusted online tutoring marketplace
                </div>
              </motion.div>

              {/* Headline with rotating word */}
              <motion.div variants={fadeUp}>
                <h1 className="text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl lg:text-[4.25rem]">
                  Find expert tutors for{' '}
                  <span className="relative inline-block overflow-hidden align-bottom" style={{ height: '1.15em' }}>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={wordIdx}
                        initial={{ y: 48, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -48, opacity: 0 }}
                        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute left-0 top-0 bg-gradient-to-r from-brand-600 via-violet-600 to-pink-500 bg-clip-text text-transparent"
                      >
                        {ROTATING_SUBJECTS[wordIdx]}
                      </motion.span>
                    </AnimatePresence>
                    {/* invisible longest word to reserve space */}
                    <span className="invisible">Computer Science</span>
                  </span>
                </h1>
              </motion.div>

              <motion.p variants={fadeUp} className="max-w-xl text-lg leading-relaxed text-gray-600 dark:text-gray-300 md:text-xl">
                Search by grade, subject and schedule. Compare profiles, ratings and teaching style then book a live demo in one click.
              </motion.p>

              {/* CTAs */}
              <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
                <Link
                  to="/tutors"
                  className="group relative overflow-hidden inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 via-violet-600 to-pink-500 px-7 py-3.5 text-base font-bold text-white shadow-xl shadow-brand-500/30 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-violet-500/40"
                >
                  <motion.span
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ translateX: ['−100%', '250%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
                  />
                  <Rocket className="h-5 w-5" />
                  Find tutors
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/register/student"
                  className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/70 px-7 py-3.5 text-base font-semibold backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md dark:border-gray-700 dark:bg-gray-900/60 dark:hover:bg-gray-900"
                >
                  <Play className="h-4 w-4 fill-current" /> Book a free demo
                </Link>
              </motion.div>

              {/* Social proof */}
              <motion.div variants={fadeUp} className="flex items-center gap-4">
                <div className="flex -space-x-2.5">
                  {['PS', 'RM', 'AV', 'KN', 'DK'].map((initials, i) => (
                    <div
                      key={i}
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-brand-400 to-violet-500 text-[10px] font-bold text-white shadow-sm dark:border-gray-900"
                      style={{ zIndex: 5 - i }}
                    >
                      {initials}
                    </div>
                  ))}
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-bold text-gray-600 shadow-sm dark:border-gray-900 dark:bg-gray-800 dark:text-gray-300">
                    +99
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-bold text-gray-900 dark:text-white">50,000+ students</span> joined this month
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {[...Array(5)].map((_, k) => <Star key={k} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
                    <span className="ml-1 font-semibold text-gray-700 dark:text-gray-300">4.9</span>
                    <span className="text-gray-400"> · 12K reviews</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* RIGHT Dashboard card with decorative rings */}
            <motion.div
              className="relative flex items-center justify-center lg:justify-end"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Decorative rings */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2">
                <div className="h-[460px] w-[460px] rounded-full border border-brand-300/20 dark:border-brand-700/20" />
                <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-400/25 dark:border-violet-700/25" />
                <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-pink-400/20 dark:border-pink-700/20" />
                <div className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-brand-400/15 via-violet-400/10 to-pink-400/8 blur-3xl" />
              </div>

              <div className="relative w-full max-w-sm">
                {/* Main card */}
                <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-2xl shadow-brand-500/10 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/90">
                  <div className="bg-gradient-to-br from-brand-700 via-brand-800 to-violet-800 px-5 py-4 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Today's Classes</p>
                          <p className="text-[11px] text-blue-200">3 sessions scheduled</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                        Live now
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 p-4">
                    {[
                      { subj: 'Advanced Mathematics', tutor: 'Dr. Mehta',  time: '10:00 AM', live: false, color: 'bg-blue-400' },
                      { subj: 'Physics Mechanics',    tutor: 'Ms. Sharma', time: '12:30 PM', live: true,  color: 'bg-emerald-400' },
                      { subj: 'English Literature',   tutor: 'Mr. Rao',    time: '3:00 PM',  live: false, color: 'bg-violet-400' },
                    ].map((c) => (
                      <div key={c.subj} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3.5 py-2.5 dark:bg-gray-800/60">
                        <div className={`h-2 w-2 shrink-0 rounded-full ${c.live ? 'animate-pulse ' : ''}${c.color}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{c.subj}</p>
                          <p className="truncate text-[10px] text-gray-500">{c.time} · {c.tutor}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.live ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                          {c.live ? 'Live' : 'Soon'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-gray-100 p-4 dark:border-gray-800">
                    {[
                      { label: 'Attendance', value: '94%',  accent: 'text-emerald-600' },
                      { label: 'Balance',    value: '$4.8K', accent: 'text-brand-600' },
                      { label: 'Rating',     value: '4.9★', accent: 'text-amber-500' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl bg-gray-50 px-2 py-2 text-center dark:bg-gray-800/50">
                        <p className={`text-sm font-extrabold ${s.accent}`}>{s.value}</p>
                        <p className="text-[10px] text-gray-500">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating chips */}
                <motion.div
                  className="absolute -left-12 top-8 hidden rounded-2xl border border-white/60 bg-white/90 p-3 shadow-xl backdrop-blur-xl lg:block dark:border-gray-800 dark:bg-gray-900/90"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-md">
                      <Video className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Live math class</p>
                      <p className="text-[10px] text-gray-500">Grade 6 · 5 min left</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute -right-10 top-16 hidden rounded-2xl border border-white/60 bg-white/90 px-3.5 py-2.5 shadow-xl backdrop-blur-xl lg:block dark:border-gray-800 dark:bg-gray-900/90"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                >
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-brand-500" />
                    <div>
                      <p className="text-xs font-bold">New assignment</p>
                      <p className="text-[10px] text-gray-500">Physics · due today</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute -left-10 bottom-12 hidden rounded-2xl border border-white/60 bg-white/90 p-3 shadow-xl backdrop-blur-xl lg:block dark:border-gray-800 dark:bg-gray-900/90"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                >
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-bold">Top rated</span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute -right-8 bottom-20 hidden rounded-2xl border border-white/60 bg-white/90 px-3.5 py-2.5 shadow-xl backdrop-blur-xl lg:block dark:border-gray-800 dark:bg-gray-900/90"
                  animate={{ y: [0, -7, 0] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold">248 students online</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          MARQUEE
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-y border-gray-100 bg-gradient-to-r from-brand-50/50 via-violet-50/40 to-pink-50/40 py-7 dark:border-gray-800 dark:from-brand-950/20 dark:via-violet-950/20 dark:to-pink-950/20">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-[#faf8ff] to-transparent dark:from-gray-950" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-[#faf8ff] to-transparent dark:from-gray-950" />
        <div className="flex animate-[marquee_40s_linear_infinite] gap-10 whitespace-nowrap">
          {[...SUBJECTS_MARQUEE, ...SUBJECTS_MARQUEE].map((s, i) => (
            <div key={i} className="flex shrink-0 items-center gap-3 text-xl font-bold text-gray-400 md:text-2xl">
              <Sparkles className="h-4 w-4 text-brand-400" />
              <span>{s}</span>
              <span className="text-brand-300">·</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          STATS
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-2 gap-4 md:grid-cols-4"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {STATS.map((s) => (
              <AnimatedStat key={s.label} {...s} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FEATURES BENTO GRID
      ══════════════════════════════════════════════════════════════ */}
      <section id="features" className="relative overflow-hidden border-t border-gray-100 bg-gradient-to-br from-gray-50/60 to-white py-24 dark:border-gray-800 dark:from-gray-900/60 dark:to-gray-950">
        <div className="pointer-events-none absolute -left-40 top-20 -z-10 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-brand-200/15 to-violet-200/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 bottom-20 -z-10 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-pink-200/10 to-orange-200/8 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-14 text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <SectionLabel>Platform features</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
              <span className="bg-gradient-to-r from-brand-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
                Everything you need to teach &amp; learn
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600 dark:text-gray-300">
              One platform for scheduling, live classes, payments and growth.
            </p>
          </motion.div>

          {/* Bento grid */}
          <motion.div
            className="grid grid-cols-1 grid-rows-none gap-4 md:grid-cols-3"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
          >
            {/* LARGE Live Classes */}
            <motion.div
              variants={fadeUp}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-violet-800 p-7 text-white shadow-2xl shadow-brand-500/20 md:col-span-2 md:row-span-2"
            >
              {/* Glow */}
              <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-brand-500/20 blur-2xl" />

              <div className="relative z-10">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3">
                  <Video className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand-300">Feature highlight</p>
                <h3 className="mt-2 text-2xl font-extrabold md:text-3xl">Live HD Classes</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-blue-200/90 md:text-base">
                  Real-time teaching via Agora, Zoom & Meet. Record every session students can replay at any time.
                </p>

                {/* Mini video call mockup */}
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20 backdrop-blur-sm">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                      <span className="text-xs font-semibold">Physics Mechanics · Live</span>
                    </div>
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">REC</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {[
                      { init: 'MS', label: 'Ms. Sharma', color: 'from-emerald-400 to-teal-500', host: true },
                      { init: 'AV', label: 'Arjun V.',   color: 'from-sky-400 to-blue-500',     host: false },
                      { init: 'KN', label: 'Kavya N.',   color: 'from-pink-400 to-rose-500',    host: false },
                      { init: 'RM', label: 'Rahul M.',   color: 'from-amber-400 to-orange-500', host: false },
                    ].map((p) => (
                      <div key={p.init} className="flex flex-col items-center gap-1">
                        <div className={`relative flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-br ${p.color} text-sm font-bold text-white shadow-md`}>
                          {p.init}
                          {p.host && (
                            <span className="absolute -top-1 -right-1 rounded-full bg-emerald-400 px-1 text-[8px] font-black text-white">HOST</span>
                          )}
                        </div>
                        <p className="truncate text-center text-[9px] text-blue-200/70 w-full">{p.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-2.5">
                    {[
                      { icon: Mic,      active: true,  bg: 'bg-white/15' },
                      { icon: Monitor,  active: true,  bg: 'bg-white/15' },
                      { icon: MicOff,   active: false, bg: 'bg-white/15' },
                      { icon: PhoneOff, active: false, bg: 'bg-red-500' },
                    ].map(({ icon: Icon, bg }, i) => (
                      <button key={i} className={`flex h-8 w-8 items-center justify-center rounded-full ${bg} transition-transform hover:scale-110`}>
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {['HD video', 'Screen share', 'Auto-record', 'Replay anytime'].map((tag) => (
                    <span key={tag} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Smart Scheduling */}
            <motion.div
              variants={fadeUp}
              className="group relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white p-6 shadow-md transition-all hover:-translate-y-1 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-200/30 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-sky-400 to-blue-500 transition-transform group-hover:scale-x-100" />
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg shadow-sky-400/30 transition-transform group-hover:scale-110 group-hover:rotate-3">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold">Smart Scheduling</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Flexible slots, real-time calendar sync and automated reminders.
              </p>
              <div className="mt-4 space-y-1.5">
                {['Tue 10:00 AM · Math', 'Wed 2:30 PM · Physics', 'Fri 4:00 PM · English'].map((slot, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-sky-50/60 px-3 py-2 text-xs dark:bg-sky-900/10">
                    <div className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">{slot}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Analytics */}
            <motion.div
              variants={fadeUp}
              className="group relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white p-6 shadow-md transition-all hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-200/30 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-violet-400 to-purple-500 transition-transform group-hover:scale-x-100" />
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-400/30 transition-transform group-hover:scale-110 group-hover:rotate-3">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold">Deep Analytics</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Attendance, progress reports and platform-wide insights.
              </p>
              {/* Mini bar chart */}
              <div className="mt-4 flex items-end gap-1.5 h-12">
                {[40, 65, 55, 80, 72, 90, 85].map((h, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 rounded-t-sm bg-gradient-to-t from-violet-500 to-purple-400"
                    style={{ height: `${h}%` }}
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.06, ease: 'backOut' }}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                <span className="font-semibold text-emerald-600">+18%</span> attendance this month
              </div>
            </motion.div>

            {/* Chat */}
            <motion.div
              variants={fadeUp}
              className="group relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white p-6 shadow-md transition-all hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-200/30 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-emerald-400 to-teal-500 transition-transform group-hover:scale-x-100" />
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-400/30 transition-transform group-hover:scale-110 group-hover:rotate-3">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold">Chat & Doubt-solving</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Private messaging between students, tutors and principals all in one place.
              </p>
              <div className="mt-3 space-y-1.5 text-xs">
                {[
                  { from: 'Arjun', msg: 'Sir, I don\'t get Q3 🤔', me: false },
                  { from: 'You',   msg: 'Let me explain step by step!', me: true },
                ].map((m, i) => (
                  <div key={i} className={`flex ${m.me ? 'justify-end' : ''}`}>
                    <span className={`max-w-[80%] rounded-2xl px-3 py-1.5 font-medium ${m.me ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                      {m.msg}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Payments */}
            <motion.div
              variants={fadeUp}
              className="group relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white p-6 shadow-md transition-all hover:-translate-y-1 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-200/30 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-amber-400 to-orange-500 transition-transform group-hover:scale-x-100" />
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-400/30 transition-transform group-hover:scale-110 group-hover:rotate-3">
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold">Secure Payments</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Stripe & Razorpay. Wallet credits, auto-refunds and tutor payouts.
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <p className="text-2xl font-extrabold text-amber-600">$4.8K</p>
                <p className="text-xs text-gray-400">wallet balance</p>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                <div className="h-1.5 w-3/4 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" />
              </div>
            </motion.div>

            {/* RBAC */}
            <motion.div
              variants={fadeUp}
              className="group relative overflow-hidden rounded-3xl border border-gray-200/70 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-md transition-all hover:-translate-y-1 hover:shadow-xl dark:border-gray-700"
            >
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-500/10 to-violet-500/10" />
              <div className="relative z-10">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-500/30 transition-transform group-hover:scale-110 group-hover:rotate-3">
                  <Shield className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white">Role-based Access</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
                  7 secure tiers: Admin, Principal, Tutor, Student, Parent & Support.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['Super Admin', 'Admin', 'Principal', 'Tutor', 'Student', 'Parent', 'Support'].map((r) => (
                    <span key={r} className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-gray-300">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="overflow-hidden bg-white py-24 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-16 text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <SectionLabel>The journey</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
              <span className="bg-gradient-to-r from-brand-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
                How your child will progress
              </span>
            </h2>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.55, delay: i * 0.15 }}
                className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${step.bg} border border-gray-200/60 p-8 shadow-md transition-all hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-none dark:from-transparent dark:to-transparent dark:bg-gray-900`}
              >
                {/* Step number watermark */}
                <p className={`absolute -right-4 -top-6 bg-gradient-to-br ${step.color} bg-clip-text text-[7rem] font-black text-transparent opacity-10 leading-none select-none`}>
                  {step.step}
                </p>

                <div className={`relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} text-2xl font-black text-white shadow-xl ${step.glow} transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                  {step.step}
                </div>
                <h3 className="relative z-10 text-xl font-extrabold">{step.title}</h3>
                <p className="relative z-10 mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{step.desc}</p>

                {i < STEPS.length - 1 && (
                  <ChevronRight className="absolute right-4 top-1/2 hidden -translate-y-1/2 h-5 w-5 text-gray-300 md:block dark:text-gray-600" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SKILLS TABS
      ══════════════════════════════════════════════════════════════ */}
      <section className="border-t border-gray-100 bg-gradient-to-br from-gray-50/50 to-white py-24 dark:border-gray-800 dark:from-gray-900 dark:to-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mx-auto mb-14 max-w-2xl text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <SectionLabel>Skills focus</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
              <span className="bg-gradient-to-r from-brand-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
                What your child will learn
              </span>
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Switch between skill areas to see how our tutors turn concepts into superpowers.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-stretch">
            <div className="flex flex-col gap-2.5">
              {SKILL_TABS.map((tab) => {
                const active = activeSkill === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSkill(tab.id)}
                    className={`w-full rounded-2xl px-5 py-4 text-left transition-all ${
                      active
                        ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-xl shadow-brand-500/25 scale-[1.02]'
                        : 'border border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-800/60'
                    }`}
                  >
                    <p className="flex items-center gap-2 text-sm font-bold">
                      <span className={`inline-block h-2 w-2 rounded-full ${active ? 'bg-white' : 'bg-brand-500'}`} />
                      {tab.title}
                    </p>
                    <p className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-gray-500'}`}>{tab.subtitle}</p>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeSkill}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.3 }}
                className="grid items-center gap-6 rounded-[2rem] border border-gray-200/70 bg-white p-6 shadow-xl md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:p-8 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600">Skills focus</p>
                  <h3 className="text-2xl font-extrabold md:text-3xl">{currentSkill.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 md:text-base">{currentSkill.subtitle}</p>
                  <ul className="space-y-2 pt-1">
                    {currentSkill.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 pt-2 text-xs text-gray-500">
                    <Users className="h-4 w-4 text-brand-500" />
                    <span>Thousands of kids on Takshashila are building this skill right now.</span>
                  </div>
                </div>
                <div className="relative h-48 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-100 via-violet-100 to-pink-100 md:h-64 dark:from-brand-900/40 dark:via-violet-900/40 dark:to-pink-900/40">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <GraduationCap className="h-32 w-32 text-brand-600/20 dark:text-brand-400/30" />
                  </div>
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 shadow-sm backdrop-blur-xl dark:bg-gray-900/80">
                    <GraduationCap className="h-4 w-4 text-brand-600" />
                    <span className="text-[11px] text-gray-600 dark:text-gray-300">Fun, kid-friendly activities</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          LEARNING FLOW
      ══════════════════════════════════════════════════════════════ */}
      <section className="border-t border-gray-100 py-20 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mx-auto mb-12 max-w-2xl text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <SectionLabel>Learning loop</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
              <span className="bg-gradient-to-r from-brand-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
                How learning feels on Takshashila
              </span>
            </h2>
          </motion.div>
          <motion.div
            className="grid grid-cols-2 items-start gap-6 text-center md:grid-cols-5"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { icon: Video,         title: 'Join a class',   desc: 'Jump into live sessions.' },
              { icon: BookOpen,      title: 'Assignments',    desc: 'Reinforce what you learnt.' },
              { icon: Layout,        title: 'Worksheets',     desc: 'Extra practice at all levels.' },
              { icon: MessageSquare, title: 'Chat doubts',    desc: 'Ask anything, anytime.' },
              { icon: Play,          title: 'Recordings',     desc: 'Rewatch for revision.' },
            ].map((it, i) => {
              const Icon = it.icon;
              return (
                <motion.div key={it.title} variants={fadeUp} className="flex flex-col items-center gap-3">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-gray-200/70 bg-gradient-to-br from-brand-50 via-white to-violet-50 shadow-xl transition-transform hover:rotate-3 hover:scale-110 md:h-28 md:w-28 dark:border-gray-800 dark:from-brand-900/30 dark:via-gray-900 dark:to-violet-900/30">
                    <Icon className="h-10 w-10 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="max-w-[160px] space-y-1">
                    <p className="text-sm font-bold">{it.title}</p>
                    <p className="text-xs text-gray-500">{it.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════════ */}
      <section id="testimonials" className="relative overflow-hidden border-t border-gray-100 bg-gradient-to-br from-gray-50/50 to-white py-24 dark:border-gray-800 dark:from-gray-900 dark:to-gray-950">
        <div className="pointer-events-none absolute -left-32 top-10 -z-10 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-brand-300/10 to-violet-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-10 -z-10 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-pink-300/10 to-orange-300/10 blur-3xl" />

        <motion.div
          className="mx-auto mb-14 max-w-3xl px-4 text-center sm:px-6 lg:px-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-white/60 px-4 py-1.5 text-sm font-semibold text-brand-700 shadow-sm backdrop-blur-xl dark:border-brand-800/50 dark:bg-brand-900/20 dark:text-brand-300">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            Rated 4.9 / 5 by our community
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
            <span className="bg-gradient-to-r from-brand-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
              Loved by parents, students &amp; tutors
            </span>
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Real stories from families, students and tutors on Takshashila.
          </p>
        </motion.div>

        <InfiniteCarouselWall />
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PARENTS SECTION dark glass card
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-gray-950 via-brand-950 to-violet-950 p-8 md:p-14"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.65 }}
          >
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-violet-600/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-12 top-1/2 h-48 w-48 rounded-full bg-pink-600/10 blur-2xl" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '28px 28px',
              }}
            />

            <div className="relative z-10 grid gap-12 lg:grid-cols-[1fr_420px] lg:items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-brand-300 backdrop-blur-xl">
                  <Heart className="h-3.5 w-3.5 fill-pink-400 text-pink-400" />
                  Built for families
                </div>
                <h2 className="text-3xl font-extrabold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-violet-400 to-pink-400">
                    Parents,
                  </span>{' '}
                  we know exactly what you need
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { icon: Calendar,   label: 'Monthly parent-tutor meetings',  desc: 'Stay in the loop every month' },
                    { icon: Sparkles,   label: 'Positive learning environment',  desc: 'Safe, encouraging and fun' },
                    { icon: Wallet,     label: 'Flexible payment options',        desc: 'Pay as you go or subscribe' },
                    { icon: BarChart3,  label: 'Weekly performance reports',      desc: 'Know exactly how they improve' },
                  ].map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/10">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 shadow-lg shadow-brand-500/20">
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/tutors"
                    className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 via-violet-500 to-pink-500 px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-brand-500/30 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-violet-500/40"
                  >
                    <Heart className="h-5 w-5 fill-white/80" />
                    Browse tutors
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    to="/register/parent"
                    className="group inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/15"
                  >
                    Join as Parent
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex items-center gap-5 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/25">
                    <ShieldCheck className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">NIOS-valid curriculum</p>
                    <p className="text-sm text-gray-400">Equal to CBSE · Government recognized</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-xs font-medium text-emerald-400">Fully accredited</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 shadow-md shadow-sky-500/20">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-2xl font-extrabold text-white">87%</p>
                  <p className="mt-0.5 text-xs text-gray-400">improve in 30 days</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/20">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-2xl font-extrabold text-white">1-click</p>
                  <p className="mt-0.5 text-xs text-gray-400">book a free demo</p>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 shadow-md shadow-pink-500/20">
                      <Headphones className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">24 / 7 Parent Support</p>
                      <p className="text-xs text-gray-400">Chat, call or email always reachable</p>
                    </div>
                  </div>
                  <div className="hidden items-center gap-1.5 sm:flex">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">Online now</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CTA BANNER
      ══════════════════════════════════════════════════════════════ */}
      <CtaBanner />

      {/* ══════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-800 bg-gray-950 pt-16 pb-10 text-gray-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-[200px_1fr_1fr_1fr]">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600">
                  <GraduationCap className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-extrabold text-white">Takshashila</span>
              </div>
              <p className="text-sm leading-relaxed">
                India's modern tutoring marketplace connecting students with expert tutors.
              </p>
              <div className="flex gap-2">
                {['4.9', '★', '12K reviews'].map((t) => (
                  <span key={t} className="text-xs font-semibold text-amber-400">{t}</span>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500">Platform</p>
              <ul className="space-y-2.5 text-sm">
                {[
                  { label: 'Find Tutors', to: '/tutors' },
                  { label: 'Sign in',     to: '/login' },
                  { label: 'Register',    to: '/register' },
                  { label: 'Features',    href: '#features' },
                ].map(({ label, to, href }) => (
                  <li key={label}>
                    {to ? (
                      <Link to={to} className="transition-colors hover:text-white">{label}</Link>
                    ) : (
                      <a href={href} className="transition-colors hover:text-white">{label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Roles */}
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500">Who it's for</p>
              <ul className="space-y-2.5 text-sm">
                {['Students', 'Tutors', 'School Principals', 'Parents'].map((r) => (
                  <li key={r} className="transition-colors hover:text-white cursor-default">{r}</li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500">Legal</p>
              <ul className="space-y-2.5 text-sm">
                {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Contact Us'].map((l) => (
                  <li key={l} className="cursor-pointer transition-colors hover:text-white">{l}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-gray-800 pt-8 text-sm md:flex-row">
            <p>© 2026 Takshashila. All rights reserved.</p>
            <p className="text-gray-600">Made with <Heart className="inline h-3 w-3 fill-pink-500 text-pink-500" /> for learners everywhere.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
