import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Award, Heart, ArrowRight, ArrowLeft } from 'lucide-react';

const ROLES = [
  {
    icon: GraduationCap,
    title: 'Student',
    description: 'Book sessions with expert tutors, attend live classes, and track your learning progress.',
    color: 'bg-indigo-50 text-indigo-600',
    ring: 'hover:border-indigo-300',
    path: '/register/student',
    highlights: ['Live 1-on-1 sessions', 'Progress tracking', 'Wallet & payments'],
  },
  {
    icon: BookOpen,
    title: 'Tutor',
    description: 'Teach students, set your schedule, earn from sessions and build your teaching reputation.',
    color: 'bg-violet-50 text-violet-600',
    ring: 'hover:border-violet-300',
    path: '/register/tutor',
    highlights: ['Manage your schedule', 'Automatic payouts', 'Student reviews'],
  },
  {
    icon: Award,
    title: 'Principal',
    description: 'Oversee tutors and students at your institution with full analytics and management tools.',
    color: 'bg-teal-50 text-teal-600',
    ring: 'hover:border-teal-300',
    path: '/register/principal',
    highlights: ['Tutor management', 'Analytics dashboard', 'Institutional overview'],
  },
  {
    icon: Heart,
    title: 'Parent',
    description: "Monitor your child's learning journey — classes, attendance, assignments, and worksheets.",
    color: 'bg-pink-50 text-pink-600',
    ring: 'hover:border-pink-300',
    path: '/register/parent',
    highlights: ['Live progress tracking', 'Attendance reports', 'Worksheet access'],
  },
];

export function RegisterPage() {
  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Create your account</h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Choose how you want to join Takshashila</p>
      </div>

      <div className="space-y-2.5">
        {ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.title}
              to={r.path}
              className={`group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition-all ${r.ring} hover:shadow-sm`}
            >
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${r.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{r.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{r.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
            </Link>
          );
        })}
      </div>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
