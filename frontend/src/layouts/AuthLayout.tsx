import { Outlet, Navigate, Link } from 'react-router-dom';
import { GraduationCap, CheckCircle2, Users, Video, BarChart3, Star } from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { ROLE_DASHBOARD_PATHS } from '../constants/roles';

const HIGHLIGHTS = [
  { icon: Video,        text: 'Live & recorded classes with HD video', tint: 'bg-clay-mint' },
  { icon: Users,        text: 'Connect students, tutors & principals', tint: 'bg-clay-sky' },
  { icon: BarChart3,    text: 'Deep analytics & progress tracking',    tint: 'bg-clay-purple' },
  { icon: CheckCircle2, text: 'Automated payments & wallet system',    tint: 'bg-clay-yellow' },
];

export function AuthLayout() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user) {
    return <Navigate to={ROLE_DASHBOARD_PATHS[user.role]} replace />;
  }

  return (
    <div className="flex min-h-screen bg-clay-bg">
      {/* ── Left brand panel ──────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col overflow-hidden p-8">
        <div className="relative flex-1 overflow-y-auto rounded-[36px] border-2.5 border-clay-ink bg-clay-green p-12 shadow-clay-lg">
          {/* Decorative clay shapes */}
          <div className="absolute -right-10 -top-10 h-32 w-32 rotate-12 rounded-3xl border-2.5 border-clay-ink bg-clay-yellow" />
          <div className="absolute -left-6 top-1/2 h-20 w-20 rounded-full border-2.5 border-clay-ink bg-clay-coral" />
          <div className="absolute -right-6 -bottom-10 h-28 w-28 -rotate-6 rounded-3xl border-2.5 border-clay-ink bg-clay-sky" />
          <div className="absolute left-12 -bottom-4 h-16 w-16 rotate-12 rounded-2xl border-2.5 border-clay-ink bg-clay-pink" />

          {/* Content */}
          <div className="relative flex flex-col gap-8">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 w-fit group">
              <div className="h-12 w-12 rounded-2xl border-2.5 border-clay-ink bg-white flex items-center justify-center group-hover:rotate-3 transition-transform">
                <GraduationCap className="h-6 w-6 text-clay-ink" />
              </div>
              <span className="text-2xl font-extrabold text-white">Takshashila</span>
            </Link>

            {/* Hero */}
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border-2.5 border-clay-ink bg-clay-yellow px-4 py-1.5 text-xs font-extrabold text-clay-ink uppercase tracking-wider">
                <Star className="h-3 w-3 fill-clay-ink" />
                Enterprise Learning Platform
              </span>
              <h1 className="text-5xl font-extrabold leading-[1.05] text-white tracking-tight">
                The smarter way<br />to learn and teach
              </h1>
              <p className="text-white/90 text-base font-semibold leading-relaxed max-w-md">
                Takshashila connects students with expert tutors, empowers principals with full oversight, and automates everything in between.
              </p>
            </div>

            {/* Features */}
            <ul className="space-y-3">
              {HIGHLIGHTS.map((h) => {
                const Icon = h.icon;
                return (
                  <li key={h.text} className="flex items-center gap-3 rounded-2xl border-2 border-clay-ink bg-white px-3 py-2.5">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 border-clay-ink ${h.tint}`}>
                      <Icon className="h-4 w-4 text-clay-ink" />
                    </div>
                    <span className="text-sm font-extrabold text-clay-ink">{h.text}</span>
                  </li>
                );
              })}
            </ul>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: '2,000+', label: 'Students', tint: 'bg-clay-mint' },
                { value: '500+',   label: 'Tutors',   tint: 'bg-clay-coral' },
                { value: '50k+',   label: 'Classes',  tint: 'bg-clay-yellow' },
              ].map((s) => (
                <div key={s.label} className={`rounded-2xl border-2.5 border-clay-ink ${s.tint} p-4 text-center`}>
                  <p className="text-2xl font-black text-clay-ink">{s.value}</p>
                  <p className="text-xs font-bold text-clay-ink/70 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className="rounded-2xl border-2.5 border-clay-ink bg-white p-5">
              <p className="text-sm font-semibold text-clay-ink leading-relaxed">
                &ldquo;Takshashila helped me manage 60+ tutors effortlessly. The analytics and scheduling tools are exactly what an institution needs.&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full border-2 border-clay-ink bg-clay-purple flex items-center justify-center text-sm font-extrabold text-clay-ink flex-shrink-0">AR</div>
                <div>
                  <p className="text-xs font-extrabold text-clay-ink">Dr. Anita Rao</p>
                  <p className="text-[11px] font-semibold text-clay-ink/60 mt-0.5">Principal, Greenfield Academy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-clay-bg dark:bg-gray-950">
        {/* Mobile logo */}
        <Link to="/" className="lg:hidden flex items-center gap-2 p-6 hover:opacity-80 transition-opacity">
          <div className="h-10 w-10 rounded-2xl border-2.5 border-clay-ink bg-clay-coral flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-clay-ink" />
          </div>
          <span className="text-lg font-extrabold text-clay-ink dark:text-white">Takshashila</span>
        </Link>

        <div className="flex-1 flex items-center justify-center px-6 py-8 lg:py-10">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
