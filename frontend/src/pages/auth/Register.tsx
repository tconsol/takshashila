import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Award, ArrowRight } from 'lucide-react';

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
];

export function RegisterPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create your account</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Choose how you want to join Takshashila</p>
      </div>

      <div className="space-y-3">
        {ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.title}
              to={r.path}
              className={`flex items-start gap-4 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 transition-all group ${r.bg}`}
            >
              <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${r.color} shadow-md`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 dark:text-white">{r.title}</p>
                  <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-brand-600 transition-colors" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{r.description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {r.highlights.map((h) => (
                    <span key={h} className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                      {h}
                    </span>
                  ))}
                </div>
              </div>
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
