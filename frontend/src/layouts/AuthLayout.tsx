import { Outlet, Navigate, Link } from 'react-router-dom';
import { GraduationCap, CheckCircle2, Users, Video, BarChart3, Star } from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { ROLE_DASHBOARD_PATHS } from '../constants/roles';

const HIGHLIGHTS = [
  { icon: Video,        text: 'Live HD classes',           color: 'bg-indigo-100 text-indigo-600' },
  { icon: Users,        text: 'Connect tutors & students', color: 'bg-violet-100 text-violet-600' },
  { icon: BarChart3,    text: 'Progress tracking',         color: 'bg-teal-100 text-teal-600' },
  { icon: CheckCircle2, text: 'Automated payments',        color: 'bg-amber-100 text-amber-600' },
];

export function AuthLayout() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user) {
    return <Navigate to={ROLE_DASHBOARD_PATHS[user.role]} replace />;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* ── Left brand panel ─────────────────────────────────── */}
      <aside className="hidden lg:flex lg:w-[46%] h-screen p-5">
        <div className="relative flex-1 flex flex-col rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-8 xl:p-10 overflow-hidden">
          {/* Subtle decorative orbs */}
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5" />
          <div className="absolute -left-8 bottom-16 h-32 w-32 rounded-full bg-white/5" />
          <div className="absolute right-8 bottom-8 h-20 w-20 rounded-full bg-violet-500/30" />

          <div className="relative flex flex-col h-full gap-6">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 w-fit group">
              <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">Takshashila</span>
            </Link>

            {/* Hero */}
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white/90 uppercase tracking-wider">
                <Star className="h-3 w-3 fill-white/80" />
                Enterprise Learning Platform
              </span>
              <h1 className="text-3xl xl:text-4xl font-bold leading-[1.1] text-white tracking-tight">
                The smarter way<br />to learn and teach
              </h1>
              <p className="text-white/75 text-sm leading-relaxed max-w-md">
                Takshashila connects students with expert tutors, empowers principals with full oversight, and automates everything in between.
              </p>
            </div>

            {/* Feature grid */}
            <ul className="grid grid-cols-2 gap-2.5">
              {HIGHLIGHTS.map((h) => {
                const Icon = h.icon;
                return (
                  <li key={h.text} className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${h.color} bg-opacity-90`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[12px] font-semibold text-white/90 leading-tight">{h.text}</span>
                  </li>
                );
              })}
            </ul>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { value: '2K+',  label: 'Students' },
                { value: '500+', label: 'Tutors' },
                { value: '50k+', label: 'Classes' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-white/10 p-3 text-center backdrop-blur-sm">
                  <p className="text-xl font-bold text-white leading-none">{s.value}</p>
                  <p className="text-[11px] font-medium text-white/60 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm p-4 mt-auto">
              <p className="text-[13px] text-white/80 leading-relaxed line-clamp-3">
                &ldquo;Takshashila helped me manage 60+ tutors effortlessly. Analytics and scheduling are exactly what an institution needs.&rdquo;
              </p>
              <div className="mt-3 flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-violet-400/40 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">AR</div>
                <div>
                  <p className="text-[12px] font-semibold text-white/90 leading-none">Dr. Anita Rao</p>
                  <p className="text-[11px] text-white/50 mt-0.5">Principal, Greenfield Academy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Right form panel ─────────────────────────────────── */}
      <main className="flex-1 h-screen overflow-y-auto bg-white dark:bg-slate-900">
        {/* Mobile logo */}
        <Link to="/" className="lg:hidden flex items-center gap-2.5 p-5 hover:opacity-80 transition-opacity">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="text-base font-bold text-slate-900 dark:text-white">Takshashila</span>
        </Link>

        <div className="flex min-h-full items-center justify-center px-6 py-8 lg:py-10">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
