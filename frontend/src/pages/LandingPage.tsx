import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Search, ArrowRight, GraduationCap, Star, Heart, Play,
  Video, BarChart3, MessageSquare, Wallet, Users,
  ShieldCheck, Calendar, Trophy, ArrowUpRight, Quote, ChevronDown,
  UserCheck, FileText, ClipboardList, FolderOpen, Film, Monitor, PenLine,
  Sigma, Atom, Code, Languages, FlaskConical, Microscope, Mic, Cpu,
  Gamepad2, ArrowUp,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { ROLE_DASHBOARD_PATHS } from '../constants/roles';
import { InfiniteCarouselWall } from '../components/lightswind/InfiniteCarouselWall';
import {
  Underline, CurvedArrow, Sparkle, Star4, Pencil, Book, Bulb, Cap,
  Squiggle, DottedPath, Confetti, CircleScribble, CheckScribble,
} from '../components/landing/Doodles';
import { Terminal, type TermLine } from '../components/landing/Terminal';
import { ConnectionHub } from '../components/landing/ConnectionHub';
import CardSwap, { Card } from '../components/landing/CardSwap';
import { ChatBot } from '../components/landing/FloatingWidgets';

const CODE_LINES: TermLine[] = [
  { type: 'cmd', text: 'brainbaseedustart --subject coding' },
  { type: 'muted', text: 'Finding the perfect tutor for you…' },
  { type: 'ok', text: '✔ Matched with Priya · Python & Web Dev · ★ 4.9' },
  { type: 'gap' },
  { type: 'cmd', text: 'brainbaseedudemo --free' },
  { type: 'ok', text: '✔ 3 free demo classes added to your wallet' },
  { type: 'out', text: '  Live class starts in 2 minutes…' },
  { type: 'gap' },
  { type: 'cmd', text: 'brainbaseeduprogress' },
  { type: 'out', text: '  Attendance 94%  ·  Worksheets 12/12  ·  Streak 🔥 7 days' },
  { type: 'ok', text: '✔ You\'re on track. Keep going!' },
];

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
  const hasBg = /\bbg-/.test(className);
  return (
    <div className={`rounded-[1.75rem] border-2 border-slate-900/5 ${hasBg ? '' : 'bg-white'} shadow-[0_8px_30px_-12px_rgba(30,27,75,0.18)] ${rotate} ${className}`}>
      {children}
    </div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const } }),
};

