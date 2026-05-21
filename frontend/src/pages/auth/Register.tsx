import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Award, Heart, ArrowRight, ArrowLeft } from 'lucide-react';

const ROLES = [
  {
    icon: BookOpen,
    title: 'Student',
    description: 'Book sessions with expert tutors, attend live classes, and track your learning progress.',
    tint: 'bg-clay-sky',
    path: '/register/student',
    highlights: ['Live 1-on-1 sessions', 'Progress tracking', 'Wallet & payments'],
  },
  {
    icon: GraduationCap,
    title: 'Tutor',
    description: 'Teach students, set your schedule, earn from sessions and build your teaching reputation.',
    tint: 'bg-clay-purple',
    path: '/register/tutor',
    highlights: ['Manage your schedule', 'Automatic payouts', 'Student reviews'],
  },
  {
    icon: Award,
    title: 'Principal',
    description: 'Oversee tutors and students at your institution with full analytics and management tools.',
    tint: 'bg-clay-mint',
    path: '/register/principal',
    highlights: ['Tutor management', 'Analytics dashboard', 'Institutional overview'],
  },
  {
    icon: Heart,
    title: 'Parent',
    description: "Monitor your child's learning journey classes, attendance, assignments, and worksheets in one place.",
    tint: 'bg-clay-pink',
    path: '/register/parent',
    highlights: ['Live progress tracking', 'Attendance reports', 'Worksheet access'],
  },
];

export function RegisterPage() {
  return (
    <div className="space-y-7">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-clay-ink bg-white px-3 py-1.5 text-xs font-extrabold text-clay-ink hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-clay-pressed shadow-clay-sm transition-all"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to home
      </Link>

      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-clay-ink dark:text-white">Create your account</h1>
        <p className="mt-2 text-sm font-semibold text-clay-ink/60 dark:text-gray-400">Choose how you want to join Takshashila</p>
      </div>

      <div className="space-y-2.5">
        {ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.title}
              to={r.path}
              className="group flex items-center gap-3 rounded-2xl border-2.5 border-clay-ink bg-white px-3 py-3 shadow-clay-sm transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-clay-pressed"
            >
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border-2 border-clay-ink ${r.tint}`}>
                <Icon className="h-4 w-4 text-clay-ink" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-clay-ink leading-tight">{r.title}</p>
                <p className="text-xs font-semibold text-clay-ink/60 mt-0.5 truncate">{r.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-clay-ink/40 group-hover:text-clay-green-dark group-hover:translate-x-1 transition-all" />
            </Link>
          );
        })}
      </div>

      <p className="text-center text-sm font-semibold text-clay-ink/60 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="font-extrabold text-clay-green-dark hover:text-clay-green">
          Sign in
        </Link>
      </p>
    </div>
  );
}
