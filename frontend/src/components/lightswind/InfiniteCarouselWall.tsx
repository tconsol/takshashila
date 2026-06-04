import { Star, CheckCircle2, Quote } from 'lucide-react';
import {
  ThreeDScrollTriggerContainer,
  ThreeDScrollTriggerRow,
} from './ThreeDScrollTrigger';

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
    text: "Physics used to be my nightmare. My tutor on Takshashila explained every concept with real examples. Scored 89 in boards my parents cried happy tears!",
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
    text: "My tutor makes every class fun! We use worksheets, games and live quizzes. I actually look forward to studying now. Never thought I'd say that!",
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
    text: "Onboarding tutors used to take weeks. With Takshashila's invite system we added 15 new tutors in a single day. The support team was incredible throughout.",
    rating: 5,
    verified: true,
    highlight: '15 new tutors added in a single day',
  },
];

const COLORS = [
  'from-indigo-500 to-violet-500',
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
    <div className="relative mx-2 w-[340px] shrink-0 overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-5">
      <Quote className="absolute -right-2 -top-2 h-16 w-16 rotate-180 text-gray-100 dark:text-gray-800" />

      <div className="mb-2.5 flex gap-0.5">
        {[...Array(t.rating)].map((_, i) => (
          <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        ))}
      </div>

      {t.highlight && (
        <p className={`mb-2 bg-gradient-to-r ${color} bg-clip-text text-xs font-bold text-transparent`}>
          {t.highlight}
        </p>
      )}

      <p className="relative z-10 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        &ldquo;{t.text}&rdquo;
      </p>

      <div className="mt-4 flex items-center gap-3">
        <div className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${color} text-xs font-bold text-white`}>
          {t.avatar}
          {t.verified && (
            <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-white text-indigo-600" />
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

export function InfiniteCarouselWall() {
  const row1 = TESTIMONIALS;
  const row2 = [...TESTIMONIALS.slice(4), ...TESTIMONIALS.slice(0, 4)];

  return (
    <div
      className="relative overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
      style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)' }}
    >
      <ThreeDScrollTriggerContainer className="space-y-4">
        <ThreeDScrollTriggerRow baseVelocity={3} direction={1}>
          {row1.map((t, i) => (
            <TestimonialCard key={t.name} t={t} index={i} />
          ))}
        </ThreeDScrollTriggerRow>

        <ThreeDScrollTriggerRow baseVelocity={3} direction={-1}>
          {row2.map((t, i) => (
            <TestimonialCard key={t.name + '-r2'} t={t} index={i} />
          ))}
        </ThreeDScrollTriggerRow>
      </ThreeDScrollTriggerContainer>
    </div>
  );
}
