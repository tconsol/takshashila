import { Outlet, Navigate } from 'react-router-dom';
import { GraduationCap, CheckCircle2, Users, Video, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { ROLE_DASHBOARD_PATHS } from '../constants/roles';

const HIGHLIGHTS = [
  { icon: Video, text: 'Live & recorded classes with HD video' },
  { icon: Users, text: 'Connect students, tutors & principals' },
  { icon: BarChart3, text: 'Deep analytics & progress tracking' },
  { icon: CheckCircle2, text: 'Automated payments & wallet system' },
];

export function AuthLayout() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user) {
    return <Navigate to={ROLE_DASHBOARD_PATHS[user.role]} replace />;
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left brand panel ──────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[58%] relative bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 flex-col overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.04%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

        {/* Scrollable content wrapper */}
        <div className="relative flex flex-col flex-1 overflow-y-auto px-12 py-10 gap-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Takshashila</span>
          </div>

          {/* Hero text */}
          <div className="space-y-4">
            <span className="inline-block rounded-full bg-blue-400/10 px-4 py-1.5 text-xs font-semibold text-blue-300 ring-1 ring-blue-400/20 uppercase tracking-wider">
              Enterprise Learning Platform
            </span>
            <h1 className="text-4xl font-bold leading-tight text-white">
              The smarter way<br />to learn and teach
            </h1>
            <p className="text-blue-200 text-base leading-relaxed max-w-md">
              Takshashila connects students with expert tutors, empowers principals with full oversight, and automates everything in between.
            </p>
          </div>

          {/* Feature highlights */}
          <ul className="space-y-3.5">
            {HIGHLIGHTS.map((h) => {
              const Icon = h.icon;
              return (
                <li key={h.text} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4 text-blue-300" />
                  </div>
                  <span className="text-sm text-blue-100">{h.text}</span>
                </li>
              );
            })}
          </ul>

          {/* Stats row */}
          <div className="flex gap-10 border-t border-white/10 pt-6">
            {[
              { value: '2,000+', label: 'Students' },
              { value: '500+', label: 'Tutors' },
              { value: '50k+', label: 'Classes' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-blue-300 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Testimonial quote */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 backdrop-blur-sm">
            <p className="text-sm text-blue-100 leading-relaxed italic">
              &ldquo;Takshashila helped me manage 60+ tutors effortlessly. The analytics and scheduling tools are exactly what an institution needs.&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-brand-400/30 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">A</div>
              <div>
                <p className="text-xs font-semibold text-white">Dr. Anita Rao</p>
                <p className="text-[11px] text-blue-300 mt-0.5">Principal, Greenfield Academy</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-950">
        {/* Mobile logo (shown only on mobile) */}
        <div className="lg:hidden flex items-center gap-2 p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">Takshashila</span>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
