'use client';

import { motion } from 'framer-motion';
import { Star, CheckCircle2, Quote } from 'lucide-react';

interface Testimonial {
  name: string;
  role: string;
  avatar: string;
  text: string;
  rating: number;
  verified?: boolean;
  highlight?: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Priya Sharma',
    role: 'Student · Class 10',
    avatar: 'PS',
    text: 'Takshashila made finding the right tutor effortless. I went from failing Math to scoring 94% in one semester. My confidence has completely transformed!',
    rating: 5,
    verified: true,
    highlight: 'From failing to 94% in one semester',
  },
  {
    name: 'Rahul Mehta',
    role: 'Math & Science Tutor',
    avatar: 'RM',
    text: 'The scheduling and wallet system is seamless. I manage 20+ students without any billing headaches. The platform pays out on time, every time.',
    rating: 5,
    verified: true,
    highlight: '20+ students, zero billing headaches',
  },
  {
    name: 'Dr. Anita Rao',
    role: 'Principal · Greenfield Academy',
    avatar: 'AR',
    text: 'We scaled from 10 tutors to 60 in three months. The analytics give me full visibility into every class and student outcome.',
    rating: 5,
    verified: true,
    highlight: 'Scaled 10 → 60 tutors in three months',
  },
  {
    name: 'Kavya Nair',
    role: 'Student · Class 12',
    avatar: 'KN',
    text: 'Physics used to be my nightmare. My tutor on Takshashila explained every concept with real examples. Scored 89 in boards my parents cried happy tears!',
    rating: 5,
    verified: true,
    highlight: '89 in boards parents cried happy tears!',
  },
  {
    name: 'Suresh Pillai',
    role: 'English & Communication Tutor',
    avatar: 'SP',
    text: 'I joined Takshashila as a part-time tutor. Within two months I had a full schedule and tripled my income compared to offline coaching.',
    rating: 5,
    verified: true,
    highlight: 'Tripled income in two months',
  },
  {
    name: 'Meera Iyer',
    role: 'Parent · Mumbai',
    avatar: 'MI',
    text: 'As a working parent I needed something reliable and safe for my daughter. The tutor ratings, live class recordings and weekly progress reports give me peace of mind.',
    rating: 5,
    verified: false,
    highlight: 'Peace of mind for working parents',
  },
  {
    name: 'Arjun Verma',
    role: 'Student · Class 8',
    avatar: 'AV',
    text: 'My tutor makes every class fun! We use worksheets, games and live quizzes. I actually look forward to studying now. Never thought I\'d say that!',
    rating: 5,
    verified: true,
    highlight: 'I actually look forward to studying now',
  },
  {
    name: 'Deepa Krishnan',
    role: 'Chemistry Tutor',
    avatar: 'DK',
    text: 'The platform is intuitive. Setting my availability, creating assignments and tracking student progress all happen in one place. Game-changer for solo tutors.',
    rating: 5,
    verified: true,
    highlight: 'Everything in one place game-changer',
  },
  {
    name: 'Ravi Shankar',
    role: 'Principal · Sunrise Learning Centre',
    avatar: 'RS',
    text: 'Onboarding tutors used to take weeks. With Takshashila\'s invite system we added 15 new tutors in a single day. The support team was incredible throughout.',
    rating: 5,
    verified: true,
    highlight: '15 new tutors added in a single day',
  },
];

const COLORS = [
  'from-brand-500 to-violet-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
  'from-sky-500 to-blue-500',
  'from-purple-500 to-indigo-500',
  'from-green-500 to-emerald-600',
  'from-fuchsia-500 to-pink-500',
  'from-cyan-500 to-sky-500',
];

function TestimonialCard({ t, index }: { t: Testimonial; index: number }) {
  const color = COLORS[index % COLORS.length];
  return (
    <div className="relative mx-2 w-[360px] shrink-0 overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-200/20 dark:border-gray-800 dark:bg-gray-900">
      {/* Watermark quote */}
      <Quote className="absolute -right-2 -top-2 h-20 w-20 rotate-180 text-gray-100 dark:text-gray-800" />

      {/* Stars */}
      <div className="mb-3 flex gap-0.5">
        {[...Array(t.rating)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
        ))}
      </div>

      {/* Highlight */}
      {t.highlight && (
        <p className={`mb-2 bg-gradient-to-r ${color} bg-clip-text text-xs font-bold text-transparent`}>
          {t.highlight}
        </p>
      )}

      {/* Text */}
      <p className="relative z-10 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        &ldquo;{t.text}&rdquo;
      </p>

      {/* Author */}
      <div className="mt-4 flex items-center gap-3">
        <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${color} text-xs font-bold text-white shadow-md`}>
          {t.avatar}
          {t.verified && (
            <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 h-4 w-4 fill-white text-brand-600" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.name}</p>
          <p className="text-xs text-gray-500">{t.role}</p>
        </div>
      </div>
    </div>
  );
}

function MarqueeRow({
  items,
  direction = 'left',
  speed = 35,
}: {
  items: Testimonial[];
  direction?: 'left' | 'right';
  speed?: number;
}) {
  const tripled = [...items, ...items, ...items];
  const animDir = direction === 'left' ? '-33.333%' : '33.333%';
  const startX = direction === 'left' ? '0%' : '-33.333%';

  return (
    <div className="group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <motion.div
        className="flex"
        initial={{ x: startX }}
        animate={{ x: animDir }}
        transition={{
          duration: speed,
          ease: 'linear',
          repeat: Infinity,
        }}
        style={{ willChange: 'transform' }}
      >
        {tripled.map((t, i) => (
          <TestimonialCard key={`${t.name}-${i}`} t={t} index={i % items.length} />
        ))}
      </motion.div>
    </div>
  );
}

export function InfiniteCarouselWall() {
  const row1 = TESTIMONIALS.slice(0, 3);
  const row2 = TESTIMONIALS.slice(3, 6);
  const row3 = TESTIMONIALS.slice(6, 9);

  return (
    <div className="relative overflow-hidden py-4">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(#7430e3 1px, transparent 1px), linear-gradient(to right, #7430e3 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="space-y-4">
        <MarqueeRow items={row1} direction="left" speed={40} />
        <MarqueeRow items={row2} direction="right" speed={50} />
        <MarqueeRow items={row3} direction="left" speed={35} />
      </div>
    </div>
  );
}
