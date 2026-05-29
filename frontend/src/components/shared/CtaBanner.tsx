import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Rocket, Search, Star, Users, GraduationCap,
  CheckCircle2, Zap, BookOpen,
} from 'lucide-react';

const FLOATING_CARDS = [
  { icon: Star,          bg: 'bg-amber-50 text-amber-600',   label: '4.9 rating',    sub: 'by 12K+ parents',  pos: 'left-[4%] top-[14%]',    delay: 0 },
  { icon: Users,         bg: 'bg-indigo-50 text-indigo-600', label: '50K+ students', sub: 'learning today',   pos: 'left-[2%] bottom-[18%]', delay: 0.4 },
  { icon: GraduationCap, bg: 'bg-violet-50 text-violet-600', label: '5K+ tutors',    sub: 'expert verified',  pos: 'right-[4%] top-[12%]',   delay: 0.2 },
  { icon: Zap,           bg: 'bg-rose-50 text-rose-600',     label: '3 free demos',  sub: 'no credit card',   pos: 'right-[2%] bottom-[16%]', delay: 0.6 },
];

const TRUST_CHIPS = [
  { icon: CheckCircle2, text: 'No credit card required' },
  { icon: BookOpen,     text: '3 free demo classes' },
  { icon: Zap,          text: 'Set up in 2 minutes' },
];

function FloatCard({ icon: Icon, bg, label, sub, pos, delay }: (typeof FLOATING_CARDS)[0]) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={`absolute hidden xl:flex items-center gap-2.5 rounded-2xl bg-white/95 backdrop-blur-sm border border-white/60 px-4 py-3 shadow-lg ${pos}`}
      initial={{ opacity: 0, y: 20 }}
      animate={reduced ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, -8, 0] }}
      transition={{
        opacity: { duration: 0.6, delay },
        y: { duration: 3.5, delay, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-[11px] text-slate-500">{sub}</p>
      </div>
    </motion.div>
  );
}

export function CtaBanner() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-10 shadow-xl md:p-16">
          {/* Subtle orbs */}
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/30 blur-3xl" aria-hidden />
          <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-indigo-400/30 blur-3xl" aria-hidden />
          <div className="absolute left-1/2 top-0 h-32 w-64 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" aria-hidden />

          {/* Floating stat cards */}
          {FLOATING_CARDS.map((c) => (
            <FloatCard key={c.label} {...c} />
          ))}

          {/* Main content */}
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <motion.div
              className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 px-4 py-2 text-sm font-semibold text-white"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Trusted by 50,000+ families across India
            </motion.div>

            <motion.h2
              className="mb-5 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
            >
              Ready to transform{' '}
              <span className="relative inline-block">
                <span className="relative z-10">your child's</span>
                <span className="absolute inset-x-0 bottom-1 h-3 bg-amber-400/40 rounded-sm -z-0" />
              </span>{' '}
              learning?
            </motion.h2>

            <motion.p
              className="mb-8 text-lg font-medium leading-relaxed text-white/85 md:text-xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
            >
              Join thousands of families on Takshashila. Start with{' '}
              <span className="font-bold text-amber-300">3 free demo classes</span> — no commitment needed.
            </motion.p>

            <motion.div
              className="mb-8 flex flex-wrap items-center justify-center gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
            >
              <Link
                to="/register/student"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-700 shadow-lg hover:shadow-xl hover:bg-white/95 transition-all"
              >
                <Rocket className="h-5 w-5" />
                Get started free
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/tutors"
                className="group inline-flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/30 px-8 py-4 text-base font-semibold text-white hover:bg-white/25 transition-all"
              >
                <Search className="h-5 w-5" />
                Browse tutors
              </Link>
            </motion.div>

            <motion.div
              className="flex flex-wrap items-center justify-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.45 }}
            >
              {TRUST_CHIPS.map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 px-3.5 py-1.5 text-xs font-medium text-white"
                >
                  <Icon className="h-3.5 w-3.5 text-emerald-300" />
                  {text}
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
