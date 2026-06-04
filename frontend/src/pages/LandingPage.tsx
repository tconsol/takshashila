import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ArrowRight, GraduationCap, Star, Heart, Play,
  Video, BarChart3, MessageSquare, Wallet, Users,
  ShieldCheck, Calendar, Trophy, ArrowUpRight, Quote, ChevronDown,
  UserCheck, FileText, ClipboardList, FolderOpen, Film,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { ROLE_DASHBOARD_PATHS } from '../constants/roles';
import { InfiniteCarouselWall } from '../components/lightswind/InfiniteCarouselWall';
import {
  Underline, CurvedArrow, Sparkle, Star4, Pencil, Book, Bulb, Cap,
  Squiggle, DottedPath, Confetti, CircleScribble, CheckScribble,
} from '../components/landing/Doodles';

const HAND = { fontFamily: "'Caveat', cursive" } as const;

const ROTATING = ['Mathematics', 'Physics', 'Coding', 'English', 'Chemistry', 'Biology'];

const SUBJECTS = [
  'Mathematics', 'Science', 'English', 'Coding', 'Physics', 'Chemistry',
  'Biology', 'History', 'Geography', 'Public Speaking', 'Computer Science', 'Economics',
];

// ── Reusable: handwritten annotation ──────────────────────────────────────────
function Hand({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span style={HAND} className={className}>{children}</span>;
}

// ── Reusable: sticker card (slightly rotated, soft border) ────────────────────
function Sticker({
  children, className = '', rotate = '',
}: { children: React.ReactNode; className?: string; rotate?: string }) {
  return (
    <div className={`rounded-[1.75rem] border-2 border-slate-900/5 bg-white shadow-[0_8px_30px_-12px_rgba(30,27,75,0.18)] ${rotate} ${className}`}>
      {children}
    </div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const } }),
};

const FAQS = [
  { q: 'Is the first class really free?', a: 'Yes! Every new student gets free demo credits to try classes with different tutors before committing. No card required.' },
  { q: 'How do payments work?', a: 'You only pay for classes you actually attend. Credits are deducted from your wallet after each completed class — fully transparent, no hidden fees.' },
  { q: 'Are the tutors verified?', a: 'Every tutor is background-checked, qualification-verified and continuously rated by real students before they can teach on the platform.' },
  { q: 'Can parents track progress?', a: 'Absolutely. Parents link to their child and get weekly performance reports, attendance and class history right in their dashboard.' },
  { q: 'What subjects can I learn?', a: 'Over 100 subjects — from Mathematics, Physics and Coding to Public Speaking, Art and Music, across all grade levels.' },
];

