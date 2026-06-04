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
import ThreeDSlider from '../components/lightswind/ThreeDSlider';
import InteractiveGridBackground from '../components/lightswind/InteractiveGridBackground';
import { CtaBanner } from '../components/shared/CtaBanner';

const ROTATING_SUBJECTS = ['Mathematics', 'Physics', 'English', 'Coding', 'Chemistry', 'Biology'];

const SUBJECTS_MARQUEE = [
  'Mathematics', 'Science', 'English', 'Coding', 'Physics', 'Chemistry',
  'Biology', 'History', 'Geography', 'Economics', 'Computer Science', 'Public Speaking',
];

const STATS = [
  { label: 'Active students', target: 50,  suffix: 'K+', gradient: 'from-indigo-500 to-violet-600', icon: Users },
  { label: 'Expert tutors',   target: 5,   suffix: 'K+', gradient: 'from-violet-500 to-purple-600', icon: GraduationCap },
  { label: 'Subjects',        target: 100, suffix: '+',  gradient: 'from-teal-500 to-cyan-600',     icon: BookOpen },
  { label: 'Avg. rating',     target: 4.9, suffix: '★',  gradient: 'from-amber-400 to-orange-500',  icon: Star, decimal: true },
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

const JOURNEY_SLIDES = [
  {
    num: '01',
    title: 'Sign up free',
    imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&q=80',
  },
  {
    num: '02',
    title: 'Find your tutor',
    imageUrl: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=600&q=80',
  },
  {
    num: '03',
    title: 'Attend live classes',
    imageUrl: 'https://images.unsplash.com/photo-1596495577886-d920f1fb7238?w=600&q=80',
  },
  {
    num: '04',
    title: 'Track progress',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80',
  },
  {
    num: '05',
    title: 'Ace exams',
    imageUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&q=80',
  },
];

const STEPS = [
  {
    step: '01', color: 'from-indigo-500 to-indigo-600', dot: 'bg-indigo-500', icon: Sparkles,
    title: 'Sign up free',
    desc: 'Create your account in 2 minutes. Pick your role — student, parent or tutor. No credit card needed.',
    badge: 'Free forever',
  },
  {
    step: '02', color: 'from-violet-500 to-violet-600', dot: 'bg-violet-500', icon: Search,
    title: 'Find your perfect tutor',
    desc: 'Browse verified tutors by subject, language and schedule. Book a free demo class before committing.',
    badge: '5 K+ tutors',
  },
  {
    step: '03', color: 'from-sky-500 to-sky-600', dot: 'bg-sky-500', icon: Video,
    title: 'Attend live HD classes',
    desc: 'Real-time sessions via Zoom or our native classroom. Screen share, whiteboard and instant recording replay.',
    badge: 'HD video',
  },
  {
    step: '04', color: 'from-teal-500 to-teal-600', dot: 'bg-teal-500', icon: BarChart3,
    title: 'Track progress weekly',
    desc: 'Worksheets, assignments and attendance tracked automatically. Parents get weekly reports. No surprises.',
    badge: 'Auto-reports',
  },
  {
    step: '05', color: 'from-emerald-500 to-emerald-600', dot: 'bg-emerald-500', icon: Trophy,
    title: 'Ace exams & shine',
    desc: 'Confidence to tackle any exam, debate or presentation. 87 % of students improve within 30 days.',
    badge: '87 % improve',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-600">
      <Sparkles className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function AnimatedStat({ label, target, suffix, gradient, icon: Icon, decimal }: (typeof STATS)[0]) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const start = performance.now();
    const raf = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(parseFloat((target * eased).toFixed(decimal ? 1 : 0)));
      if (t < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [inView, target, decimal]);

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all group"
    >
      {/* gradient blob */}
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 group-hover:opacity-20 transition-opacity`} />
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className={`text-4xl font-extrabold bg-gradient-to-r ${gradient} bg-clip-text text-transparent md:text-5xl tabular-nums`}>
        {decimal ? val.toFixed(1) : val}{suffix}
      </p>
      <p className="mt-1.5 text-sm font-medium text-slate-500">{label}</p>
    </motion.div>
  );
}

export function LandingPage() {
  const { isAuthenticated, user } = useAuthStore();
  const [activeSkill, setActiveSkill] = useState(SKILL_TABS[0].id);
  const [wordIdx, setWordIdx] = useState(0);
  const currentSkill = SKILL_TABS.find((s) => s.id === activeSkill)!;

  useEffect(() => {
    const id = setInterval(() => setWordIdx((i) => (i + 1) % ROTATING_SUBJECTS.length), 2600);
    return () => clearInterval(id);
  }, []);

  // Auto-cycle skills tab every 2 s
  useEffect(() => {
    const id = setInterval(() => {
      setActiveSkill((cur) => {
        const idx = SKILL_TABS.findIndex((t) => t.id === cur);
        return SKILL_TABS[(idx + 1) % SKILL_TABS.length].id;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFBFF] text-slate-900 antialiased selection:bg-indigo-600 selection:text-white dark:bg-slate-950 dark:text-white">

      {/* NAVBAR */}
      <header className="sticky top-4 z-50 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="flex h-16 items-center justify-between rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-sm px-4 shadow-sm sm:px-6 dark:bg-slate-900/95 dark:border-slate-800">
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Takshashila</span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {[
              { label: 'Find Tutors', href: '/tutors', icon: Search },
              { label: 'Features',   href: '#features' },
              { label: 'How it works', href: '#how-it-works' },
              { label: 'Reviews',    href: '#testimonials' },
            ].map(({ label, href, icon: Icon }) => (
              href.startsWith('#') ? (
                <a key={label} href={href} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors dark:text-slate-300">
                  {label}
                </a>
              ) : (
                <Link key={label} to={href} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors dark:text-slate-300">
                  {Icon && <Icon className="h-3.5 w-3.5" />} {label}
                </Link>
              )
            ))}
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <Link
                to={ROLE_DASHBOARD_PATHS[user.role]}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors"
              >
                Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors dark:text-slate-300 sm:block">
                  Sign in
                </Link>
                <Link
                  to="/register/student"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors"
                >
                  Get started free
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <InteractiveGridBackground
          gridSize={48}
          effectColor="rgba(99, 102, 241, 0.45)"
          darkEffectColor="rgba(165, 180, 252, 0.45)"
          gridColor="#dde1f0"
          darkGridColor="#1e2340"
          trailLength={5}
          glow
          glowRadius={18}
          fadeIntensity={18}
          idleRandomCount={3}
          className="pb-20 pt-12 lg:pt-20 lg:pb-28"
        >

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2">

            {/* LEFT */}
            <motion.div className="space-y-7" variants={stagger} initial="hidden" animate="visible">
              <motion.div variants={fadeUp}>
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700">
                  <span className="flex h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                  Trusted online tutoring marketplace
                </div>
              </motion.div>

              <motion.div variants={fadeUp}>
                <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[4.25rem] dark:text-white">
                  Find expert tutors for{' '}
                  <span className="relative inline-block overflow-hidden align-bottom" style={{ height: '1.15em' }}>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={wordIdx}
                        initial={{ y: 48, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -48, opacity: 0 }}
                        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute left-0 top-0 text-indigo-600"
                      >
                        {ROTATING_SUBJECTS[wordIdx]}
                      </motion.span>
                    </AnimatePresence>
                    <span className="invisible">Computer Science</span>
                  </span>
                </h1>
              </motion.div>

              <motion.p variants={fadeUp} className="max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300 md:text-xl">
                Search by grade, subject and schedule. Compare profiles, ratings and teaching style then book a live demo in one click.
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
                <Link
                  to="/tutors"
                  className="group inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-7 py-3.5 text-base font-semibold text-white shadow-sm hover:shadow-md transition-all"
                >
                  <Rocket className="h-5 w-5" />
                  Find tutors
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/register/student"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-7 py-3.5 text-base font-semibold text-slate-700 shadow-sm transition-all"
                >
                  <Play className="h-4 w-4 fill-current" /> Book a free demo
                </Link>
              </motion.div>

              <motion.div variants={fadeUp} className="flex items-center gap-4">
                <div className="flex -space-x-2.5">
                  {[
                    { i: 'PS', g: 'from-rose-400 to-pink-500' },
                    { i: 'RM', g: 'from-indigo-400 to-violet-500' },
                    { i: 'AV', g: 'from-teal-400 to-emerald-500' },
                    { i: 'KN', g: 'from-amber-400 to-orange-500' },
                    { i: 'DK', g: 'from-sky-400 to-blue-500' },
                  ].map(({ i, g }, idx) => (
                    <div
                      key={i}
                      className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${g} text-[10px] font-bold text-white ring-2 ring-white`}
                      style={{ zIndex: 5 - idx }}
                    >
                      {i}
                    </div>
                  ))}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 ring-2 ring-white">
                    +99
                  </div>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-white">50,000+ students</span> joined this month
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {[...Array(5)].map((_, k) => <Star key={k} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
                    <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300">4.9</span>
                    <span className="text-slate-400"> · 12K reviews</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* RIGHT — dashboard mock */}
            <motion.div
              className="relative flex items-center justify-center lg:justify-end"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative w-full max-w-sm">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:bg-slate-900">
                  <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                          <BookOpen className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Today's Classes</p>
                          <p className="text-[11px] text-white/80">3 sessions scheduled</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                        Live now
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 p-4">
                    {[
                      { subj: 'Advanced Mathematics', tutor: 'Dr. Mehta',  time: '10:00 AM', live: false, bg: 'bg-sky-50 border-sky-100' },
                      { subj: 'Physics Mechanics',    tutor: 'Ms. Sharma', time: '12:30 PM', live: true,  bg: 'bg-indigo-50 border-indigo-100' },
                      { subj: 'English Literature',   tutor: 'Mr. Rao',    time: '3:00 PM',  live: false, bg: 'bg-violet-50 border-violet-100' },
                    ].map((c) => (
                      <div key={c.subj} className={`flex items-center gap-3 rounded-xl border ${c.bg} px-3 py-2.5`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-800">{c.subj}</p>
                          <p className="truncate text-[10px] text-slate-500">{c.time} · {c.tutor}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.live ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {c.live ? 'Live' : 'Soon'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-slate-100 p-4">
                    {[
                      { label: 'Attendance', value: '94%',  bg: 'bg-emerald-50 text-emerald-700' },
                      { label: 'Balance',    value: '$4.8K', bg: 'bg-amber-50 text-amber-700' },
                      { label: 'Rating',     value: '4.9★', bg: 'bg-rose-50 text-rose-600' },
                    ].map((s) => (
                      <div key={s.label} className={`rounded-xl ${s.bg} px-2 py-2 text-center`}>
                        <p className="text-sm font-bold">{s.value}</p>
                        <p className="text-[10px] font-medium opacity-70">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating chips */}
                <motion.div
                  className="absolute -left-12 top-8 hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-lg lg:block"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
                      <Video className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Live math class</p>
                      <p className="text-[10px] text-slate-400">Grade 6 · 5 min left</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute -right-10 top-16 hidden rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg lg:block"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                      <Bell className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">New assignment</p>
                      <p className="text-[10px] text-slate-400">Physics · due today</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute -left-10 bottom-12 hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-lg lg:block"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                >
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500 fill-amber-400" />
                    <span className="text-xs font-semibold text-slate-800">Top rated</span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute -right-8 bottom-20 hidden rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg lg:block"
                  animate={{ y: [0, -7, 0] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-slate-800">248 students online</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
        </InteractiveGridBackground>
      </section>

      {/* MARQUEE */}
      <section className="relative overflow-hidden border-y border-indigo-100 bg-indigo-50 py-7">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-indigo-50 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-indigo-50 to-transparent" />
        <div className="flex animate-[marquee_40s_linear_infinite] gap-10 whitespace-nowrap">
          {[...SUBJECTS_MARQUEE, ...SUBJECTS_MARQUEE].map((s, i) => (
            <div key={i} className="flex shrink-0 items-center gap-3 text-lg font-semibold text-indigo-700 md:text-xl">
              <Sparkles className="h-4 w-4" />
              <span>{s}</span>
              <span className="text-indigo-300">·</span>
            </div>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="py-20 bg-gradient-to-b from-[#FAFBFF] to-white dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-10 text-center"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">By the numbers</p>
          </motion.div>
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

      {/* FEATURES */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-14 text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <SectionLabel>Platform features</SectionLabel>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">
              Everything you need to{' '}
              <span className="text-indigo-600">teach &amp; learn</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500 dark:text-slate-300">
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
            {/* Live Classes — large card */}
            <motion.div
              variants={fadeUp}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-7 text-white shadow-xl md:col-span-2 md:row-span-2"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-xl" />

              <div className="relative z-10">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Video className="h-6 w-6 text-white" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Feature highlight</p>
                <h3 className="mt-2 text-2xl font-bold md:text-3xl">Live HD Classes</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85 md:text-base">
                  Real-time teaching via Agora, Zoom & Meet. Record every session students can replay at any time.
                </p>

                <div className="mt-6 overflow-hidden rounded-xl border border-white/20 bg-white text-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-indigo-50 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                      <span className="text-xs font-semibold text-indigo-800">Physics Mechanics · Live</span>
                    </div>
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">REC</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {[
                      { init: 'MS', g: 'from-teal-400 to-emerald-500', host: true },
                      { init: 'AV', g: 'from-sky-400 to-blue-500',     host: false },
                      { init: 'KN', g: 'from-pink-400 to-rose-500',    host: false },
                      { init: 'RM', g: 'from-amber-400 to-orange-500', host: false },
                    ].map((p) => (
                      <div key={p.init} className="flex flex-col items-center gap-1">
                        <div className={`relative flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-br ${p.g} text-sm font-bold text-white`}>
                          {p.init}
                          {p.host && (
                            <span className="absolute -top-1 -right-1 rounded-full bg-indigo-600 px-1 text-[8px] font-bold text-white">HOST</span>
                          )}
                        </div>
                        <p className="truncate text-center text-[9px] text-slate-400 w-full">{p.init}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-3 border-t border-slate-100 px-4 py-2.5">
                    {[
                      { icon: Mic,      bg: 'bg-slate-100 text-slate-600' },
                      { icon: Monitor,  bg: 'bg-slate-100 text-slate-600' },
                      { icon: MicOff,   bg: 'bg-slate-100 text-slate-600' },
                      { icon: PhoneOff, bg: 'bg-rose-500 text-white' },
                    ].map(({ icon: Icon, bg }, i) => (
                      <button key={i} className={`flex h-8 w-8 items-center justify-center rounded-full ${bg} transition-transform hover:scale-110`}>
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {['HD video', 'Screen share', 'Auto-record', 'Replay anytime'].map((tag) => (
                    <span key={tag} className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Smart Scheduling */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50">
                <Calendar className="h-5 w-5 text-sky-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Smart Scheduling</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                Flexible slots, real-time calendar sync and automated reminders.
              </p>
              <div className="mt-4 space-y-1.5">
                {['Tue 10:00 AM · Math', 'Wed 2:30 PM · Physics', 'Fri 4:00 PM · English'].map((slot, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs">
                    <div className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    <span className="font-medium text-slate-700">{slot}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Analytics */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50">
                <BarChart3 className="h-5 w-5 text-violet-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Deep Analytics</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                Attendance, progress reports and platform-wide insights.
              </p>
              <div className="mt-4 flex items-end gap-1.5 h-12">
                {[40, 65, 55, 80, 72, 90, 85].map((h, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 rounded-t-md bg-violet-400"
                    style={{ height: `${h}%` }}
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.06, ease: 'backOut' }}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-semibold text-emerald-600">+18%</span>
                <span className="text-slate-400">attendance this month</span>
              </div>
            </motion.div>

            {/* Chat */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all md:col-span-2">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50">
                <MessageSquare className="h-5 w-5 text-teal-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Chat & Doubt-solving</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                Private messaging between students, tutors and principals all in one place.
              </p>
              <div className="mt-3 space-y-1.5 text-xs">
                {[
                  { msg: "Sir, I don't get Q3 🤔", me: false },
                  { msg: 'Let me explain step by step!', me: true },
                ].map((m, i) => (
                  <div key={i} className={`flex ${m.me ? 'justify-end' : ''}`}>
                    <span className={`max-w-[80%] rounded-2xl px-3 py-1.5 font-medium ${m.me ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {m.msg}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Payments */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
                <Wallet className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Secure Payments</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                Stripe & Razorpay. Wallet credits, auto-refunds and tutor payouts.
              </p>
              <div className="mt-2 flex items-baseline gap-1">
                <p className="text-2xl font-bold text-amber-600">$4.8K</p>
                <p className="text-xs text-slate-400">wallet balance</p>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full w-3/4 rounded-full bg-amber-400" />
              </div>
            </motion.div>

            {/* RBAC */}
            <motion.div
              variants={fadeUp}
              className="relative overflow-hidden rounded-2xl bg-slate-900 p-6 shadow-xl md:col-span-3"
            >
              <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-rose-500/10 blur-xl" />
              <div className="absolute left-1/3 bottom-0 h-24 w-24 rounded-full bg-indigo-500/10 blur-xl" />
              <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/20">
                    <Shield className="h-5 w-5 text-rose-400" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Role-based Access Control</h3>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-400">
                    7 secure permission tiers — every user sees only what they need. No data leaks, no overexposure.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { role: 'Super Admin', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
                    { role: 'Admin',       color: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
                    { role: 'Principal',   color: 'border-violet-500/40 bg-violet-500/10 text-violet-300' },
                    { role: 'Tutor',       color: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
                    { role: 'Student',     color: 'border-teal-500/40 bg-teal-500/10 text-teal-300' },
                    { role: 'Parent',      color: 'border-pink-500/40 bg-pink-500/10 text-pink-300' },
                    { role: 'Support',     color: 'border-slate-500/40 bg-slate-700 text-slate-300' },
                  ].map(({ role, color }) => (
                    <span key={role} className={`rounded-full border px-3 py-1 text-xs font-semibold ${color}`}>
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="overflow-hidden bg-slate-950 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 pt-16 pb-6 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-4 py-1.5 text-sm font-semibold text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />The journey
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
              How your child will <span className="text-indigo-400">progress</span>
            </h2>
            <p className="mt-3 text-slate-400 text-base">Drag or scroll through each step of the learning journey</p>
          </motion.div>
        </div>
        <ThreeDSlider
          items={JOURNEY_SLIDES}
          speedWheel={0.05}
          speedDrag={-0.15}
          containerStyle={{ height: '520px', background: '#020617' }}
        />
        <div className="grid grid-cols-2 gap-4 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-5 lg:px-8 mx-auto max-w-7xl">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${step.color}`}>
                <step.icon className="h-4 w-4 text-white" />
              </div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Step {step.step}</p>
              <p className="mt-1 text-sm font-semibold text-white">{step.title}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SKILLS TABS */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mx-auto mb-14 max-w-2xl text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <SectionLabel>Skills focus</SectionLabel>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">
              What your child will <span className="text-indigo-600">learn</span>
            </h2>
            <p className="mt-4 text-lg text-slate-500 dark:text-slate-300">
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
                    className={`w-full rounded-xl px-5 py-4 text-left transition-all ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50'
                    }`}
                  >
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <span className={`inline-block h-2 w-2 rounded-full ${active ? 'bg-white' : 'bg-indigo-500'}`} />
                      {tab.title}
                    </p>
                    <p className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-slate-400'}`}>{tab.subtitle}</p>
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
                className="grid items-center gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-card md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:p-8"
              >
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">Skills focus</p>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">{currentSkill.title}</h3>
                  <p className="text-sm text-slate-500 md:text-base">{currentSkill.subtitle}</p>
                  <ul className="space-y-2 pt-1">
                    {currentSkill.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500 fill-indigo-50" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 pt-2 text-xs text-slate-400">
                    <Users className="h-4 w-4 text-indigo-400" />
                    <span>Thousands of kids on Takshashila are building this skill right now.</span>
                  </div>
                </div>
                <div className="relative h-48 overflow-hidden rounded-2xl bg-indigo-50 border border-indigo-100 md:h-64">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <GraduationCap className="h-32 w-32 text-indigo-200" />
                  </div>
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1">
                    <GraduationCap className="h-4 w-4 text-indigo-500" />
                    <span className="text-[11px] font-semibold text-slate-700">Fun, kid-friendly activities</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* LEARNING FLOW */}
      <section className="relative py-24 overflow-hidden bg-slate-950">
        {/* Background glow blobs */}
        <div className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-violet-600/10 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mx-auto mb-16 max-w-2xl text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-500/15 border border-indigo-500/25 px-4 py-1.5 text-sm font-semibold text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />Learning loop
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
              How learning <span className="text-indigo-400">feels</span> on Takshashila
            </h2>
            <p className="mt-4 text-slate-400">Five tools that work together to make every student unstoppable.</p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
          >
            {[
              {
                icon: Video, num: '01',
                title: 'Live HD Classes',
                desc: 'Join real-time sessions with screen share, whiteboard and instant Q&A.',
                gradient: 'from-indigo-500/20 to-violet-500/20',
                border: 'border-indigo-500/30',
                iconGrad: 'from-indigo-500 to-violet-600',
                glow: 'group-hover:shadow-indigo-500/20',
                preview: (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
                      <span className="text-[10px] font-semibold text-white/60">Physics · LIVE</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {['MS','AV','KN','RM'].map((i, k) => (
                        <div key={k} className="h-6 rounded-lg bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/50">{i}</div>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                icon: BookOpen, num: '02',
                title: 'Assignments',
                desc: 'Tutor sets tasks, student submits, tutor grades — all in one flow.',
                gradient: 'from-sky-500/20 to-blue-500/20',
                border: 'border-sky-500/30',
                iconGrad: 'from-sky-500 to-blue-600',
                glow: 'group-hover:shadow-sky-500/20',
                preview: (
                  <div className="mt-4 space-y-1.5">
                    {['Chapter 3 — Due today', 'Problem set 7 — Graded ✓'].map((t, k) => (
                      <div key={k} className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${k === 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        <span className="text-[10px] text-white/50 truncate">{t}</span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                icon: Layout, num: '03',
                title: 'Worksheets',
                desc: 'Interactive quizzes from Excel uploads. Auto-graded with instant scores.',
                gradient: 'from-teal-500/20 to-emerald-500/20',
                border: 'border-teal-500/30',
                iconGrad: 'from-teal-500 to-emerald-600',
                glow: 'group-hover:shadow-teal-500/20',
                preview: (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] text-white/40 mb-2">Q. What is Newton's 1st law?</p>
                    {['Inertia','Momentum','Energy','Force'].map((a, k) => (
                      <div key={k} className={`mb-1 rounded-lg px-2 py-1 text-[9px] font-medium ${k === 0 ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/5 text-white/40'}`}>{a}</div>
                    ))}
                  </div>
                ),
              },
              {
                icon: MessageSquare, num: '04',
                title: 'Chat & Doubts',
                desc: 'Private messaging between student, tutor and parents. Ask anything.',
                gradient: 'from-violet-500/20 to-purple-500/20',
                border: 'border-violet-500/30',
                iconGrad: 'from-violet-500 to-purple-600',
                glow: 'group-hover:shadow-violet-500/20',
                preview: (
                  <div className="mt-4 space-y-1.5">
                    {[
                      { msg: "I don't get Q3 🤔", me: false },
                      { msg: 'Let me explain!', me: true },
                    ].map((m, k) => (
                      <div key={k} className={`flex ${m.me ? 'justify-end' : ''}`}>
                        <span className={`rounded-xl px-2.5 py-1 text-[10px] font-medium ${m.me ? 'bg-violet-600 text-white' : 'bg-white/10 text-white/60'}`}>
                          {m.msg}
                        </span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                icon: Play, num: '05',
                title: 'Recordings',
                desc: 'Every class auto-recorded. Students rewatch anytime for revision.',
                gradient: 'from-rose-500/20 to-pink-500/20',
                border: 'border-rose-500/30',
                iconGrad: 'from-rose-500 to-pink-600',
                glow: 'group-hover:shadow-rose-500/20',
                preview: (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      <span className="text-[10px] text-white/40">Algebra · 48 min</span>
                    </div>
                    <div className="flex items-center justify-center py-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer">
                        <Play className="h-4 w-4 fill-white text-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                ),
              },
            ].map((it, i) => {
              const Icon = it.icon;
              return (
                <motion.div
                  key={it.title}
                  variants={fadeUp}
                  custom={i}
                  className={`group relative overflow-hidden rounded-2xl border ${it.border} bg-gradient-to-br ${it.gradient} p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${it.glow}`}
                >
                  {/* number badge */}
                  <span className="absolute right-4 top-4 text-[11px] font-black text-white/15">{it.num}</span>

                  {/* icon */}
                  <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${it.iconGrad} shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>

                  <p className="text-sm font-bold text-white">{it.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/50">{it.desc}</p>

                  {it.preview}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="border-y border-slate-100 bg-white py-24 dark:bg-slate-950 dark:border-slate-800">
        <motion.div
          className="mx-auto mb-14 max-w-3xl px-4 text-center sm:px-6 lg:px-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-700">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            Rated 4.9 / 5 by our community
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">
            Loved by{' '}
            <span className="text-indigo-600">parents, students &amp; tutors</span>
          </h2>
          <p className="mt-4 text-lg text-slate-500 dark:text-slate-300">
            Real stories from families, students and tutors on Takshashila.
          </p>
        </motion.div>

        <InfiniteCarouselWall />
      </section>

      {/* PARENTS SECTION */}
      <section className="relative overflow-hidden py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 shadow-xl md:p-14"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.65 }}
          >
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl" />
            <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-violet-600/15 blur-3xl" />

            <div className="relative z-10 grid gap-12 lg:grid-cols-[1fr_420px] lg:items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-pink-500/20 border border-pink-500/30 px-4 py-1.5 text-sm font-semibold text-pink-300">
                  <Heart className="h-3.5 w-3.5 fill-current" />
                  Built for families
                </div>
                <h2 className="text-3xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
                  <span className="text-amber-400">Parents,</span>{' '}
                  we know exactly what you need
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { icon: Calendar,   label: 'Monthly parent-tutor meetings', desc: 'Stay in the loop every month', bg: 'bg-teal-500/20',   text: 'text-teal-300' },
                    { icon: Sparkles,   label: 'Positive learning environment', desc: 'Safe, encouraging and fun',    bg: 'bg-sky-500/20',    text: 'text-sky-300' },
                    { icon: Wallet,     label: 'Flexible payment options',      desc: 'Pay as you go or subscribe',  bg: 'bg-amber-500/20',  text: 'text-amber-300' },
                    { icon: BarChart3,  label: 'Weekly performance reports',    desc: 'Know exactly how they improve', bg: 'bg-violet-500/20', text: 'text-violet-300' },
                  ].map(({ icon: Icon, label, desc, bg, text }) => (
                    <div key={label} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                        <Icon className={`h-4 w-4 ${text}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="text-xs text-white/60">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/tutors"
                    className="group inline-flex items-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 px-7 py-3.5 text-base font-semibold text-white shadow-sm transition-all"
                  >
                    <Heart className="h-5 w-5 fill-white/80" />
                    Browse tutors
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    to="/register/parent"
                    className="group inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 px-7 py-3.5 text-base font-semibold text-white transition-all"
                  >
                    Join as Parent
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex items-center gap-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-500/20">
                    <ShieldCheck className="h-7 w-7 text-teal-300" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">NIOS-valid curriculum</p>
                    <p className="text-sm text-white/60">Equal to CBSE · Government recognized</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400">Fully accredited</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20">
                    <TrendingUp className="h-5 w-5 text-sky-300" />
                  </div>
                  <p className="text-2xl font-bold text-white">87%</p>
                  <p className="mt-0.5 text-xs text-white/60">improve in 30 days</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                    <Zap className="h-5 w-5 text-amber-300" />
                  </div>
                  <p className="text-2xl font-bold text-white">1-click</p>
                  <p className="mt-0.5 text-xs text-white/60">book a free demo</p>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20">
                      <Headphones className="h-5 w-5 text-pink-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">24 / 7 Parent Support</p>
                      <p className="text-xs text-white/60">Chat, call or email always reachable</p>
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

      {/* CTA BANNER */}
      <CtaBanner />

      {/* FOOTER */}
      <footer className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
          <div className="grid gap-10 md:grid-cols-[200px_1fr_1fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-slate-900">Takshashila</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                India's modern tutoring marketplace connecting students with expert tutors.
              </p>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-100 px-3 py-1">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                <span className="text-xs font-semibold text-amber-700">4.9 · 12K reviews</span>
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Platform</p>
              <ul className="space-y-2.5 text-sm">
                {[
                  { label: 'Find Tutors', to: '/tutors' },
                  { label: 'Sign in',     to: '/login' },
                  { label: 'Register',    to: '/register' },
                  { label: 'Features',    href: '#features' },
                ].map(({ label, to, href }) => (
                  <li key={label}>
                    {to ? (
                      <Link to={to} className="text-slate-500 hover:text-indigo-600 transition-colors">{label}</Link>
                    ) : (
                      <a href={href} className="text-slate-500 hover:text-indigo-600 transition-colors">{label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Who it's for</p>
              <ul className="space-y-2.5 text-sm">
                {['Students', 'Tutors', 'School Principals', 'Parents'].map((r) => (
                  <li key={r} className="text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer">{r}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Legal</p>
              <ul className="space-y-2.5 text-sm">
                {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Contact Us'].map((l) => (
                  <li key={l} className="text-slate-500 hover:text-indigo-600 cursor-pointer transition-colors">{l}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-sm md:flex-row">
            <p className="text-slate-400">© 2026 Takshashila. All rights reserved.</p>
            <p className="text-slate-400">Made with <Heart className="inline h-3.5 w-3.5 fill-rose-500 text-rose-500" /> for learners everywhere.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
