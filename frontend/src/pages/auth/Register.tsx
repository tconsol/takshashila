import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Award, Heart, ArrowRight, ArrowLeft } from 'lucide-react';

const ROLES = [
  {
    icon: BookOpen,
    title: 'Student',
    description: 'Book sessions with expert tutors, attend live classes, and track your learning progress.',
    color: 'from-blue-500 to-cyan-500',
    bg: 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700',
    path: '/register/student',
    highlights: ['Live 1-on-1 sessions', 'Progress tracking', 'Wallet & payments'],
  },
  {
    icon: GraduationCap,
    title: 'Tutor',
    description: 'Teach students, set your schedule, earn from sessions and build your teaching reputation.',
    color: 'from-violet-500 to-purple-600',
    bg: 'hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-300 dark:hover:border-violet-700',
    path: '/register/tutor',
    highlights: ['Manage your schedule', 'Automatic payouts', 'Student reviews'],
  },
  {
    icon: Award,
    title: 'Principal',
    description: 'Oversee tutors and students at your institution with full analytics and management tools.',
    color: 'from-emerald-500 to-teal-600',
    bg: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-700',
    path: '/register/principal',
    highlights: ['Tutor management', 'Analytics dashboard', 'Institutional overview'],
  },
  {
    icon: Heart,
    title: 'Parent',
    description: "Monitor your child's learning journey classes, attendance, assignments, and worksheets in one place.",
    color: 'from-rose-500 to-pink-500',
    bg: 'hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-300 dark:hover:border-rose-700',
    path: '/register/parent',
    highlights: ['Live progress tracking', 'Attendance reports', 'Worksheet access'],
  },
];

export function RegisterPage() {
  return (
    <div className="space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create your account</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Choose how you want to join Takshashila</p>
      </div>

      <div className="space-y-2">
        {ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.title}
              to={r.path}
              className={`flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 transition-all group ${r.bg}`}
            >
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${r.color} shadow-sm`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{r.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{r.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-brand-600 transition-colors" />
            </Link>
          );
        })}
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Sign in
        </Link>
      </p>
    </div>
  );
}