// ── Spotlight card radial glow follows the cursor ───────────────────────────
function SpotlightCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, on: false });
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top, on: true });
      }}
      onMouseLeave={() => setPos((p) => ({ ...p, on: false }))}
      className={`group relative overflow-hidden ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
        style={{
          opacity: pos.on ? 1 : 0,
          background: `radial-gradient(240px circle at ${pos.x}px ${pos.y}px, rgba(79,70,229,0.14), transparent 65%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ── Scroll-reveal words light up as the section scrolls through ─────────────
function RevealWord({ children, progress, range }: {
  children: React.ReactNode;
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  const color = useTransform(progress, range, ['#cbd5e1', '#1e1b4b']);
  return <motion.span style={{ opacity, color }} className="mr-[0.28em] inline-block">{children}</motion.span>;
}

function ScrollReveal({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] });
  const words = text.split(' ');
  return (
    <p ref={ref} className="mx-auto max-w-4xl text-center text-3xl font-extrabold leading-[1.25] tracking-tight md:text-5xl">
      {words.map((w, i) => (
        <RevealWord key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
          {w}
        </RevealWord>
      ))}
    </p>
  );
}

const FAQS = [
  { q: 'Is the first class really free?', a: 'Yes! Every new student gets free demo credits to try classes with different tutors before committing. No card required.' },
  { q: 'How do payments work?', a: 'You only pay for classes you actually attend. Credits are deducted from your wallet after each completed class fully transparent, no hidden fees.' },
  { q: 'Are the tutors verified?', a: 'Every tutor is background-checked, qualification-verified and continuously rated by real students before they can teach on the platform.' },
  { q: 'Can parents track progress?', a: 'Absolutely. Parents link to their child and get weekly performance reports, attendance and class history right in their dashboard.' },
  { q: 'What subjects can I learn?', a: 'Over 100 subjects from Mathematics, Physics and Coding to Public Speaking, Art and Music, across all grade levels.' },
];

const SKILL_TABS = [
  { id: 'foundations', title: 'Strong foundations', subtitle: 'Concept clarity in every chapter', img: '/doodles/undraw_road-to-knowledge_ufma.svg', points: ['Clear explanations with real-life examples', 'Step-by-step methods for every problem type', 'Practice right inside the live class'] },
  { id: 'problem', title: 'Problem-solving power', subtitle: 'From simple sums to tricky questions', img: '/doodles/undraw_visual-explanation_vd4l.svg', points: ['Decode any question slowly and confidently', 'Smart strategies for time-bound exams', 'Build speed without losing accuracy'] },
  { id: 'thinking', title: 'Critical thinking', subtitle: 'Not just answers, but reasoning', img: '/doodles/undraw_deep-work_muov.svg', points: ['Ask why and how in every topic', 'Compare different solution paths', 'Understand mistakes and fix them'] },
  { id: 'confidence', title: 'Classroom confidence', subtitle: 'Speak up and lead discussions', img: '/doodles/undraw_group-project_kow1.svg', points: ['A safe space to ask any doubt', 'Regular small wins and appreciation', 'Present solutions to peers and tutor'] },
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
  const [activeSkill, setActiveSkill] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setWordIdx((i) => (i + 1) % ROTATING.length), 2400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setActiveSkill((i) => (i + 1) % SKILL_TABS.length), 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="min-h-screen overflow-x-clip text-slate-900 antialiased selection:bg-indigo-600 selection:text-white"
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
            <span className="text-xl font-extrabold tracking-tight">Brainbase Edu</span>
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
                Book a free demo, compare ratings and learn live with India's most loved tutors. No pressure, no contracts just better learning.
              </motion.p>

              {/* Rotating subject pill */}
              <motion.div variants={fadeUp} className="mt-4 flex items-center gap-2.5">
                <span className="text-sm font-semibold text-slate-500">Now teaching</span>
                <span className="inline-flex h-8 items-center overflow-hidden rounded-full bg-indigo-600 px-4">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={wordIdx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.28 }}
                      className="text-sm font-bold text-white"
                    >
                      {ROTATING[wordIdx]}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className="text-sm font-semibold text-slate-400">+ 100 more</span>
              </motion.div>

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

            {/* RIGHT illustration with doodles */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* soft panel behind */}
              <div className="absolute inset-2 -rotate-2 rounded-[3rem] bg-gradient-to-br from-indigo-100 via-violet-50 to-amber-50" />
              <div className="absolute right-6 top-6 h-24 w-24 rounded-full bg-amber-200/50 blur-2xl" />

              {/* main illustration */}
              <div className="relative z-10 flex items-center justify-center px-6 py-10">
                <img
                  src="/doodles/undraw_education_3vwh.svg"
                  alt="Students learning together"
                  className="w-full max-w-md drop-shadow-sm"
                  loading="eager"
                />
              </div>

              {/* doodle accents */}
              <Confetti className="absolute -left-3 top-2 z-20 h-10 w-16 text-amber-400" />
              <Pencil className="absolute -right-2 bottom-20 z-20 h-10 w-10 -rotate-12 text-rose-400" />
              <Star4 className="absolute right-10 top-4 z-20 h-7 w-7 text-indigo-400" />

              {/* floating sticker live class */}
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

              {/* floating sticker tutors count */}
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

              {/* floating sticker rating */}
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
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-50 via-white to-amber-50 shadow-[0_30px_80px_-30px_rgba(79,70,229,0.45)] ring-1 ring-indigo-100">
              {/* highlight glow blobs */}
              <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-indigo-200/40 blur-3xl" />
              <div className="pointer-events-none absolute -right-16 -bottom-16 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl" />
              <Sparkle className="pointer-events-none absolute right-8 top-8 h-9 w-9 text-amber-300" />

              <div className="relative z-10 grid items-center gap-8 p-7 md:grid-cols-[1.1fr_1fr] md:p-10">
                {/* Left copy */}
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100/70 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-700">
                    <Sparkle className="h-3 w-3" /> On the house
                  </span>
                  <h2 className="mt-3 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
                    Start with{' '}
                    <span className="relative inline-block">
                      <motion.span
                        className="relative z-10 inline-block text-indigo-600"
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        3 free
                      </motion.span>
                      <Underline className="absolute -bottom-1.5 left-0 h-3.5 w-full text-amber-400" />
                    </span>{' '}
                    demo classes
                  </h2>
                  <p className="mt-3 max-w-md text-base text-slate-500 md:text-lg">
                    Try different tutors before paying a single rupee. No card, no commitment just real classes.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <motion.div
                      animate={{ y: [0, -4, 0], boxShadow: ['0 8px 24px -10px rgba(79,70,229,0.5)', '0 16px 36px -10px rgba(79,70,229,0.7)', '0 8px 24px -10px rgba(79,70,229,0.5)'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="rounded-2xl"
                    >
                      <Link to="/register/student" className="group inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-7 py-3.5 text-base font-bold text-white transition-colors hover:bg-indigo-700">
                        Claim your demos <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </motion.div>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-400">
                      <CheckScribble className="h-4 w-4 text-emerald-500" /> No credit card
                    </span>
                  </div>
                </div>

                {/* Right 3 demo-class chips */}
                <div className="flex flex-col gap-3">
                  {[
                    { n: '1', subj: 'Mathematics', tutor: 'with Priya', grad: 'from-indigo-500 to-violet-600', rot: 'lg:-rotate-1' },
                    { n: '2', subj: 'Physics', tutor: 'with Rahul', grad: 'from-amber-400 to-orange-500', rot: 'lg:rotate-1' },
                    { n: '3', subj: 'Coding', tutor: 'with Deepa', grad: 'from-teal-500 to-emerald-600', rot: 'lg:-rotate-1' },
                  ].map(({ n, subj, tutor, grad, rot }) => (
                    <div key={n} className={`flex items-center gap-4 rounded-2xl border-2 border-slate-900/5 bg-white p-3.5 shadow-sm transition-transform hover:translate-x-1 ${rot}`}>
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-xl font-extrabold text-white`}>{n}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-slate-900">{subj}</p>
                        <p className="text-xs text-slate-400">{tutor}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">FREE</span>
                    </div>
                  ))}
                </div>
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
              No more juggling 5 different apps. Classes, homework, chat, recordings and payments all in one friendly place.
            </p>
          </motion.div>

          {/* Bento top row: featured + promo */}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Featured Live HD Classes */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} className="lg:col-span-2">
              <div className="relative h-full overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-indigo-600 to-violet-700 p-8 shadow-[0_20px_50px_-20px_rgba(79,70,229,0.6)]">
                <Sparkle className="pointer-events-none absolute right-8 top-8 h-10 w-10 text-white/20" />
                <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Live now
                </span>
                <span className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                  <Video className="h-7 w-7 text-white" />
                </span>
                <h3 className="mt-4 text-2xl font-extrabold text-white md:text-3xl">Live HD Classes</h3>
                <p className="mt-2 max-w-md text-base text-indigo-100">
                  Real-time lessons with screen share, whiteboard, raise-hand and instant replays all in a native in-browser classroom. No downloads.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {['Screen share', 'Whiteboard', 'Auto-record', 'Live chat'].map((t) => (
                    <span key={t} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">{t}</span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Promo all-in-one */}
            <motion.div custom={1} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
              <div className="relative flex h-full flex-col justify-center overflow-hidden rounded-[1.75rem] border-2 border-amber-200 bg-amber-50 p-8">
                <Confetti className="pointer-events-none absolute right-6 top-6 h-10 w-16 text-amber-300" />
                <p className="text-5xl font-extrabold text-amber-600">9</p>
                <p className="mt-1 text-lg font-extrabold text-slate-900">powerful modules</p>
                <p className="mt-2 text-sm text-slate-600">One login. Everything your learning needs no app-juggling, ever.</p>
              </div>
            </motion.div>
          </div>

          {/* Module grid */}
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: UserCheck, title: 'Attendance Tracking', desc: 'Auto-marked when students join. Live rate per learner.', bg: 'bg-teal-50', tx: 'text-teal-600', hov: 'hover:border-teal-300' },
              { Icon: MessageSquare, title: 'Chat & Doubts', desc: 'Private messaging between students, tutors & parents.', bg: 'bg-rose-50', tx: 'text-rose-500', hov: 'hover:border-rose-300' },
              { Icon: FileText, title: 'Worksheets', desc: 'Auto-graded interactive quizzes plus file uploads.', bg: 'bg-amber-50', tx: 'text-amber-600', hov: 'hover:border-amber-300' },
              { Icon: ClipboardList, title: 'Assignments', desc: 'Set tasks, collect submissions, grade with feedback.', bg: 'bg-violet-50', tx: 'text-violet-600', hov: 'hover:border-violet-300' },
              { Icon: FolderOpen, title: 'Resources Library', desc: 'Notes, PDFs & study material students can download.', bg: 'bg-sky-50', tx: 'text-sky-600', hov: 'hover:border-sky-300' },
              { Icon: Film, title: 'Class Recordings', desc: 'Every session auto-recorded rewatch anytime.', bg: 'bg-indigo-50', tx: 'text-indigo-600', hov: 'hover:border-indigo-300' },
              { Icon: BarChart3, title: 'Progress Analytics', desc: 'Weekly reports & performance for every learner.', bg: 'bg-teal-50', tx: 'text-teal-600', hov: 'hover:border-teal-300' },
              { Icon: Wallet, title: 'Wallet & Payments', desc: 'Pay only for classes attended. Instant tutor payouts.', bg: 'bg-amber-50', tx: 'text-amber-600', hov: 'hover:border-amber-300' },
            ].map(({ Icon, title, desc, bg, tx, hov }, i) => (
              <motion.div key={title} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
                <SpotlightCard className={`h-full rounded-[1.5rem] border-2 border-slate-900/5 bg-white p-5 transition-all hover:-translate-y-1.5 ${hov}`}>
                  <span className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${bg}`}>
                    <Icon className={`h-5 w-5 ${tx}`} />
                  </span>
                  <h3 className="font-extrabold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{desc}</p>
                </SpotlightCard>
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { s: 'Mathematics', Icon: Sigma, tutors: '820', bg: 'bg-indigo-50', tx: 'text-indigo-600', ring: 'hover:border-indigo-300' },
              { s: 'Physics', Icon: Atom, tutors: '540', bg: 'bg-amber-50', tx: 'text-amber-600', ring: 'hover:border-amber-300' },
              { s: 'Coding', Icon: Code, tutors: '610', bg: 'bg-teal-50', tx: 'text-teal-600', ring: 'hover:border-teal-300' },
              { s: 'English', Icon: Languages, tutors: '730', bg: 'bg-rose-50', tx: 'text-rose-500', ring: 'hover:border-rose-300' },
              { s: 'Chemistry', Icon: FlaskConical, tutors: '420', bg: 'bg-violet-50', tx: 'text-violet-600', ring: 'hover:border-violet-300' },
              { s: 'Biology', Icon: Microscope, tutors: '390', bg: 'bg-sky-50', tx: 'text-sky-600', ring: 'hover:border-sky-300' },
              { s: 'Public Speaking', Icon: Mic, tutors: '210', bg: 'bg-teal-50', tx: 'text-teal-600', ring: 'hover:border-teal-300' },
              { s: 'Computer Science', Icon: Cpu, tutors: '480', bg: 'bg-indigo-50', tx: 'text-indigo-600', ring: 'hover:border-indigo-300' },
            ].map(({ s, Icon, tutors, bg, tx, ring }, i) => (
              <motion.div key={s} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
                <Link to="/tutors" className={`group flex items-center gap-3 rounded-2xl border-2 border-slate-900/5 bg-white p-4 transition-all hover:-translate-y-1 ${ring}`}>
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg} ${tx}`}><Icon className="h-6 w-6" /></span>
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-slate-900">{s}</p>
                    <p className="text-xs font-semibold text-slate-400">{tutors} tutors</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/tutors" className="inline-flex items-center gap-2 rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-6 py-3 text-sm font-bold text-indigo-700 transition-all hover:-translate-y-0.5 hover:bg-indigo-100">
              Explore all 100+ subjects <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ════════ SKILLS FOCUS (tabbed) ════════ */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div className="mb-12 text-center" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <Hand className="text-2xl text-indigo-500">superpowers, unlocked</Hand>
            <h2 className="mt-1 text-4xl font-extrabold tracking-tight md:text-6xl">
              What your child will{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-indigo-600">learn</span>
                <Underline className="absolute -bottom-2 left-0 h-4 w-full text-amber-400" />
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Switch between skill areas to see how our tutors turn concepts into superpowers.
            </p>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-stretch">
            {/* Tabs flex-1 so the column height matches the panel */}
            <div className="flex flex-col gap-3">
              {SKILL_TABS.map((tab, i) => {
                const active = i === activeSkill;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSkill(i)}
                    className={`flex flex-col justify-center rounded-2xl border-2 p-4 text-left transition-all lg:flex-1 ${
                      active
                        ? 'border-indigo-600 bg-indigo-600 shadow-lg'
                        : 'border-slate-900/5 bg-white hover:border-indigo-200'
                    }`}
                  >
                    <p className={`flex items-center gap-2 font-extrabold ${active ? 'text-white' : 'text-slate-900'}`}>
                      <span className={`h-2 w-2 rounded-full ${active ? 'bg-amber-300' : 'bg-indigo-500'}`} />
                      {tab.title}
                    </p>
                    <p className={`mt-1 pl-4 text-sm ${active ? 'text-indigo-100' : 'text-slate-400'}`}>{tab.subtitle}</p>
                  </button>
                );
              })}
            </div>

            {/* Panel fixed height so it never jumps, stretches to match tabs */}
            <div className="relative h-full min-h-[460px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={SKILL_TABS[activeSkill].id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0"
                >
                  <Sticker className="grid h-full gap-6 overflow-hidden p-6 md:grid-cols-2 md:p-8">
                    {/* left copy */}
                    <div className="flex flex-col">
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-indigo-600">
                        <Sparkle className="h-3 w-3" /> Skills focus
                      </span>
                      <h3 className="mt-3 text-2xl font-extrabold md:text-3xl">{SKILL_TABS[activeSkill].title}</h3>
                      <p className="mt-1.5 text-slate-500">{SKILL_TABS[activeSkill].subtitle}</p>
                      <ul className="mt-5 space-y-3">
                        {SKILL_TABS[activeSkill].points.map((p) => (
                          <li key={p} className="flex items-start gap-2.5 text-sm font-semibold text-slate-700">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                              <CheckScribble className="h-3 w-3" />
                            </span>
                            {p}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto flex items-center gap-2 pt-5 text-xs font-semibold text-slate-400">
                        <Users className="h-4 w-4 text-indigo-400" />
                        Thousands of kids are building this skill right now.
                      </div>
                    </div>

                    {/* right bold illustration panel */}
                    <div className="relative flex flex-col justify-between overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-indigo-500 to-violet-600 p-6">
                      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                      <Sparkle className="pointer-events-none absolute right-4 top-4 h-7 w-7 text-amber-300" />
                      <div className="flex flex-1 items-center justify-center rounded-2xl bg-white/95 p-4">
                        <img src={SKILL_TABS[activeSkill].img} alt={SKILL_TABS[activeSkill].title} className="max-h-44 w-full object-contain" loading="lazy" />
                      </div>
                      <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700">
                        <Bulb className="h-3.5 w-3.5 text-amber-500" /> Fun, kid-friendly activities
                      </span>
                    </div>
                  </Sticker>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ LIVE CLASSROOM SHOWCASE ════════ */}
      <section className="overflow-hidden bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
              <Hand className="text-2xl text-rose-400">your virtual classroom</Hand>
              <h2 className="mt-1 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
                Live classes that feel{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-indigo-600">truly alive</span>
                  <Underline className="absolute -bottom-2 left-0 h-4 w-full text-amber-400" />
                </span>
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                A built-in HD classroom no extra apps, no awkward links. Everything a great lesson needs, right in the browser.
              </p>
              <div className="mt-7 grid grid-cols-2 gap-3">
                {[
                  { Icon: Video, t: 'HD video & audio', bg: 'bg-indigo-50', tx: 'text-indigo-600' },
                  { Icon: Monitor, t: 'Screen sharing', bg: 'bg-sky-50', tx: 'text-sky-600' },
                  { Icon: PenLine, t: 'Live whiteboard', bg: 'bg-violet-50', tx: 'text-violet-600' },
                  { Icon: MessageSquare, t: 'In-class chat', bg: 'bg-rose-50', tx: 'text-rose-500' },
                  { Icon: Film, t: 'Auto recording', bg: 'bg-amber-50', tx: 'text-amber-600' },
                  { Icon: UserCheck, t: 'Auto attendance', bg: 'bg-teal-50', tx: 'text-teal-600' },
                ].map(({ Icon, t, bg, tx }) => (
                  <div key={t} className="group flex items-center gap-2.5 rounded-2xl border-2 border-slate-900/5 bg-white px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:border-indigo-200">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                      <Icon className={`h-4 w-4 ${tx}`} />
                    </span>
                    <span className="text-sm font-bold text-slate-800">{t}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div className="relative" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
              <div className="absolute -right-4 -top-4 h-28 w-28 rotate-6 rounded-3xl bg-rose-100" />
              <div className="absolute -bottom-5 -left-3 h-24 w-24 -rotate-6 rounded-3xl bg-amber-100" />
              <Sticker rotate="rotate-2" className="relative z-10 bg-gradient-to-br from-rose-50 to-indigo-50 p-8">
                <img src="/doodles/undraw_video-tutorial_lgts.svg" alt="Live video class" className="w-full" loading="lazy" />
              </Sticker>
              <Confetti className="absolute -left-3 top-2 z-20 h-10 w-16 text-rose-400" />
            </motion.div>
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

          <div className="relative grid gap-6 md:grid-cols-3">
            {[
              { n: '01', Icon: Search, title: 'Find your tutor', desc: 'Browse verified tutors by subject, language and schedule. Compare ratings and pick your match.', grad: 'from-indigo-500 to-violet-600', soft: 'bg-indigo-50', accent: 'bg-indigo-500' },
              { n: '02', Icon: Video, title: 'Book a free demo', desc: 'Try a live class before you commit zero risk, zero cost. Use your 3 free demo credits.', grad: 'from-amber-400 to-orange-500', soft: 'bg-amber-50', accent: 'bg-amber-400', featured: true },
              { n: '03', Icon: Trophy, title: 'Learn & shine', desc: 'Attend live classes, finish worksheets and ace your exams with weekly progress tracking.', grad: 'from-teal-500 to-emerald-600', soft: 'bg-teal-50', accent: 'bg-teal-500' },
            ].map(({ n, Icon, title, desc, grad, soft, accent, featured }, i) => (
              <motion.div key={n} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="relative">
                <div className={`relative h-full overflow-hidden rounded-[1.75rem] border-2 border-slate-900/5 bg-white p-7 shadow-[0_8px_30px_-12px_rgba(30,27,75,0.18)] transition-transform hover:-translate-y-1.5 ${featured ? 'md:-translate-y-3' : ''}`}>
                  {/* top accent bar */}
                  <div className={`absolute inset-x-0 top-0 h-1.5 ${accent}`} />
                  {/* big number watermark main color */}
                  <span className="absolute -right-1 -top-1 text-7xl font-extrabold text-indigo-600/15">{n}</span>
                  <span className={`relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </span>
                  <h3 className="text-xl font-extrabold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{desc}</p>
                  <span className={`mt-5 inline-flex items-center gap-1.5 rounded-full ${soft} px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600`}>
                    Step {i + 1} of 3
                  </span>
                </div>
                {i < 2 && <DottedPath className="absolute -right-6 top-20 z-20 hidden h-8 w-14 text-indigo-300 md:block" />}
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
              <Sticker rotate="-rotate-2" className="relative z-10 overflow-hidden bg-gradient-to-br from-indigo-50 to-amber-50 p-8">
                <img
                  src="/doodles/undraw_sharing-knowledge_2jx3.svg"
                  alt="Tutor sharing knowledge"
                  className="w-full"
                  loading="lazy"
                />
              </Sticker>
              <Pencil className="absolute -right-3 top-6 z-20 h-12 w-12 rotate-12 text-rose-400" />
              <Sparkle className="absolute -left-3 top-4 z-20 h-8 w-8 text-amber-400" />
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
                Students, parents and tutors save time and money so everyone can focus on what matters: real learning outcomes.
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

      {/* ════════ MADE FOR EVERYONE role cards ════════ */}
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
              Whether you're learning, teaching, parenting or running a school brainbaseedufits the way you work.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              { role: 'Students', tag: 'Learn', desc: 'Live HD classes, worksheets, games and instant doubt-solving.', img: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=500&q=80', bg: 'from-indigo-500 to-violet-600', rot: '-rotate-1', to: '/register/student' },
              { role: 'Tutors', tag: 'Teach', desc: 'Set your rate, build a schedule and get paid on time, every class.', img: 'https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=500&q=80', bg: 'from-amber-500 to-orange-600', rot: 'rotate-1', to: '/register/tutor' },
              { role: 'Parents', tag: 'Monitor', desc: 'Weekly reports, attendance and progress full peace of mind.', img: 'https://images.unsplash.com/photo-1591474200742-8e512e6f98f8?w=500&q=80', bg: 'from-teal-500 to-emerald-600', rot: '-rotate-1', to: '/register/parent' },
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

      {/* ════════ TERMINAL / CODING ════════ */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
              <Hand className="text-2xl text-teal-500">for future builders</Hand>
              <h2 className="mt-1 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
                Learn to{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-indigo-600">code</span>
                  <Underline className="absolute -bottom-2 left-0 h-4 w-full text-amber-400" />
                </span>{' '}
                the fun way
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Python, web dev, app building and more taught live by working engineers. Real projects, instant feedback, zero boring lectures.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Live coding classes with screen share & whiteboard',
                  'Hands-on projects reviewed by your tutor',
                  'From first "Hello World" to full apps',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm font-semibold text-slate-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckScribble className="h-3 w-3" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <Link to="/tutors" className="group mt-8 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-7 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-indigo-700">
                Find a coding tutor
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>

            <motion.div className="relative" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
              <Sparkle className="pointer-events-none absolute -left-4 -top-4 z-10 h-9 w-9 text-amber-400" />
              <Star4 className="pointer-events-none absolute -right-3 bottom-8 z-10 h-7 w-7 text-indigo-400" />
              <Terminal lines={CODE_LINES} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════ PEEK INSIDE CardSwap ════════ */}
      <section className="relative bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 py-20">
        {/* blobs layer clipped so they don't bleed, but section itself is overflow-visible for the card fan */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <Sparkle className="absolute right-[8%] top-12 h-9 w-9 text-amber-300/40" />
        </div>
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <Hand className="text-2xl text-amber-300">a peek inside</Hand>
            <h2 className="mt-1 text-4xl font-extrabold leading-[1.1] tracking-tight text-white md:text-5xl">
              Your whole learning world,{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-amber-300">one tap away</span>
              </span>
            </h2>
            <p className="mt-4 max-w-md text-lg text-indigo-200">
              Live classes, wallet, worksheets, assignments, chat, recordings, mind games and more every dashboard, beautifully organised.
            </p>
            {/* feature tags all dashboard features */}
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                'Live Classes', 'Attendance', 'Chat & Doubts', 'Worksheets', 'Assignments',
                'Resources', 'Recordings', 'Progress', 'Wallet', 'Mind Games', 'Analytics', 'Scheduling',
              ].map((f) => (
                <span key={f} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-100">{f}</span>
              ))}
            </div>
            <Link to="/register/student" className="group mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-base font-bold text-indigo-700 shadow-lg transition-all hover:-translate-y-0.5">
              Explore the dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* CardSwap stack every dashboard feature */}
          <div className="relative hidden h-[460px] lg:block">
            <CardSwap width={400} height={270} cardDistance={42} verticalDistance={44} delay={2600} pauseOnHover skewAmount={4} easing="linear">
              {/* Live class */}
              <Card customClass="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/70"><Video className="h-4 w-4" /> Live class</div>
                <p className="mt-3 text-2xl font-extrabold">Physics · Mechanics</p>
                <p className="mt-1 text-sm text-white/70">with Dr. Mehta · ★ 4.9</p>
                <div className="mt-5 grid grid-cols-4 gap-2">
                  {['MS', 'AV', 'KN', 'RM'].map((x) => (
                    <div key={x} className="flex h-12 items-center justify-center rounded-xl bg-white/15 text-sm font-bold">{x}</div>
                  ))}
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Live now</span>
              </Card>

              {/* Mind games student */}
              <Card customClass="bg-gradient-to-br from-fuchsia-500 to-purple-600 p-6 text-white">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80"><Gamepad2 className="h-4 w-4" /> Mind games</div>
                <p className="mt-3 text-2xl font-extrabold">Brain training</p>
                <p className="mt-1 text-sm text-white/80">Learn while you play · earn streaks</p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  {['🏎 Grand Prix', '🔢 Quick Count', '🧩 Number Order'].map((g) => (
                    <div key={g} className="rounded-xl bg-white/15 px-2 py-3">{g}</div>
                  ))}
                </div>
              </Card>

              {/* Worksheets */}
              <Card customClass="bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80"><FileText className="h-4 w-4" /> Worksheets</div>
                <p className="mt-3 text-2xl font-extrabold">Algebra Quiz</p>
                <p className="mt-1 text-sm text-white/80">Auto-graded · instant score</p>
                <div className="mt-5 space-y-2 text-sm">
                  <div className="rounded-xl bg-white/25 px-3 py-2 font-semibold">A. Inertia ✓</div>
                  <div className="rounded-xl bg-white/10 px-3 py-2">B. Momentum</div>
                </div>
              </Card>

              {/* Assignments */}
              <Card customClass="bg-gradient-to-br from-violet-500 to-fuchsia-600 p-6 text-white">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80"><ClipboardList className="h-4 w-4" /> Assignments</div>
                <p className="mt-3 text-2xl font-extrabold">Chapter 3 Essay</p>
                <p className="mt-1 text-sm text-white/80">Due tomorrow · 1 submission</p>
                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between rounded-xl bg-white/15 px-3 py-2"><span>Submitted</span><span className="font-bold">Graded 9/10</span></div>
                </div>
              </Card>

              {/* Chat */}
              <Card customClass="bg-gradient-to-br from-rose-500 to-pink-600 p-6 text-white">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80"><MessageSquare className="h-4 w-4" /> Chat & doubts</div>
                <p className="mt-4 text-sm"><span className="inline-block rounded-2xl bg-white/15 px-3 py-1.5">Sir, I don't get Q3 🤔</span></p>
                <p className="mt-2 text-right text-sm"><span className="inline-block rounded-2xl bg-white px-3 py-1.5 font-semibold text-rose-600">Let me explain!</span></p>
                <p className="mt-3 text-xs text-white/70">Students · tutors · parents · principals</p>
              </Card>

              {/* Recordings */}
              <Card customClass="bg-gradient-to-br from-sky-500 to-blue-600 p-6 text-white">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80"><Film className="h-4 w-4" /> Recordings</div>
                <p className="mt-3 text-2xl font-extrabold">Algebra · 48 min</p>
                <p className="mt-1 text-sm text-white/80">Auto-recorded · rewatch anytime</p>
                <div className="mt-5 flex items-center justify-center rounded-xl bg-white/15 py-5">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90"><Play className="h-5 w-5 fill-sky-600 text-sky-600 ml-0.5" /></span>
                </div>
              </Card>

              {/* Wallet */}
              <Card customClass="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80"><Wallet className="h-4 w-4" /> Wallet</div>
                <p className="mt-3 text-3xl font-extrabold">$48.00</p>
                <p className="mt-1 text-sm text-white/80">3 free demo credits active</p>
                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between rounded-xl bg-white/15 px-3 py-2"><span>Maths · completed</span><span className="font-bold">−$8</span></div>
                  <div className="flex justify-between rounded-xl bg-white/15 px-3 py-2"><span>Demo credit</span><span className="font-bold">+$10</span></div>
                </div>
              </Card>

              {/* Progress / Analytics */}
              <Card customClass="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 text-white">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80"><BarChart3 className="h-4 w-4" /> Progress & attendance</div>
                <p className="mt-3 text-2xl font-extrabold">94% attendance</p>
                <p className="mt-1 text-sm text-white/80">Worksheets 12/12 · streak 7 days</p>
                <div className="mt-5 flex items-end gap-1.5 h-16">
                  {[40, 65, 55, 80, 72, 90, 100].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-md bg-white/30" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </Card>

              {/* Resources */}
              <Card customClass="bg-gradient-to-br from-cyan-500 to-sky-600 p-6 text-white">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80"><FolderOpen className="h-4 w-4" /> Resources</div>
                <p className="mt-3 text-2xl font-extrabold">Study library</p>
                <p className="mt-1 text-sm text-white/80">Notes, PDFs & slides to download</p>
                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2"><FileText className="h-4 w-4" /> Chapter-3-notes.pdf</div>
                  <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2"><FileText className="h-4 w-4" /> Formula-sheet.pdf</div>
                </div>
              </Card>

              {/* Scheduling */}
              <Card customClass="bg-gradient-to-br from-rose-500 to-red-600 p-6 text-white">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80"><Calendar className="h-4 w-4" /> Scheduling</div>
                <p className="mt-3 text-2xl font-extrabold">This week</p>
                <p className="mt-1 text-sm text-white/80">3 classes booked · auto reminders</p>
                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between rounded-xl bg-white/15 px-3 py-2"><span>Tue · Maths</span><span className="font-bold">10:00</span></div>
                  <div className="flex justify-between rounded-xl bg-white/15 px-3 py-2"><span>Thu · Physics</span><span className="font-bold">16:30</span></div>
                </div>
              </Card>
            </CardSwap>
          </div>
        </div>
      </section>

      {/* ════════ COMPARISON ════════ */}
      <section className="relative overflow-hidden py-20">
        <Squiggle className="pointer-events-none absolute left-[8%] top-20 hidden h-5 w-24 text-amber-300 lg:block" />
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div className="mb-14 text-center" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <Hand className="text-2xl text-rose-400">spot the difference</Hand>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">
              Why families{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-indigo-600">switch</span>
                <Underline className="absolute -bottom-2 left-0 h-4 w-full text-amber-400" />
              </span>{' '}
              to us
            </h2>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Old way */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <Sticker rotate="-rotate-1" className="h-full bg-slate-50 p-7">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Old-school tuition</p>
                <h3 className="mt-1 text-2xl font-extrabold text-slate-500">The hard way</h3>
                <ul className="mt-6 space-y-3.5">
                  {[
                    'Travel across town for every class',
                    'Pay full month upfront, no refunds',
                    'No way to track real progress',
                    'Miss a class? It\'s gone forever',
                    'Stuck with one tutor, like it or not',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">✕</span>
                      <span className="text-sm font-medium text-slate-500 line-through decoration-slate-300">{t}</span>
                    </li>
                  ))}
                </ul>
              </Sticker>
            </motion.div>

            {/* brainbaseeduway */}
            <motion.div custom={1} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <Sticker rotate="rotate-1" className="relative h-full overflow-hidden bg-indigo-600 p-7">
                <Sparkle className="absolute right-5 top-5 h-9 w-9 text-white/20" />
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">With Brainbase Edu</p>
                <h3 className="mt-1 text-2xl font-extrabold text-white">The smart way</h3>
                <ul className="mt-6 space-y-3.5">
                  {[
                    'Learn live from home, anywhere',
                    'Pay per class only for what you attend',
                    'Weekly reports & attendance tracking',
                    'Every class auto-recorded to rewatch',
                    'Switch tutors anytime, free demos first',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-indigo-900"><CheckScribble className="h-3 w-3" /></span>
                      <span className="text-sm font-semibold text-white">{t}</span>
                    </li>
                  ))}
                </ul>
              </Sticker>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════ TRUST & SAFETY ════════ */}
      <section className="overflow-hidden bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <motion.div className="relative order-2 lg:order-1" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
              <div className="absolute -left-4 -top-4 h-24 w-24 rotate-6 rounded-3xl bg-teal-100" />
              <Sticker rotate="-rotate-2" className="relative z-10 bg-gradient-to-br from-teal-50 to-indigo-50 p-8">
                <img src="/doodles/undraw_certification_oqiz.svg" alt="Safe and certified" className="w-full" loading="lazy" />
              </Sticker>
              <Star4 className="absolute -right-2 top-6 z-20 h-8 w-8 text-amber-400" />
            </motion.div>

            <motion.div className="order-1 lg:order-2" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
              <Hand className="text-2xl text-teal-500">parents, relax</Hand>
              <h2 className="mt-1 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
                Safe, secure &{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-indigo-600">trusted</span>
                  <Underline className="absolute -bottom-2 left-0 h-4 w-full text-amber-400" />
                </span>
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Your child's safety and your money are protected at every step.
              </p>
              <div className="mt-7 space-y-4">
                {[
                  { Icon: ShieldCheck, t: 'Background-checked tutors', d: 'Every tutor is verified and continuously rated by real students.', c: 'bg-teal-50 text-teal-600' },
                  { Icon: Wallet, t: 'Secure wallet payments', d: 'Pay-per-class with auto-refunds. Money moves only when class completes.', c: 'bg-indigo-50 text-indigo-600' },
                  { Icon: Video, t: 'Recorded for transparency', d: 'Every session is recorded so parents can review anytime.', c: 'bg-amber-50 text-amber-600' },
                  { Icon: Users, t: 'Parent oversight built-in', d: 'Link to your child and monitor classes, attendance and progress.', c: 'bg-rose-50 text-rose-500' },
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
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════ CONNECTION HUB (animated beams) ════════ */}
      <section className="relative overflow-hidden py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div className="mb-14 text-center" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <Hand className="text-2xl text-indigo-500">all in sync</Hand>
            <h2 className="mt-1 text-4xl font-extrabold tracking-tight md:text-6xl">
              One platform connects{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-indigo-600">everyone</span>
                <Underline className="absolute -bottom-2 left-0 h-4 w-full text-amber-400" />
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Students, tutors, parents and principals all working together in real time, on one friendly platform.
            </p>
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
            <ConnectionHub />
          </motion.div>
        </div>
      </section>

      {/* ════════ SCROLL REVEAL STATEMENT ════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal text="We believe every child deserves a tutor who makes learning click patient, expert and genuinely fun. That's the whole point of Brainbase Edu." />
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
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-800 to-violet-900 py-20">
        {/* glow + doodles */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-violet-500/30 blur-3xl" />
        <Sparkle className="pointer-events-none absolute right-[10%] top-12 h-10 w-10 text-amber-300/50" />
        <Star4 className="pointer-events-none absolute left-[8%] bottom-12 h-8 w-8 text-white/15" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <Hand className="text-2xl text-amber-300">the proof is in the numbers</Hand>
          <h2 className="mx-auto mt-1 max-w-3xl text-3xl font-extrabold leading-tight text-white md:text-5xl">
            Real outcomes, thousands of times over
          </h2>

          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { v: '50K+', l: 'Students learning live', Icon: Users },
              { v: '1.2M', l: 'Classes completed', Icon: Video },
              { v: '94%', l: 'Attendance rate', Icon: UserCheck },
              { v: '4.9', l: 'Average tutor rating', Icon: Star },
            ].map(({ v, l, Icon }, i) => (
              <motion.div key={l} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
                <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-8 backdrop-blur-sm">
                  <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                    <Icon className="h-5 w-5 text-amber-300" />
                  </span>
                  <p className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">{v}</p>
                  <p className="mt-2 text-sm font-semibold text-indigo-200">{l}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FAQ ════════ */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Illustration + heading */}
            <motion.div className="lg:sticky lg:top-24" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <Hand className="text-2xl text-teal-500">got questions?</Hand>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">
                Frequently{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-indigo-600">asked</span>
                  <Underline className="absolute -bottom-2 left-0 h-3.5 w-full text-amber-400" />
                </span>
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Everything you need to know before you start. Still stuck? Our team replies fast.
              </p>
              <div className="relative mt-6 max-w-xs">
                <img src="/doodles/undraw_question-answered_ezyn.svg" alt="Questions answered" className="w-full" loading="lazy" />
                <Sparkle className="absolute -right-2 top-0 h-8 w-8 text-amber-400" />
              </div>
            </motion.div>

            {/* Accordion */}
            <div className="space-y-3">
              {FAQS.map((f, i) => (
                <FaqItem key={i} q={f.q} a={f.a} defaultOpen={i === 0} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════ CTA ════════ */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 shadow-[0_30px_80px_-30px_rgba(79,70,229,0.6)]">
            {/* glow blobs + doodles */}
            <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-violet-400/30 blur-3xl" />
            <Sparkle className="pointer-events-none absolute left-10 top-10 h-10 w-10 text-white/20" />
            <Star4 className="pointer-events-none absolute right-14 top-14 h-9 w-9 text-amber-300" />
            <Confetti className="pointer-events-none absolute bottom-10 left-[30%] h-10 w-16 text-white/15" />

            <div className="relative z-10 grid items-center gap-8 px-8 py-14 md:grid-cols-[1.4fr_1fr] md:px-14 md:py-16">
              <div className="text-center md:text-left">
                <Hand className="text-3xl text-amber-300">ready to begin?</Hand>
                <h2 className="mt-2 text-4xl font-extrabold leading-[1.05] text-white md:text-6xl">
                  Start learning today
                </h2>
                <p className="mx-auto mt-4 max-w-md text-lg text-indigo-100 md:mx-0">
                  Join 50,000+ students learning live with India's best tutors. Your first <strong className="font-bold text-white">3 demo classes are free</strong>.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
                  <Link to="/register/student" className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-bold text-indigo-700 shadow-lg transition-all hover:-translate-y-0.5">
                    Get started free <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/tutors" className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/30 bg-white/10 px-7 py-4 text-base font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20">
                    Browse tutors
                  </Link>
                </div>
                <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-indigo-200 md:justify-start">
                  <CheckScribble className="h-4 w-4 text-amber-300" /> No credit card · Cancel anytime
                </div>
              </div>

              {/* illustration */}
              <div className="relative hidden md:block">
                <img src="/doodles/undraw_graduation_u7uc.svg" alt="Graduation" className="mx-auto w-full max-w-xs drop-shadow-xl" loading="lazy" />
                <Cap className="absolute -left-2 bottom-2 h-12 w-12 text-amber-300" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ FOOTER ════════ */}
      <footer className="relative mt-12 overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-900 to-violet-950">
        {/* doodles + glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <Sparkle className="pointer-events-none absolute right-[10%] top-12 h-9 w-9 text-amber-300/40" />
        <Star4 className="pointer-events-none absolute left-[15%] top-10 h-7 w-7 text-white/10" />
        <Cap className="pointer-events-none absolute bottom-12 right-[12%] h-14 w-14 text-white/10" />
        <Confetti className="pointer-events-none absolute bottom-16 left-12 h-10 w-16 text-white/10" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          {/* newsletter row */}
          <div className="flex flex-col items-start justify-between gap-6 border-b border-white/10 pb-8 md:flex-row md:items-center">
            <div>
              <Hand className="text-2xl text-amber-300">stay in the loop</Hand>
              <h3 className="text-2xl font-extrabold text-white md:text-3xl">Learning tips, straight to your inbox</h3>
            </div>
            <div className="flex w-full max-w-md gap-2">
              <input
                type="email"
                placeholder="you@email.com"
                className="h-12 flex-1 rounded-2xl border-2 border-white/15 bg-white/10 px-4 text-sm font-medium text-white placeholder-indigo-200 outline-none transition-colors focus:border-amber-300"
              />
              <button className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-2xl bg-amber-400 px-5 text-sm font-bold text-indigo-950 transition-transform hover:-translate-y-0.5">
                Subscribe <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* link columns */}
          <div className="relative z-10 mt-10 grid gap-10 md:grid-cols-[260px_1fr_1fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-extrabold text-white">Brainbase Edu</span>
              </div>
              <p className="text-sm leading-relaxed text-indigo-200">
                India's friendliest tutoring marketplace connecting students with expert tutors, live.
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1">
                <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                <span className="text-xs font-bold text-amber-300">4.9 · 12K reviews</span>
              </span>
            </div>

            {([
              { h: 'Platform', items: [{ label: 'Find Tutors', to: '/tutors' }, { label: 'Sign in', to: '/login' }, { label: 'Register', to: '/register' }, { label: 'Features', href: '#features' }] },
              { h: "Who it's for", items: [{ label: 'Students' }, { label: 'Tutors' }, { label: 'Principals' }, { label: 'Parents' }] },
              { h: 'Legal', items: [{ label: 'Privacy Policy' }, { label: 'Terms of Service' }, { label: 'Cookie Policy' }, { label: 'Contact Us' }] },
            ] as { h: string; items: { label: string; to?: string; href?: string }[] }[]).map((col) => (
              <div key={col.h}>
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-indigo-300">{col.h}</p>
                <ul className="space-y-2.5 text-sm">
                  {col.items.map((it) => (
                    <li key={it.label}>
                      {it.to ? (
                        <Link to={it.to} className="font-semibold text-indigo-200 transition-colors hover:text-white">{it.label}</Link>
                      ) : it.href ? (
                        <a href={it.href} className="font-semibold text-indigo-200 transition-colors hover:text-white">{it.label}</a>
                      ) : (
                        <span className="cursor-pointer font-semibold text-indigo-200 transition-colors hover:text-white">{it.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="relative z-10 mt-10 flex flex-col items-center gap-4 border-t border-white/10 pt-6 text-sm md:flex-row md:justify-between">
            <p className="font-semibold text-indigo-300">© 2026 Brainbase Edu. All rights reserved.</p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/20"
            >
              <ArrowUp className="h-3.5 w-3.5" /> Back to top
            </button>
            <p className="font-semibold text-indigo-300">Made with <Heart className="inline h-3.5 w-3.5 fill-rose-400 text-rose-400" /> for curious minds.</p>
          </div>
        </div>
      </footer>

      {/* Floating chat */}
      <ChatBot />
    </div>
  );
}
