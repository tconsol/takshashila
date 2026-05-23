import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Rocket, Search, Star, Users, GraduationCap,
  CheckCircle2, Zap, BookOpen,
} from 'lucide-react';

const FLOATING_CARDS = [
  {
    icon: Star,
    color: 'from-amber-400 to-orange-400',
    label: '4.9 rating',
    sub: 'by 12K+ parents',
    pos: 'left-[4%] top-[14%]',
    delay: 0,
  },
  {
    icon: Users,
    color: 'from-emerald-400 to-teal-500',
    label: '50K+ students',
    sub: 'learning today',
    pos: 'left-[2%] bottom-[18%]',
    delay: 0.4,
  },
  {
    icon: GraduationCap,
    color: 'from-sky-400 to-blue-500',
    label: '5K+ tutors',
    sub: 'expert verified',
    pos: 'right-[4%] top-[12%]',
    delay: 0.2,
  },
  {
    icon: Zap,
    color: 'from-pink-400 to-rose-500',
    label: '3 free demos',
    sub: 'no credit card',
    pos: 'right-[2%] bottom-[16%]',
    delay: 0.6,
  },
];

const TRUST_CHIPS = [
  { icon: CheckCircle2, text: 'No credit card required' },
  { icon: BookOpen,     text: '3 free demo classes' },
  { icon: Zap,          text: 'Set up in 2 minutes' },
];

function FloatCard({
  icon: Icon, color, label, sub, pos, delay,
}: (typeof FLOATING_CARDS)[0]) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={`absolute hidden xl:flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-xl backdrop-blur-md ${pos}`}
      initial={{ opacity: 0, y: 20 }}
      animate={reduced ? { opacity: 1, y: 0 } : {
        opacity: 1,
        y: [0, -8, 0],
      }}
      transition={{
        opacity: { duration: 0.6, delay },
        y: { duration: 3.5, delay, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-md`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="text-[11px] text-white/60">{sub}</p>
      </div>
    </motion.div>
  );
}

export function CtaBanner() {
  const reduced = useReducedMotion();

  return (
    <section className="relative overflow-hidden py-28">
      {/* Multi-layer background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-800 to-violet-900" />

      {/* Animated mesh orbs */}
      <motion.div
        className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-brand-500/40 to-violet-500/30 blur-3xl"
        animate={reduced ? {} : { scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute -right-32 -bottom-32 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-pink-500/30 to-rose-500/20 blur-3xl"
        animate={reduced ? {} : { scale: [1, 1.2, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/20 blur-2xl"
        animate={reduced ? {} : { scale: [1, 1.3, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />

      {/* Subtle noise grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Floating stat cards */}
      {FLOATING_CARDS.map((c) => (
        <FloatCard key={c.label} {...c} />
      ))}

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        {/* Animated badge */}
        <motion.div
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Trusted by 50,000+ families across India
        </motion.div>

        {/* Headline */}
        <motion.h2
          className="mb-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          Ready to transform{' '}
          <span className="relative inline-block">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300">
              your child's
            </span>
            {/* Underline squiggle */}
            <motion.span
              className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-gradient-to-r from-amber-400 to-pink-400 opacity-70"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              style={{ originX: 0 }}
            />
          </span>{' '}
          learning?
        </motion.h2>

        {/* Sub-text */}
        <motion.p
          className="mb-8 text-lg leading-relaxed text-white/75 md:text-xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
        >
          Join thousands of families on Takshashila. Start with{' '}
          <span className="font-semibold text-amber-300">3 free demo classes</span> no commitment needed.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          className="mb-8 flex flex-wrap items-center justify-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3 }}
        >
          <Link
            to="/register/student"
            className="group inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-brand-700 shadow-2xl shadow-white/20 transition-all hover:-translate-y-0.5 hover:bg-amber-50 hover:shadow-white/30"
          >
            <Rocket className="h-5 w-5" />
            Get started free
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/tutors"
            className="group inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/20"
          >
            <Search className="h-5 w-5" />
            Browse tutors
          </Link>
        </motion.div>

        {/* Trust chips */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          {TRUST_CHIPS.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/80"
            >
              <Icon className="h-3.5 w-3.5 text-emerald-400" />
              {text}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
