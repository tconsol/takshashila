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
  { label: 'Active students', num: 50000, display: '50K+', tint: 'bg-clay-mint',   ink: 'text-clay-green-dark' },
  { label: 'Expert tutors',   num: 5000,  display: '5K+',  tint: 'bg-clay-coral',  ink: 'text-rose-700' },
  { label: 'Subjects',        num: 100,   display: '100+', tint: 'bg-clay-yellow', ink: 'text-amber-700' },
  { label: 'Avg. rating',     num: 49,    display: '4.9★', tint: 'bg-clay-pink',   ink: 'text-pink-700' },
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
    tint: 'bg-clay-mint',
  },
  {
    step: '02',
    title: 'Progress fast',
    desc: 'Live classes, real-time feedback and targeted practice.',
    tint: 'bg-clay-sky',
  },
  {
    step: '03',
    title: 'Ace exams & shine',
    desc: 'Confidence to tackle any exam, debate or presentation.',
    tint: 'bg-clay-purple',
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

/* ─── shared classes (claymorphism) ───────────────────────────────── */

const CLAY_CARD = 'rounded-[28px] border-2.5 border-clay-ink bg-white shadow-clay dark:bg-gray-900';
const CLAY_CARD_LG = 'rounded-[32px] border-2.5 border-clay-ink shadow-clay-lg';
const CLAY_PRESS = 'transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-clay-pressed';

/* ─── helpers ────────────────────────────────────────────────────── */

function SectionLabel({ children, tint = 'bg-clay-mint' }: { children: React.ReactNode; tint?: string }) {
  return (
    <div className={`mb-5 inline-flex items-center gap-2 rounded-full border-2.5 border-clay-ink ${tint} px-4 py-1.5 text-sm font-extrabold text-clay-ink shadow-clay-sm`}>
      <Sparkles className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function AnimatedStat({ display, label, tint, ink }: (typeof STATS)[0]) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      className={`relative overflow-hidden ${CLAY_CARD} p-6 ${CLAY_PRESS}`}
    >
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full ${tint} border-2.5 border-clay-ink opacity-60`} />
      <motion.p
        className={`relative text-4xl font-black md:text-5xl ${ink}`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, ease: 'backOut' }}
      >
        {display}
      </motion.p>
      <p className="relative mt-1.5 text-sm font-bold text-clay-ink/70 dark:text-gray-400">{label}</p>
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
    <div className="min-h-screen bg-clay-bg text-clay-ink antialiased selection:bg-clay-green selection:text-white dark:bg-gray-950 dark:text-white">

      {/* ══════════════════════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-4 z-50 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="flex h-16 items-center justify-between rounded-[28px] border-2.5 border-clay-ink bg-white px-4 shadow-clay sm:px-6 dark:bg-gray-950">
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-clay-coral">
              <GraduationCap className="h-5 w-5 text-clay-ink" />
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
                <a key={label} href={href} className="text-sm font-bold text-clay-ink transition-colors hover:text-clay-green-dark dark:text-gray-300">
                  {label}
                </a>
              ) : (
                <Link key={label} to={href} className="flex items-center gap-1.5 text-sm font-bold text-clay-ink transition-colors hover:text-clay-green-dark dark:text-gray-300">
                  {Icon && <Icon className="h-3.5 w-3.5" />} {label}
                </Link>
              )
            ))}
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <Link
                to={ROLE_DASHBOARD_PATHS[user.role]}
                className={`inline-flex items-center gap-1.5 rounded-2xl border-2.5 border-clay-ink bg-clay-green px-5 py-2.5 text-sm font-extrabold text-white shadow-clay ${CLAY_PRESS}`}
              >
                Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden text-sm font-bold text-clay-ink transition-colors hover:text-clay-green-dark dark:text-gray-300 sm:block">
                  Sign in
                </Link>
                <Link
                  to="/register/student"
                  className={`inline-flex items-center gap-1.5 rounded-2xl border-2.5 border-clay-ink bg-clay-green px-5 py-2.5 text-sm font-extrabold text-white shadow-clay ${CLAY_PRESS}`}
                >
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
      <section className="relative overflow-hidden pb-20 pt-12 lg:pt-20 lg:pb-28">
        {/* Floating clay shapes */}
        <motion.div
          aria-hidden
          className="absolute right-[6%] top-[8%] h-16 w-16 rounded-3xl border-2.5 border-clay-ink bg-clay-yellow"
          animate={{ y: [0, -14, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="absolute left-[3%] top-[42%] h-12 w-12 rounded-full border-2.5 border-clay-ink bg-clay-pink"
          animate={{ y: [0, 14, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="absolute right-[12%] bottom-[10%] h-10 w-10 rounded-2xl border-2.5 border-clay-ink bg-clay-sky rotate-12"
          animate={{ rotate: [12, -8, 12] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />

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
                <div className="inline-flex items-center gap-2 rounded-full border-2.5 border-clay-ink bg-clay-mint px-4 py-1.5 text-sm font-extrabold text-clay-ink shadow-clay-sm">
                  <span className="flex h-2 w-2 animate-pulse rounded-full bg-clay-green-dark" />
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
                        className="absolute left-0 top-0 text-clay-green-dark"
                      >
                        {ROTATING_SUBJECTS[wordIdx]}
                      </motion.span>
                    </AnimatePresence>
                    <span className="invisible">Computer Science</span>
                  </span>
                </h1>
              </motion.div>

              <motion.p variants={fadeUp} className="max-w-xl text-lg leading-relaxed text-clay-ink/70 dark:text-gray-300 md:text-xl">
                Search by grade, subject and schedule. Compare profiles, ratings and teaching style then book a live demo in one click.
              </motion.p>

              {/* CTAs */}
              <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
                <Link
                  to="/tutors"
                  className={`group inline-flex items-center gap-2 rounded-2xl border-2.5 border-clay-ink bg-clay-green px-7 py-3.5 text-base font-extrabold text-white shadow-clay ${CLAY_PRESS}`}
                >
                  <Rocket className="h-5 w-5" />
                  Find tutors
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/register/student"
                  className={`inline-flex items-center gap-2 rounded-2xl border-2.5 border-clay-ink bg-white px-7 py-3.5 text-base font-extrabold text-clay-ink shadow-clay ${CLAY_PRESS}`}
                >
                  <Play className="h-4 w-4 fill-current" /> Book a free demo
                </Link>
              </motion.div>

              {/* Social proof */}
              <motion.div variants={fadeUp} className="flex items-center gap-4">
                <div className="flex -space-x-2.5">
                  {[
                    { i: 'PS', t: 'bg-clay-coral' },
                    { i: 'RM', t: 'bg-clay-mint' },
                    { i: 'AV', t: 'bg-clay-sky' },
                    { i: 'KN', t: 'bg-clay-purple' },
                    { i: 'DK', t: 'bg-clay-yellow' },
                  ].map(({ i, t }, idx) => (
                    <div
                      key={i}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2.5 border-clay-ink ${t} text-[10px] font-extrabold text-clay-ink`}
                      style={{ zIndex: 5 - idx }}
                    >
                      {i}
                    </div>
                  ))}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2.5 border-clay-ink bg-white text-[10px] font-extrabold text-clay-ink">
                    +99
                  </div>
                </div>
                <div className="text-sm text-clay-ink/70 dark:text-gray-400">
                  <span className="font-extrabold text-clay-ink dark:text-white">50,000+ students</span> joined this month
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {[...Array(5)].map((_, k) => <Star key={k} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
                    <span className="ml-1 font-extrabold text-clay-ink dark:text-gray-300">4.9</span>
                    <span className="text-clay-ink/50"> · 12K reviews</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* RIGHT — clay dashboard mock */}
            <motion.div
              className="relative flex items-center justify-center lg:justify-end"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative w-full max-w-sm">
                {/* Main card */}
                <div className={`overflow-hidden ${CLAY_CARD_LG} bg-white dark:bg-gray-900`}>
                  <div className="bg-clay-green border-b-2.5 border-clay-ink px-5 py-4 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-clay-ink bg-white">
                          <BookOpen className="h-4 w-4 text-clay-ink" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold">Today's Classes</p>
                          <p className="text-[11px] font-bold text-white/80">3 sessions scheduled</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-clay-ink bg-white px-2.5 py-1 text-[10px] font-extrabold text-clay-green-dark">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-clay-green-dark" />
                        Live now
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 p-4">
                    {[
                      { subj: 'Advanced Mathematics', tutor: 'Dr. Mehta',  time: '10:00 AM', live: false, tint: 'bg-clay-sky' },
                      { subj: 'Physics Mechanics',    tutor: 'Ms. Sharma', time: '12:30 PM', live: true,  tint: 'bg-clay-mint' },
                      { subj: 'English Literature',   tutor: 'Mr. Rao',    time: '3:00 PM',  live: false, tint: 'bg-clay-purple' },
                    ].map((c) => (
                      <div key={c.subj} className={`flex items-center gap-3 rounded-2xl border-2 border-clay-ink ${c.tint} px-3 py-2.5`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-extrabold text-clay-ink">{c.subj}</p>
                          <p className="truncate text-[10px] font-semibold text-clay-ink/70">{c.time} · {c.tutor}</p>
                        </div>
                        <span className={`rounded-full border-2 border-clay-ink px-2 py-0.5 text-[10px] font-extrabold ${c.live ? 'bg-clay-green text-white' : 'bg-white text-clay-ink'}`}>
                          {c.live ? 'Live' : 'Soon'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t-2 border-dashed border-clay-ink/20 p-4">
                    {[
                      { label: 'Attendance', value: '94%',  tint: 'bg-clay-mint' },
                      { label: 'Balance',    value: '$4.8K', tint: 'bg-clay-yellow' },
                      { label: 'Rating',     value: '4.9★', tint: 'bg-clay-coral' },
                    ].map((s) => (
                      <div key={s.label} className={`rounded-2xl border-2 border-clay-ink ${s.tint} px-2 py-2 text-center`}>
                        <p className="text-sm font-black text-clay-ink">{s.value}</p>
                        <p className="text-[10px] font-bold text-clay-ink/70">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating chips */}
                <motion.div
                  className={`absolute -left-12 top-8 hidden ${CLAY_CARD} p-3 lg:block`}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-clay-ink bg-clay-purple">
                      <Video className="h-4 w-4 text-clay-ink" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold">Live math class</p>
                      <p className="text-[10px] font-semibold text-clay-ink/70">Grade 6 · 5 min left</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className={`absolute -right-10 top-16 hidden ${CLAY_CARD} px-3.5 py-2.5 lg:block`}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-clay-ink bg-clay-yellow">
                      <Bell className="h-3.5 w-3.5 text-clay-ink" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold">New assignment</p>
                      <p className="text-[10px] font-semibold text-clay-ink/70">Physics · due today</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className={`absolute -left-10 bottom-12 hidden ${CLAY_CARD} p-3 lg:block`}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                >
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500 fill-amber-400" />
                    <span className="text-xs font-extrabold">Top rated</span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className={`absolute -right-8 bottom-20 hidden ${CLAY_CARD} px-3.5 py-2.5 lg:block`}
                  animate={{ y: [0, -7, 0] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-clay-green-dark" />
                    <span className="text-xs font-extrabold">248 students online</span>
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
      <section className="relative overflow-hidden border-y-2.5 border-clay-ink bg-clay-yellow py-7">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-clay-yellow to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-clay-yellow to-transparent" />
        <div className="flex animate-[marquee_40s_linear_infinite] gap-10 whitespace-nowrap">
          {[...SUBJECTS_MARQUEE, ...SUBJECTS_MARQUEE].map((s, i) => (
            <div key={i} className="flex shrink-0 items-center gap-3 text-xl font-extrabold text-clay-ink md:text-2xl">
              <Sparkles className="h-4 w-4" />
              <span>{s}</span>
              <span className="text-clay-ink/40">·</span>
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
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-14 text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <SectionLabel tint="bg-clay-mint">Platform features</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl text-clay-ink">
              Everything you need to{' '}
              <span className="bg-clay-green text-white px-3 -mx-1 inline-block rounded-2xl border-2.5 border-clay-ink">
                teach &amp; learn
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-clay-ink/70 dark:text-gray-300">
              One platform for scheduling, live classes, payments and growth.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
          >
            {/* LARGE Live Classes */}
            <motion.div
              variants={fadeUp}
              className="group relative overflow-hidden rounded-[32px] border-2.5 border-clay-ink bg-clay-green p-7 text-white shadow-clay-lg md:col-span-2 md:row-span-2"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-3xl border-2.5 border-clay-ink bg-clay-yellow rotate-12" />

              <div className="relative z-10">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-white text-clay-ink shadow-clay">
                  <Video className="h-6 w-6" />
                </div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-white/80">Feature highlight</p>
                <h3 className="mt-2 text-2xl font-extrabold md:text-3xl">Live HD Classes</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-white/90 md:text-base">
                  Real-time teaching via Agora, Zoom & Meet. Record every session students can replay at any time.
                </p>

                {/* Mini video call mockup */}
                <div className="mt-6 overflow-hidden rounded-2xl border-2.5 border-clay-ink bg-white text-clay-ink">
                  <div className="flex items-center justify-between border-b-2 border-clay-ink/20 bg-clay-mint px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                      <span className="text-xs font-extrabold">Physics Mechanics · Live</span>
                    </div>
                    <span className="rounded-full border-2 border-clay-ink bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white">REC</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {[
                      { init: 'MS', label: 'Ms. Sharma', tint: 'bg-clay-mint', host: true },
                      { init: 'AV', label: 'Arjun V.',   tint: 'bg-clay-sky', host: false },
                      { init: 'KN', label: 'Kavya N.',   tint: 'bg-clay-pink', host: false },
                      { init: 'RM', label: 'Rahul M.',   tint: 'bg-clay-yellow', host: false },
                    ].map((p) => (
                      <div key={p.init} className="flex flex-col items-center gap-1">
                        <div className={`relative flex h-12 w-full items-center justify-center rounded-xl border-2 border-clay-ink ${p.tint} text-sm font-extrabold text-clay-ink`}>
                          {p.init}
                          {p.host && (
                            <span className="absolute -top-1 -right-1 rounded-full border-2 border-clay-ink bg-clay-green px-1 text-[8px] font-black text-white">HOST</span>
                          )}
                        </div>
                        <p className="truncate text-center text-[9px] font-semibold text-clay-ink/70 w-full">{p.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-3 border-t-2 border-clay-ink/20 px-4 py-2.5">
                    {[
                      { icon: Mic,      tint: 'bg-white' },
                      { icon: Monitor,  tint: 'bg-white' },
                      { icon: MicOff,   tint: 'bg-white' },
                      { icon: PhoneOff, tint: 'bg-rose-500 text-white' },
                    ].map(({ icon: Icon, tint }, i) => (
                      <button key={i} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-clay-ink ${tint} transition-transform hover:scale-110`}>
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {['HD video', 'Screen share', 'Auto-record', 'Replay anytime'].map((tag) => (
                    <span key={tag} className="rounded-full border-2 border-white/40 bg-white/15 px-3 py-1 text-[11px] font-bold">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Smart Scheduling */}
            <motion.div variants={fadeUp} className={`group ${CLAY_CARD} p-6 ${CLAY_PRESS}`}>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-clay-sky text-clay-ink shadow-clay-sm">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="text-base font-extrabold">Smart Scheduling</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-clay-ink/70 dark:text-gray-400">
                Flexible slots, real-time calendar sync and automated reminders.
              </p>
              <div className="mt-4 space-y-1.5">
                {['Tue 10:00 AM · Math', 'Wed 2:30 PM · Physics', 'Fri 4:00 PM · English'].map((slot, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border-2 border-clay-ink bg-clay-sky/40 px-3 py-2 text-xs">
                    <div className="h-1.5 w-1.5 rounded-full bg-sky-600" />
                    <span className="font-extrabold text-clay-ink">{slot}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Analytics */}
            <motion.div variants={fadeUp} className={`group ${CLAY_CARD} p-6 ${CLAY_PRESS}`}>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-clay-purple text-clay-ink shadow-clay-sm">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-extrabold">Deep Analytics</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-clay-ink/70 dark:text-gray-400">
                Attendance, progress reports and platform-wide insights.
              </p>
              <div className="mt-4 flex items-end gap-1.5 h-12">
                {[40, 65, 55, 80, 72, 90, 85].map((h, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 rounded-t-md border-2 border-clay-ink bg-clay-purple"
                    style={{ height: `${h}%` }}
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.06, ease: 'backOut' }}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5 text-clay-green-dark" />
                <span className="font-extrabold text-clay-green-dark">+18%</span>
                <span className="text-clay-ink/60">attendance this month</span>
              </div>
            </motion.div>

            {/* Chat */}
            <motion.div variants={fadeUp} className={`group ${CLAY_CARD} p-6 ${CLAY_PRESS}`}>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-clay-mint text-clay-ink shadow-clay-sm">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-base font-extrabold">Chat & Doubt-solving</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-clay-ink/70 dark:text-gray-400">
                Private messaging between students, tutors and principals all in one place.
              </p>
              <div className="mt-3 space-y-1.5 text-xs">
                {[
                  { from: 'Arjun', msg: "Sir, I don't get Q3 🤔", me: false },
                  { from: 'You',   msg: 'Let me explain step by step!', me: true },
                ].map((m, i) => (
                  <div key={i} className={`flex ${m.me ? 'justify-end' : ''}`}>
                    <span className={`max-w-[80%] rounded-2xl border-2 border-clay-ink px-3 py-1.5 font-extrabold ${m.me ? 'bg-clay-green text-white' : 'bg-white text-clay-ink'}`}>
                      {m.msg}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Payments */}
            <motion.div variants={fadeUp} className={`group ${CLAY_CARD} p-6 ${CLAY_PRESS}`}>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-clay-yellow text-clay-ink shadow-clay-sm">
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="text-base font-extrabold">Secure Payments</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-clay-ink/70 dark:text-gray-400">
                Stripe & Razorpay. Wallet credits, auto-refunds and tutor payouts.
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <p className="text-2xl font-black text-amber-600">$4.8K</p>
                <p className="text-xs font-bold text-clay-ink/60">wallet balance</p>
              </div>
              <div className="mt-2 h-3 w-full rounded-full border-2 border-clay-ink bg-white overflow-hidden">
                <div className="h-full w-3/4 rounded-full bg-clay-yellow" />
              </div>
            </motion.div>

            {/* RBAC */}
            <motion.div
              variants={fadeUp}
              className={`group relative overflow-hidden ${CLAY_CARD_LG} bg-clay-ink p-6 ${CLAY_PRESS} md:col-span-2`}
            >
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full border-2.5 border-clay-bg bg-clay-coral/20" />
              <div className="relative z-10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border-2.5 border-clay-bg bg-clay-coral text-clay-ink shadow-clay">
                  <Shield className="h-5 w-5" />
                </div>
                <h3 className="text-base font-extrabold text-white">Role-based Access</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/80">
                  7 secure tiers: Admin, Principal, Tutor, Student, Parent & Support.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['Super Admin', 'Admin', 'Principal', 'Tutor', 'Student', 'Parent', 'Support'].map((r) => (
                    <span key={r} className="rounded-full border-2 border-clay-bg/60 bg-white/10 px-2.5 py-0.5 text-[10px] font-extrabold text-white">
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
      <section id="how-it-works" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-16 text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <SectionLabel tint="bg-clay-sky">The journey</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl text-clay-ink">
              How your child will{' '}
              <span className="bg-clay-mint px-3 -mx-1 inline-block rounded-2xl border-2.5 border-clay-ink">progress</span>
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
                className={`group relative overflow-hidden rounded-[32px] border-2.5 border-clay-ink ${step.tint} p-8 shadow-clay ${CLAY_PRESS}`}
              >
                <div className="absolute -right-5 -top-5 flex h-20 w-20 items-center justify-center rounded-3xl border-2.5 border-clay-ink bg-white shadow-clay-sm">
                  <span className="text-2xl font-black text-clay-ink">{step.step}</span>
                </div>

                <div className="relative z-10 mb-5 mt-8 flex h-14 w-14 items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-white shadow-clay-sm">
                  <span className="text-xl font-black text-clay-ink">{step.step}</span>
                </div>
                <h3 className="relative z-10 text-xl font-extrabold text-clay-ink">{step.title}</h3>
                <p className="relative z-10 mt-2 text-sm leading-relaxed font-semibold text-clay-ink/80">{step.desc}</p>

                {i < STEPS.length - 1 && (
                  <ChevronRight className="absolute right-4 top-1/2 hidden -translate-y-1/2 h-5 w-5 text-clay-ink md:block" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SKILLS TABS
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mx-auto mb-14 max-w-2xl text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <SectionLabel tint="bg-clay-purple">Skills focus</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl text-clay-ink">
              What your child will{' '}
              <span className="bg-clay-yellow px-3 -mx-1 inline-block rounded-2xl border-2.5 border-clay-ink">learn</span>
            </h2>
            <p className="mt-4 text-lg text-clay-ink/70 dark:text-gray-300">
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
                    className={`w-full rounded-2xl border-2.5 border-clay-ink px-5 py-4 text-left transition-all ${
                      active
                        ? 'bg-clay-green text-white shadow-clay'
                        : 'bg-white text-clay-ink shadow-clay-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-clay-pressed'
                    }`}
                  >
                    <p className="flex items-center gap-2 text-sm font-extrabold">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full border-2 border-clay-ink ${active ? 'bg-white' : 'bg-clay-green'}`} />
                      {tab.title}
                    </p>
                    <p className={`mt-1 text-xs font-semibold ${active ? 'text-white/85' : 'text-clay-ink/70'}`}>{tab.subtitle}</p>
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
                className={`grid items-center gap-6 ${CLAY_CARD_LG} bg-white p-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:p-8`}
              >
                <div className="space-y-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-clay-green-dark">Skills focus</p>
                  <h3 className="text-2xl font-extrabold md:text-3xl text-clay-ink">{currentSkill.title}</h3>
                  <p className="text-sm font-semibold text-clay-ink/70 md:text-base">{currentSkill.subtitle}</p>
                  <ul className="space-y-2 pt-1">
                    {currentSkill.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm font-semibold text-clay-ink/80">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-clay-green-dark fill-clay-mint" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 pt-2 text-xs font-semibold text-clay-ink/60">
                    <Users className="h-4 w-4 text-clay-green-dark" />
                    <span>Thousands of kids on Takshashila are building this skill right now.</span>
                  </div>
                </div>
                <div className="relative h-48 overflow-hidden rounded-2xl border-2.5 border-clay-ink bg-clay-mint md:h-64">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <GraduationCap className="h-32 w-32 text-clay-ink/30" />
                  </div>
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border-2 border-clay-ink bg-white px-3 py-1">
                    <GraduationCap className="h-4 w-4 text-clay-green-dark" />
                    <span className="text-[11px] font-extrabold text-clay-ink">Fun, kid-friendly activities</span>
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
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mx-auto mb-12 max-w-2xl text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <SectionLabel tint="bg-clay-coral">Learning loop</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl text-clay-ink">
              How learning{' '}
              <span className="bg-clay-pink px-3 -mx-1 inline-block rounded-2xl border-2.5 border-clay-ink">feels</span>{' '}
              on Takshashila
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
              { icon: Video,         title: 'Join a class',   desc: 'Jump into live sessions.', tint: 'bg-clay-mint' },
              { icon: BookOpen,      title: 'Assignments',    desc: 'Reinforce what you learnt.', tint: 'bg-clay-sky' },
              { icon: Layout,        title: 'Worksheets',     desc: 'Extra practice at all levels.', tint: 'bg-clay-yellow' },
              { icon: MessageSquare, title: 'Chat doubts',    desc: 'Ask anything, anytime.', tint: 'bg-clay-coral' },
              { icon: Play,          title: 'Recordings',     desc: 'Rewatch for revision.', tint: 'bg-clay-purple' },
            ].map((it) => {
              const Icon = it.icon;
              return (
                <motion.div key={it.title} variants={fadeUp} className="flex flex-col items-center gap-3">
                  <div className={`flex h-28 w-28 items-center justify-center rounded-full border-2.5 border-clay-ink ${it.tint} shadow-clay transition-transform hover:rotate-3 hover:scale-110`}>
                    <Icon className="h-11 w-11 text-clay-ink" />
                  </div>
                  <div className="max-w-[160px] space-y-1">
                    <p className="text-sm font-extrabold text-clay-ink">{it.title}</p>
                    <p className="text-xs font-semibold text-clay-ink/60">{it.desc}</p>
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
      <section id="testimonials" className="border-y-2.5 border-clay-ink bg-clay-pink/40 py-24">
        <motion.div
          className="mx-auto mb-14 max-w-3xl px-4 text-center sm:px-6 lg:px-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2.5 border-clay-ink bg-white px-4 py-1.5 text-sm font-extrabold text-clay-ink shadow-clay-sm">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            Rated 4.9 / 5 by our community
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl text-clay-ink">
            Loved by{' '}
            <span className="bg-clay-green text-white px-3 -mx-1 inline-block rounded-2xl border-2.5 border-clay-ink">
              parents, students &amp; tutors
            </span>
          </h2>
          <p className="mt-4 text-lg text-clay-ink/70 dark:text-gray-300">
            Real stories from families, students and tutors on Takshashila.
          </p>
        </motion.div>

        <InfiniteCarouselWall />
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PARENTS SECTION
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="relative overflow-hidden rounded-[36px] border-2.5 border-clay-ink bg-clay-ink p-8 shadow-clay-lg md:p-14"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.65 }}
          >
            {/* Decorative clay shapes */}
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-3xl border-2.5 border-clay-bg bg-clay-coral rotate-12" />
            <div className="absolute -bottom-8 left-1/3 h-24 w-24 rounded-full border-2.5 border-clay-bg bg-clay-yellow" />
            <div className="absolute -left-8 top-1/2 h-20 w-20 rounded-2xl border-2.5 border-clay-bg bg-clay-pink -rotate-6" />

            <div className="relative z-10 grid gap-12 lg:grid-cols-[1fr_420px] lg:items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border-2.5 border-clay-bg bg-clay-pink px-4 py-1.5 text-sm font-extrabold text-clay-ink">
                  <Heart className="h-3.5 w-3.5 fill-clay-ink" />
                  Built for families
                </div>
                <h2 className="text-3xl font-extrabold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
                  <span className="bg-clay-yellow px-3 -mx-1 inline-block rounded-2xl border-2.5 border-clay-bg text-clay-ink">
                    Parents,
                  </span>{' '}
                  we know exactly what you need
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { icon: Calendar,   label: 'Monthly parent-tutor meetings',  desc: 'Stay in the loop every month', tint: 'bg-clay-mint' },
                    { icon: Sparkles,   label: 'Positive learning environment',  desc: 'Safe, encouraging and fun', tint: 'bg-clay-sky' },
                    { icon: Wallet,     label: 'Flexible payment options',        desc: 'Pay as you go or subscribe', tint: 'bg-clay-yellow' },
                    { icon: BarChart3,  label: 'Weekly performance reports',      desc: 'Know exactly how they improve', tint: 'bg-clay-purple' },
                  ].map(({ icon: Icon, label, desc, tint }) => (
                    <div key={label} className="flex items-start gap-3 rounded-2xl border-2 border-clay-bg/30 bg-white/5 p-4">
                      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-clay-bg ${tint}`}>
                        <Icon className="h-4 w-4 text-clay-ink" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-white">{label}</p>
                        <p className="text-xs font-semibold text-white/70">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/tutors"
                    className={`group inline-flex items-center gap-2 rounded-2xl border-2.5 border-clay-bg bg-clay-green px-7 py-3.5 text-base font-extrabold text-white shadow-[6px_6px_0_0_#FAF1E4] ${CLAY_PRESS}`}
                  >
                    <Heart className="h-5 w-5 fill-white/80" />
                    Browse tutors
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    to="/register/parent"
                    className={`group inline-flex items-center gap-2 rounded-2xl border-2.5 border-clay-bg bg-white px-7 py-3.5 text-base font-extrabold text-clay-ink shadow-[6px_6px_0_0_#FAF1E4] ${CLAY_PRESS}`}
                  >
                    Join as Parent
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex items-center gap-5 rounded-2xl border-2 border-clay-bg/30 bg-white/5 p-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2.5 border-clay-bg bg-clay-mint">
                    <ShieldCheck className="h-7 w-7 text-clay-ink" />
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-white">NIOS-valid curriculum</p>
                    <p className="text-sm font-semibold text-white/70">Equal to CBSE · Government recognized</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-clay-green" />
                      <span className="text-xs font-extrabold text-clay-green">Fully accredited</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-clay-bg/30 bg-white/5 p-5">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border-2.5 border-clay-bg bg-clay-sky">
                    <TrendingUp className="h-5 w-5 text-clay-ink" />
                  </div>
                  <p className="text-2xl font-black text-white">87%</p>
                  <p className="mt-0.5 text-xs font-semibold text-white/70">improve in 30 days</p>
                </div>
                <div className="rounded-2xl border-2 border-clay-bg/30 bg-white/5 p-5">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border-2.5 border-clay-bg bg-clay-yellow">
                    <Zap className="h-5 w-5 text-clay-ink" />
                  </div>
                  <p className="text-2xl font-black text-white">1-click</p>
                  <p className="mt-0.5 text-xs font-semibold text-white/70">book a free demo</p>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-2xl border-2 border-clay-bg/30 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2.5 border-clay-bg bg-clay-pink">
                      <Headphones className="h-5 w-5 text-clay-ink" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-white">24 / 7 Parent Support</p>
                      <p className="text-xs font-semibold text-white/70">Chat, call or email always reachable</p>
                    </div>
                  </div>
                  <div className="hidden items-center gap-1.5 sm:flex">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-clay-green" />
                    <span className="text-xs font-extrabold text-clay-green">Online now</span>
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
      <footer className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className={`bg-white p-8 ${CLAY_CARD_LG}`}>
          <div className="grid gap-10 md:grid-cols-[200px_1fr_1fr_1fr]">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-clay-coral">
                  <GraduationCap className="h-5 w-5 text-clay-ink" />
                </div>
                <span className="text-lg font-extrabold text-clay-ink">Takshashila</span>
              </div>
              <p className="text-sm font-semibold text-clay-ink/70 leading-relaxed">
                India's modern tutoring marketplace connecting students with expert tutors.
              </p>
              <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-clay-ink bg-clay-yellow px-3 py-1">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                <span className="text-xs font-extrabold text-clay-ink">4.9 · 12K reviews</span>
              </div>
            </div>

            {/* Platform */}
            <div>
              <p className="mb-4 text-xs font-extrabold uppercase tracking-widest text-clay-ink/50">Platform</p>
              <ul className="space-y-2.5 text-sm">
                {[
                  { label: 'Find Tutors', to: '/tutors' },
                  { label: 'Sign in',     to: '/login' },
                  { label: 'Register',    to: '/register' },
                  { label: 'Features',    href: '#features' },
                ].map(({ label, to, href }) => (
                  <li key={label}>
                    {to ? (
                      <Link to={to} className="font-semibold text-clay-ink/70 transition-colors hover:text-clay-green-dark">{label}</Link>
                    ) : (
                      <a href={href} className="font-semibold text-clay-ink/70 transition-colors hover:text-clay-green-dark">{label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Roles */}
            <div>
              <p className="mb-4 text-xs font-extrabold uppercase tracking-widest text-clay-ink/50">Who it's for</p>
              <ul className="space-y-2.5 text-sm">
                {['Students', 'Tutors', 'School Principals', 'Parents'].map((r) => (
                  <li key={r} className="font-semibold text-clay-ink/70 transition-colors hover:text-clay-green-dark cursor-pointer">{r}</li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="mb-4 text-xs font-extrabold uppercase tracking-widest text-clay-ink/50">Legal</p>
              <ul className="space-y-2.5 text-sm">
                {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Contact Us'].map((l) => (
                  <li key={l} className="font-semibold text-clay-ink/70 cursor-pointer transition-colors hover:text-clay-green-dark">{l}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t-2 border-dashed border-clay-ink/20 pt-6 text-sm md:flex-row">
            <p className="font-semibold text-clay-ink/70">© 2026 Takshashila. All rights reserved.</p>
            <p className="font-semibold text-clay-ink/60">Made with <Heart className="inline h-3.5 w-3.5 fill-rose-500 text-rose-500" /> for learners everywhere.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