function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`overflow-hidden rounded-2xl border-2 transition-colors ${open ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-900/5 bg-white'}`}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="text-base font-bold text-slate-900">{q}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-indigo-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <p className="px-5 pb-4 text-sm leading-relaxed text-slate-600">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LandingPage() {
  const { isAuthenticated, user } = useAuthStore();
  const [wordIdx, setWordIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setWordIdx((i) => (i + 1) % ROTATING.length), 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="min-h-screen text-slate-900 antialiased selection:bg-indigo-600 selection:text-white"
      style={{
        backgroundColor: '#FBF8F1',
        backgroundImage:
          'radial-gradient(rgba(79,70,229,0.06) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    >
      {/* ════════ NAVBAR ════════ */}
      <header className="sticky top-4 z-50 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="flex h-16 items-center justify-between rounded-2xl border-2 border-slate-900/5 bg-white/90 px-4 shadow-sm backdrop-blur-md sm:px-6">
          <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight">Takshashila</span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {[
              { label: 'Find Tutors', href: '/tutors', icon: Search },
              { label: 'Features', href: '#features' },
              { label: 'How it works', href: '#how-it-works' },
              { label: 'Reviews', href: '#testimonials' },
            ].map(({ label, href, icon: Icon }) =>
              href.startsWith('#') ? (
                <a key={label} href={href} className="text-sm font-semibold text-slate-600 transition-colors hover:text-indigo-600">{label}</a>
              ) : (
                <Link key={label} to={href} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-indigo-600">
                  {Icon && <Icon className="h-3.5 w-3.5" />} {label}
                </Link>
              ),
            )}
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <Link to={ROLE_DASHBOARD_PATHS[user.role]} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700">
                Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden text-sm font-semibold text-slate-600 transition-colors hover:text-indigo-600 sm:block">Sign in</Link>
                <Link to="/register/student" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700">
                  Get started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ════════ HERO ════════ */}
      <section className="relative overflow-hidden pb-16 pt-12 lg:pb-24 lg:pt-16">
        {/* scattered doodles */}
        <Star4 className="pointer-events-none absolute left-[6%] top-24 h-7 w-7 text-amber-400" />
        <Sparkle className="pointer-events-none absolute right-[8%] top-16 h-9 w-9 text-indigo-300" />
        <Squiggle className="pointer-events-none absolute left-[3%] bottom-24 hidden h-5 w-24 text-rose-300 lg:block" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            {/* LEFT */}
            <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
              <motion.div variants={fadeUp} className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-bold text-amber-700">
                <Bulb className="h-4 w-4" />
                India's friendliest tutoring marketplace
              </motion.div>

              <motion.h1 variants={fadeUp} className="text-[2.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.5rem]">
                Learning that
                <br />
                <span className="relative inline-block">
                  <span className="relative z-10">actually</span>
                  <Underline className="absolute -bottom-2 left-0 h-4 w-full text-amber-400" />
                </span>{' '}
                <span className="text-indigo-600">sticks</span>
                <Hand className="ml-3 inline-block -rotate-6 text-3xl text-rose-400 sm:text-4xl">& feels fun!</Hand>
              </motion.h1>

              <motion.p variants={fadeUp} className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
                Find expert tutors for{' '}
                <span className="inline-block min-w-[5.2em] font-bold text-indigo-600">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={wordIdx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.28 }}
                      className="inline-block"
                    >
                      {ROTATING[wordIdx]}
                    </motion.span>
                  </AnimatePresence>
                </span>
                — book a free demo, compare ratings and learn live. No pressure.
              </motion.p>

              <motion.div variants={fadeUp} className="relative mt-8 flex flex-wrap items-center gap-3">
                <Link to="/tutors" className="group inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-7 py-4 text-base font-bold text-white shadow-[0_10px_30px_-8px_rgba(79,70,229,0.5)] transition-all hover:-translate-y-0.5 hover:bg-indigo-700">
                  Find your tutor
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link to="/register/student" className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-900/10 bg-white px-7 py-4 text-base font-bold text-slate-800 transition-all hover:-translate-y-0.5 hover:border-indigo-200">
                  <Play className="h-4 w-4 fill-indigo-600 text-indigo-600" /> Watch demo
                </Link>
                <CurvedArrow className="absolute -bottom-12 right-2 hidden h-16 w-20 text-indigo-300 lg:block" />
              </motion.div>

              <motion.div variants={fadeUp} className="mt-10 flex items-center gap-5">
                <div className="flex -space-x-3">
                  {['from-rose-400 to-pink-500', 'from-indigo-400 to-violet-500', 'from-amber-400 to-orange-500', 'from-teal-400 to-emerald-500'].map((g, i) => (
                    <div key={i} className={`h-11 w-11 rounded-full border-[3px] border-white bg-gradient-to-br ${g}`} />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, k) => <Star key={k} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-sm font-semibold text-slate-500"><span className="text-slate-900">50,000+</span> happy learners</p>
                </div>
              </motion.div>
            </motion.div>

            {/* RIGHT — photo collage with doodles */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* blob shape behind */}
              <div className="absolute inset-6 -rotate-3 rounded-[3rem] bg-gradient-to-br from-indigo-500 to-violet-600" />

              {/* main image sticker */}
              <Sticker rotate="rotate-2" className="relative z-10 overflow-hidden p-2.5">
                <img
                  src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=720&q=80"
                  alt="Student learning online"
                  className="aspect-[4/5] w-full rounded-[1.4rem] object-cover"
                  loading="eager"
                />
              </Sticker>

              {/* doodle accents */}
              <Confetti className="absolute -left-3 top-2 z-20 h-10 w-16 text-amber-400" />
              <Pencil className="absolute -right-2 bottom-28 z-20 h-10 w-10 -rotate-12 text-rose-400" />

              {/* floating sticker — live class */}
              <motion.div
                className="absolute -left-5 top-28 z-30 hidden lg:block"
                animate={{ y: [0, -9, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Sticker rotate="-rotate-3" className="flex items-center gap-2.5 px-3.5 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50">
                    <Video className="h-4 w-4 text-rose-500" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Live class now</p>
                    <p className="text-[10px] text-slate-400">Physics · Grade 8</p>
                  </div>
                </Sticker>
              </motion.div>

              {/* floating sticker — tutors count */}
              <motion.div
                className="absolute -right-4 top-44 z-30 hidden lg:block"
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              >
                <Sticker rotate="rotate-3" className="px-4 py-3 text-center">
                  <p className="text-xl font-extrabold leading-none text-indigo-600">5K+</p>
                  <p className="text-[10px] font-semibold text-slate-500">Expert tutors</p>
                </Sticker>
              </motion.div>

              {/* floating sticker — rating */}
              <motion.div
                className="absolute -left-3 bottom-8 z-30 hidden lg:block"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              >
                <Sticker rotate="-rotate-2" className="flex items-center gap-2 px-3.5 py-2.5">
                  <Trophy className="h-4 w-4 fill-amber-400 text-amber-500" />
                  <span className="text-xs font-bold text-slate-900">4.9 rating</span>
                </Sticker>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════ SUBJECT MARQUEE ════════ */}
      <section className="relative overflow-hidden border-y-2 border-slate-900/5 bg-indigo-600 py-5">
        <div className="flex animate-[marquee_38s_linear_infinite] gap-8 whitespace-nowrap">
          {[...SUBJECTS, ...SUBJECTS].map((s, i) => (
            <div key={i} className="flex shrink-0 items-center gap-3 text-lg font-bold text-white/90">
              <Star4 className="h-4 w-4 text-amber-300" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ════════ STATS ════════ */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { v: '50K+', l: 'Active learners', rot: '-rotate-2', bg: 'bg-indigo-50', tx: 'text-indigo-600', Icon: Users },
              { v: '5K+', l: 'Expert tutors', rot: 'rotate-1', bg: 'bg-amber-50', tx: 'text-amber-600', Icon: GraduationCap },
              { v: '100+', l: 'Subjects', rot: '-rotate-1', bg: 'bg-teal-50', tx: 'text-teal-600', Icon: Book },
              { v: '4.9', l: 'Avg rating', rot: 'rotate-2', bg: 'bg-rose-50', tx: 'text-rose-500', Icon: Star },
            ].map(({ v, l, rot, bg, tx, Icon }, i) => (
              <motion.div key={l} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
                <Sticker rotate={rot} className="p-5">
                  <span className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${bg}`}>
                    <Icon className={`h-5 w-5 ${tx}`} />
                  </span>
                  <p className="text-3xl font-extrabold md:text-4xl">{v}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-500">{l}</p>
                </Sticker>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ 3 FREE DEMO CLASSES ════════ */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-400 to-orange-500 px-8 py-10 md:px-14 md:py-12">
              <Sparkle className="absolute right-10 top-8 h-10 w-10 text-white/30" />
              <Confetti className="absolute bottom-6 left-1/3 h-10 w-16 text-white/25" />
              <div className="relative z-10 flex flex-col items-center gap-8 text-center md:flex-row md:text-left">
                {/* Big 3 */}
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[2rem] bg-white shadow-xl md:h-32 md:w-32">
                  <span className="text-6xl font-extrabold text-orange-500 md:text-7xl">3</span>
                </div>
                <div className="flex-1">
                  <Hand className="text-2xl text-white/90">on the house</Hand>
                  <h2 className="mt-1 text-3xl font-extrabold leading-tight text-white md:text-5xl">
                    3 Free Demo Classes
                  </h2>
                  <p className="mt-2 max-w-xl text-base text-white/90 md:text-lg">
                    Every new student gets <strong className="font-bold">3 free demo classes</strong> to try different tutors before paying a single rupee. No card. No commitment.
                  </p>
                </div>
                <Link to="/register/student" className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-bold text-orange-600 shadow-lg transition-all hover:-translate-y-0.5">
                  Claim your demos <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════ PLATFORM FEATURES ════════ */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div className="mb-14 text-center" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <Hand className="text-2xl text-indigo-500">a complete learning toolkit</Hand>
            <h2 className="mt-1 text-4xl font-extrabold tracking-tight md:text-6xl">
              Everything in{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-indigo-600">one platform</span>
                <Underline className="absolute -bottom-2 left-0 h-4 w-full text-amber-400" />
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              No more juggling 5 different apps. Classes, homework, chat, recordings and payments — all in one friendly place.
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { Icon: Video, doodle: <Bulb className="absolute -right-1 -top-1 h-8 w-8 text-amber-300" />, title: 'Live HD Classes', desc: 'Real-time lessons with screen share, whiteboard and a native classroom.', bg: 'bg-indigo-50', tx: 'text-indigo-600', rot: '-rotate-1' },
              { Icon: UserCheck, doodle: <CheckScribble className="absolute -right-1 -top-1 h-7 w-7 text-teal-300" />, title: 'Attendance Tracking', desc: 'Auto-marked when students join. Live attendance rate for every learner.', bg: 'bg-teal-50', tx: 'text-teal-600', rot: 'rotate-1' },
              { Icon: MessageSquare, doodle: <Squiggle className="absolute -right-2 -top-1 h-4 w-12 text-rose-300" />, title: 'Chat & Doubt-solving', desc: 'Private messaging between students, tutors, parents and principals.', bg: 'bg-rose-50', tx: 'text-rose-500', rot: '-rotate-1' },
              { Icon: FileText, doodle: <Star4 className="absolute -right-1 -top-1 h-6 w-6 text-amber-300" />, title: 'Worksheets', desc: 'Interactive quizzes auto-graded with instant scores, plus file uploads.', bg: 'bg-amber-50', tx: 'text-amber-600', rot: 'rotate-1' },
              { Icon: ClipboardList, doodle: <Sparkle className="absolute -right-1 -top-1 h-6 w-6 text-violet-300" />, title: 'Assignments', desc: 'Set tasks, collect submissions and grade with feedback — Excel or PDF.', bg: 'bg-violet-50', tx: 'text-violet-600', rot: '-rotate-1' },
              { Icon: FolderOpen, doodle: <Confetti className="absolute -right-1 -top-2 h-8 w-12 text-sky-300" />, title: 'Resources Library', desc: 'Tutors share notes, PDFs and study material students can download.', bg: 'bg-sky-50', tx: 'text-sky-600', rot: 'rotate-1' },
              { Icon: Film, doodle: <Star4 className="absolute -right-1 -top-1 h-6 w-6 text-indigo-300" />, title: 'Class Recordings', desc: 'Every session auto-recorded — rewatch anytime for revision.', bg: 'bg-indigo-50', tx: 'text-indigo-600', rot: '-rotate-1' },
              { Icon: BarChart3, doodle: <Squiggle className="absolute -right-2 -top-1 h-4 w-12 text-teal-300" />, title: 'Progress Analytics', desc: 'Weekly reports, attendance and performance — parents stay in the loop.', bg: 'bg-teal-50', tx: 'text-teal-600', rot: 'rotate-1' },
              { Icon: Wallet, doodle: <Bulb className="absolute -right-1 -top-1 h-7 w-7 text-amber-300" />, title: 'Wallet & Payments', desc: 'Pay only for classes you attend. Transparent wallet, instant tutor payouts.', bg: 'bg-amber-50', tx: 'text-amber-600', rot: '-rotate-1' },
            ].map(({ Icon, doodle, title, desc, bg, tx, rot }, i) => (
              <motion.div key={title} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
                <Sticker rotate={rot} className="group relative h-full p-6 transition-transform hover:-translate-y-1.5">
                  {doodle}
                  <span className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${bg}`}>
                    <Icon className={`h-6 w-6 ${tx}`} />
                  </span>
                  <h3 className="text-lg font-extrabold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{desc}</p>
                </Sticker>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ HOW IT WORKS ════════ */}
      <section id="how-it-works" className="relative overflow-hidden py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div className="mb-16 text-center" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <Hand className="text-2xl text-rose-400">it's super simple</Hand>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">
              Start in <span className="text-indigo-600">3 steps</span>
            </h2>
          </motion.div>

          <div className="relative grid gap-8 md:grid-cols-3">
            {[
              { n: '1', Icon: Search, title: 'Find your tutor', desc: 'Browse verified tutors by subject, language and schedule.', bg: 'bg-indigo-50', tx: 'text-indigo-600' },
              { n: '2', Icon: Video, title: 'Book a free demo', desc: 'Try a live class before you commit — zero risk, zero cost.', bg: 'bg-amber-50', tx: 'text-amber-600' },
              { n: '3', Icon: Trophy, title: 'Learn & shine', desc: 'Attend live classes, finish worksheets, ace your exams.', bg: 'bg-teal-50', tx: 'text-teal-600' },
            ].map(({ n, Icon, title, desc, bg, tx }, i) => (
              <motion.div key={n} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="relative text-center">
                <Sticker rotate={i % 2 === 0 ? '-rotate-1' : 'rotate-1'} className="relative p-7">
                  <span style={HAND} className="absolute right-5 top-3 text-5xl font-bold text-slate-100">{n}</span>
                  <span className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${bg}`}>
                    <Icon className={`h-6 w-6 ${tx}`} />
                  </span>
                  <h3 className="text-xl font-extrabold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{desc}</p>
                </Sticker>
                {i < 2 && <DottedPath className="absolute -right-8 top-16 z-10 hidden h-8 w-16 text-indigo-300 md:block" />}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ WHY CHOOSE US ════════ */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <motion.div className="relative" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
              <div className="absolute -left-4 -top-4 h-24 w-24 rotate-6 rounded-3xl bg-amber-100" />
              <div className="absolute -bottom-5 -right-3 h-28 w-28 -rotate-6 rounded-3xl bg-indigo-100" />
              <Sticker rotate="-rotate-2" className="relative z-10 overflow-hidden p-2.5">
                <img
                  src="https://images.unsplash.com/photo-1577896851231-70ef18881754?w=720&q=80"
                  alt="Tutor teaching a class"
                  className="aspect-[4/3] w-full rounded-[1.4rem] object-cover"
                  loading="lazy"
                />
              </Sticker>
              <Pencil className="absolute -right-3 top-6 z-20 h-12 w-12 rotate-12 text-rose-400" />
              <motion.div className="absolute -left-4 bottom-10 z-20" animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                <Sticker rotate="rotate-3" className="px-4 py-3 text-center">
                  <p className="text-xl font-extrabold leading-none text-amber-500">87%</p>
                  <p className="text-[10px] font-semibold text-slate-500">improve in 30 days</p>
                </Sticker>
              </motion.div>
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
              <Hand className="text-2xl text-indigo-500">why families love us</Hand>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">
                A better way to{' '}
                <span className="relative inline-block">
                  <span className="relative z-10">learn & teach</span>
                  <Underline className="absolute -bottom-1.5 left-0 h-3 w-full text-amber-400" />
                </span>
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Students, parents and tutors save time and money — so everyone can focus on what matters: real learning outcomes.
              </p>
              <div className="mt-7 space-y-4">
                {[
                  { Icon: ShieldCheck, t: 'Verified & rated tutors', d: 'Background-checked, reviewed by real students.', c: 'bg-indigo-50 text-indigo-600' },
                  { Icon: Calendar, t: 'Flexible scheduling', d: 'Book around your routine, reschedule anytime.', c: 'bg-amber-50 text-amber-600' },
                  { Icon: BarChart3, t: 'Real progress tracking', d: 'Weekly reports, attendance, performance.', c: 'bg-teal-50 text-teal-600' },
                ].map(({ Icon, t, d, c }) => (
                  <div key={t} className="flex items-start gap-4">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-bold">{t}</p>
                      <p className="mt-0.5 text-sm text-slate-500">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/tutors" className="group mt-8 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-7 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-indigo-700">
                Get started free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════ MADE FOR EVERYONE — role cards ════════ */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div className="mb-14 max-w-2xl" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <Hand className="text-2xl text-rose-400">one platform, four worlds</Hand>
            <h2 className="mt-1 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Made for{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-indigo-600">everyone</span>
                <Underline className="absolute -bottom-2 left-0 h-4 w-full text-amber-400" />
              </span>
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Whether you're learning, teaching, parenting or running a school — Takshashila fits the way you work.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              { role: 'Students', tag: 'Learn', desc: 'Live HD classes, worksheets, games and instant doubt-solving.', img: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=500&q=80', bg: 'from-indigo-500 to-violet-600', rot: '-rotate-1', to: '/register/student' },
              { role: 'Tutors', tag: 'Teach', desc: 'Set your rate, build a schedule and get paid on time, every class.', img: 'https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=500&q=80', bg: 'from-amber-500 to-orange-600', rot: 'rotate-1', to: '/register/tutor' },
              { role: 'Parents', tag: 'Monitor', desc: 'Weekly reports, attendance and progress — full peace of mind.', img: 'https://images.unsplash.com/photo-1591474200742-8e512e6f98f8?w=500&q=80', bg: 'from-teal-500 to-emerald-600', rot: '-rotate-1', to: '/register/parent' },
              { role: 'Principals', tag: 'Manage', desc: 'Onboard tutors, track classes and grow your institution.', img: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=500&q=80', bg: 'from-rose-500 to-pink-600', rot: 'rotate-1', to: '/register/principal' },
            ].map(({ role, tag, desc, img, bg, rot, to }, i) => (
              <motion.div key={role} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
                <Link to={to}>
                  <Sticker rotate={rot} className="group h-full overflow-hidden transition-transform hover:-translate-y-1.5">
                    <div className="relative h-40 overflow-hidden">
                      <img src={img} alt={role} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                      <div className={`absolute inset-0 bg-gradient-to-t ${bg} opacity-60 mix-blend-multiply`} />
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-900">{tag}</span>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-extrabold">{role}</h3>
                        <ArrowUpRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-indigo-500" />
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{desc}</p>
                    </div>
                  </Sticker>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ SUBJECTS GRID ════════ */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div className="mb-12 text-center" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <Hand className="text-2xl text-teal-500">pick your favourite</Hand>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">
              100+ subjects to <span className="text-indigo-600">explore</span>
            </h2>
          </motion.div>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { s: 'Mathematics', c: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
              { s: 'Physics', c: 'bg-amber-50 text-amber-700 border-amber-200' },
              { s: 'Coding', c: 'bg-teal-50 text-teal-700 border-teal-200' },
              { s: 'English', c: 'bg-rose-50 text-rose-700 border-rose-200' },
              { s: 'Chemistry', c: 'bg-violet-50 text-violet-700 border-violet-200' },
              { s: 'Biology', c: 'bg-sky-50 text-sky-700 border-sky-200' },
              { s: 'History', c: 'bg-amber-50 text-amber-700 border-amber-200' },
              { s: 'Economics', c: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
              { s: 'Public Speaking', c: 'bg-teal-50 text-teal-700 border-teal-200' },
              { s: 'Geography', c: 'bg-rose-50 text-rose-700 border-rose-200' },
              { s: 'Computer Science', c: 'bg-violet-50 text-violet-700 border-violet-200' },
              { s: 'Art & Music', c: 'bg-sky-50 text-sky-700 border-sky-200' },
            ].map(({ s, c }, i) => (
              <motion.span
                key={s}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className={`rounded-full border-2 px-5 py-2.5 text-sm font-bold ${c} ${i % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}
              >
                {s}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ TESTIMONIALS ════════ */}
      <section id="testimonials" className="border-y-2 border-slate-900/5 bg-white py-20">
        <div className="mx-auto mb-12 max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-bold text-amber-700">
            <Quote className="h-3.5 w-3.5" /> Loved by 50,000+ learners
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
            What our{' '}
            <span className="relative inline-block">
              <span className="relative z-10 text-indigo-600">community</span>
              <Underline className="absolute -bottom-2 left-0 h-3.5 w-full text-amber-400" />
            </span>{' '}
            says
          </h2>
        </div>
        <InfiniteCarouselWall />
      </section>

      {/* ════════ BIG STATS BAND ════════ */}
      <section className="relative overflow-hidden bg-indigo-950 py-20">
        <CircleScribble className="pointer-events-none absolute -left-10 top-10 h-48 w-72 text-white/5" />
        <Sparkle className="pointer-events-none absolute right-[12%] top-12 h-10 w-10 text-amber-400/40" />
        <Star4 className="pointer-events-none absolute left-[15%] bottom-10 h-8 w-8 text-white/10" />
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <Hand className="text-2xl text-amber-300">the proof is in the numbers</Hand>
          <h2 className="mx-auto mt-1 max-w-3xl text-3xl font-extrabold leading-tight text-white md:text-5xl">
            Real outcomes, thousands of times over
          </h2>
          <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { v: '50K+', l: 'Students learning live' },
              { v: '1.2M', l: 'Classes completed' },
              { v: '94%', l: 'Attendance rate' },
              { v: '4.9★', l: 'Average tutor rating' },
            ].map(({ v, l }) => (
              <motion.div key={l} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
                <p className="text-4xl font-extrabold text-white md:text-6xl">{v}</p>
                <p className="mt-2 text-sm font-semibold text-indigo-300">{l}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FAQ ════════ */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div className="mb-12 text-center" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <Hand className="text-2xl text-teal-500">got questions?</Hand>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">
              Frequently <span className="text-indigo-600">asked</span>
            </h2>
          </motion.div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <FaqItem key={i} q={f.q} a={f.a} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════ CTA ════════ */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-indigo-600 px-8 py-14 text-center md:px-16 md:py-20">
            <Sparkle className="absolute left-8 top-8 h-10 w-10 text-white/20" />
            <Star4 className="absolute right-12 top-12 h-8 w-8 text-amber-300" />
            <Confetti className="absolute bottom-8 left-1/4 h-10 w-16 text-white/15" />
            <Cap className="absolute bottom-10 right-10 h-14 w-14 text-white/15" />

            <Hand className="text-3xl text-amber-300">ready to begin?</Hand>
            <h2 className="mt-2 text-3xl font-extrabold leading-tight text-white md:text-5xl">
              Start learning today —<br />it's free to try.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-indigo-100">
              Join thousands of students learning live with India's best tutors. Book a free demo in one click.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/register/student" className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-bold text-indigo-700 shadow-lg transition-all hover:-translate-y-0.5">
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/tutors" className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/30 bg-white/10 px-7 py-4 text-base font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20">
                Browse tutors
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ FOOTER ════════ */}
      <footer className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <Sticker className="p-8">
          <div className="grid gap-10 md:grid-cols-[220px_1fr_1fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-extrabold">Takshashila</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-500">
                India's friendliest tutoring marketplace — connecting students with expert tutors, live.
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-amber-200 bg-amber-50 px-3 py-1">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                <span className="text-xs font-bold text-amber-700">4.9 · 12K reviews</span>
              </span>
            </div>

            {([
              { h: 'Platform', items: [{ label: 'Find Tutors', to: '/tutors' }, { label: 'Sign in', to: '/login' }, { label: 'Register', to: '/register' }, { label: 'Features', href: '#features' }] },
              { h: "Who it's for", items: [{ label: 'Students' }, { label: 'Tutors' }, { label: 'Principals' }, { label: 'Parents' }] },
              { h: 'Legal', items: [{ label: 'Privacy Policy' }, { label: 'Terms of Service' }, { label: 'Cookie Policy' }, { label: 'Contact Us' }] },
            ] as { h: string; items: { label: string; to?: string; href?: string }[] }[]).map((col) => (
              <div key={col.h}>
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">{col.h}</p>
                <ul className="space-y-2.5 text-sm">
                  {col.items.map((it) => (
                    <li key={it.label}>
                      {it.to ? (
                        <Link to={it.to} className="font-semibold text-slate-500 transition-colors hover:text-indigo-600">{it.label}</Link>
                      ) : it.href ? (
                        <a href={it.href} className="font-semibold text-slate-500 transition-colors hover:text-indigo-600">{it.label}</a>
                      ) : (
                        <span className="cursor-pointer font-semibold text-slate-500 transition-colors hover:text-indigo-600">{it.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t-2 border-slate-900/5 pt-6 text-sm md:flex-row">
            <p className="font-semibold text-slate-400">© 2026 Takshashila. All rights reserved.</p>
            <p className="font-semibold text-slate-400">Made with <Heart className="inline h-3.5 w-3.5 fill-rose-500 text-rose-500" /> for curious minds.</p>
          </div>
        </Sticker>
      </footer>
    </div>
  );
}
