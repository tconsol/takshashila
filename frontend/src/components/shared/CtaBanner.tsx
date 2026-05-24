import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Rocket, Search, Star, Users, GraduationCap,
  CheckCircle2, Zap, BookOpen,
} from 'lucide-react';

const FLOATING_CARDS = [
  { icon: Star,          tint: 'bg-clay-yellow', label: '4.9 rating',    sub: 'by 12K+ parents',   pos: 'left-[4%] top-[14%]',    delay: 0 },
  { icon: Users,         tint: 'bg-clay-mint',   label: '50K+ students', sub: 'learning today',    pos: 'left-[2%] bottom-[18%]', delay: 0.4 },
  { icon: GraduationCap, tint: 'bg-clay-sky',    label: '5K+ tutors',    sub: 'expert verified',   pos: 'right-[4%] top-[12%]',   delay: 0.2 },
  { icon: Zap,           tint: 'bg-clay-coral',  label: '3 free demos',  sub: 'no credit card',    pos: 'right-[2%] bottom-[16%]', delay: 0.6 },
];

const TRUST_CHIPS = [
  { icon: CheckCircle2, text: 'No credit card required' },
  { icon: BookOpen,     text: '3 free demo classes' },
  { icon: Zap,          text: 'Set up in 2 minutes' },
];

function FloatCard({
  icon: Icon, tint, label, sub, pos, delay,
}: (typeof FLOATING_CARDS)[0]) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={`absolute hidden xl:flex items-center gap-2.5 rounded-2xl border-2.5 border-clay-ink bg-white px-4 py-3 shadow-clay ${pos}`}
      initial={{ opacity: 0, y: 20 }}
      animate={reduced ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, -8, 0] }}
      transition={{
        opacity: { duration: 0.6, delay },
        y: { duration: 3.5, delay, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-clay-ink ${tint}`}>
        <Icon className="h-4 w-4 text-clay-ink" />
      </div>
      <div>
        <p className="text-sm font-extrabold text-clay-ink">{label}</p>
        <p className="text-[11px] font-semibold text-clay-ink/60">{sub}</p>
      </div>
    </motion.div>
  );
}

export function CtaBanner() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[36px] border-2.5 border-clay-ink bg-clay-green p-10 shadow-clay-lg md:p-16">
          {/* Decorative clay shapes */}
          <div className="absolute -right-8 top-8 h-24 w-24 rotate-12 rounded-3xl border-2.5 border-clay-ink bg-clay-yellow" />
          <div className="absolute -left-6 -top-6 h-20 w-20 rounded-full border-2.5 border-clay-ink bg-clay-coral" />
          <div className="absolute -right-10 -bottom-10 h-28 w-28 -rotate-6 rounded-3xl border-2.5 border-clay-ink bg-clay-sky" />
          <div className="absolute left-1/3 -bottom-6 h-16 w-16 rounded-2xl border-2.5 border-clay-ink bg-clay-pink rotate-12" />

          {/* Floating stat cards */}
          {FLOATING_CARDS.map((c) => (
            <FloatCard key={c.label} {...c} />
          ))}

          {/* Main content */}
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <motion.div
              className="mb-6 inline-flex items-center gap-2 rounded-full border-2.5 border-clay-ink bg-white px-4 py-2 text-sm font-extrabold text-clay-ink shadow-clay-sm"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-clay-green-dark" />
              Trusted by 50,000+ families across India
            </motion.div>

            <motion.h2
              className="mb-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
            >
              Ready to transform{' '}
              <span className="inline-block rounded-2xl border-2.5 border-clay-ink bg-clay-yellow px-3 -mx-1 text-clay-ink">
                your child's
              </span>{' '}
              learning?
            </motion.h2>

            <motion.p
              className="mb-8 text-lg font-semibold leading-relaxed text-white/90 md:text-xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
            >
              Join thousands of families on Takshashila. Start with{' '}
              <span className="font-extrabold text-clay-yellow">3 free demo classes</span> no commitment needed.
            </motion.p>

            <motion.div
              className="mb-8 flex flex-wrap items-center justify-center gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
            >
              <Link
                to="/register/student"
                className="group inline-flex items-center gap-2 rounded-2xl border-2.5 border-clay-ink bg-white px-8 py-4 text-base font-extrabold text-clay-ink shadow-clay transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-clay-pressed"
              >
                <Rocket className="h-5 w-5" />
                Get started free
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/tutors"
                className="group inline-flex items-center gap-2 rounded-2xl border-2.5 border-clay-ink bg-clay-yellow px-8 py-4 text-base font-extrabold text-clay-ink shadow-clay transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-clay-pressed"
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
                  className="flex items-center gap-1.5 rounded-full border-2 border-clay-ink bg-white/95 px-3 py-1.5 text-xs font-extrabold text-clay-ink"
                >
                  <Icon className="h-3.5 w-3.5 text-clay-green-dark" />
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
