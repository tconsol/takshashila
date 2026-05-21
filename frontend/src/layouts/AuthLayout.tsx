import { Outlet, Navigate, Link } from 'react-router-dom';
import { GraduationCap, CheckCircle2, Users, Video, BarChart3, Star } from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { ROLE_DASHBOARD_PATHS } from '../constants/roles';

const HIGHLIGHTS = [
  { icon: Video,        text: 'Live HD classes',          tint: 'bg-clay-mint' },
  { icon: Users,        text: 'Connect tutors & students', tint: 'bg-clay-sky' },
  { icon: BarChart3,    text: 'Progress tracking',         tint: 'bg-clay-purple' },
  { icon: CheckCircle2, text: 'Automated payments',        tint: 'bg-clay-yellow' },
];

export function AuthLayout() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user) {
    return <Navigate to={ROLE_DASHBOARD_PATHS[user.role]} replace />;
  }

  return (
    <div className="flex h-screen bg-clay-bg dark:bg-gray-950 overflow-hidden">
      {/* ── Left brand panel — fixed 100vh, no scroll ─────────── */}
      <aside className="hidden lg:flex lg:w-[48%] h-screen p-6">
        <div className="relative flex-1 flex flex-col rounded-[36px] border-2.5 border-clay-ink bg-clay-green p-8 xl:p-10 shadow-clay-lg overflow-hidden">
          {/* Decorative clay shapes */}
          <div className="absolute -right-8 -top-8 h-28 w-28 rotate-12 rounded-3xl border-2.5 border-clay-ink bg-clay-yellow" />
          <div className="absolute -left-5 top-1/2 h-16 w-16 rounded-full border-2.5 border-clay-ink bg-clay-coral" />
          <div className="absolute -right-5 -bottom-8 h-24 w-24 -rotate-6 rounded-3xl border-2.5 border-clay-ink bg-clay-sky" />

          {/* Content — column flex, gap-based vertical fit */}
          <div className="relative flex flex-col h-full gap-5">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 w-fit group">
              <div className="h-11 w-11 rounded-2xl border-2.5 border-clay-ink bg-white flex items-center justify-center group-hover:rotate-3 transition-transform">
                <GraduationCap className="h-5 w-5 text-clay-ink" />
              </div>
              <span className="text-xl font-extrabold text-white">Takshashila</span>
            </Link>

            {/* Hero */}
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border-2.5 border-clay-ink bg-clay-yellow px-3 py-1 text-[10px] font-extrabold text-clay-ink uppercase tracking-wider">
                <Star className="h-3 w-3 fill-clay-ink" />
                Enterprise Learning
              </span>
              <h1 className="text-3xl xl:text-4xl font-extrabold leading-[1.05] text-white tracking-tight">
                The smarter way<br />to learn and teach
              </h1>
              <p className="text-white/90 text-sm font-semibold leading-relaxed max-w-md">
                Takshashila connects students with expert tutors, empowers principals with full oversight, and automates everything in between.
              </p>
            </div>

            {/* Features */}
            <ul className="grid grid-cols-2 gap-2">
              {HIGHLIGHTS.map((h) => {
                const Icon = h.icon;
                return (
                  <li key={h.text} className="flex items-center gap-2 rounded-xl border-2 border-clay-ink bg-white px-2.5 py-2">
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border-2 border-clay-ink ${h.tint}`}>
                      <Icon className="h-3.5 w-3.5 text-clay-ink" />
                    </div>
                    <span className="text-[11px] font-extrabold text-clay-ink leading-tight">{h.text}</span>
                  </li>
                );
              })}
            </ul>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: '2K+',  label: 'Students', tint: 'bg-clay-mint' },
                { value: '500+', label: 'Tutors',   tint: 'bg-clay-coral' },
                { value: '50k+', label: 'Classes',  tint: 'bg-clay-yellow' },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border-2.5 border-clay-ink ${s.tint} p-2.5 text-center`}>
                  <p className="text-lg font-black text-clay-ink leading-none">{s.value}</p>
                  <p className="text-[10px] font-bold text-clay-ink/70 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Testimonial — fills remaining */}
            <div className="rounded-2xl border-2.5 border-clay-ink bg-white p-4 mt-auto">
              <p className="text-xs font-semibold text-clay-ink leading-relaxed line-clamp-3">
                &ldquo;Takshashila helped me manage 60+ tutors effortlessly. Analytics and scheduling are exactly what an institution needs.&rdquo;
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-8 w-8 rounded-full border-2 border-clay-ink bg-clay-purple flex items-center justify-center text-[11px] font-extrabold text-clay-ink flex-shrink-0">AR</div>
                <div>
                  <p className="text-[11px] font-extrabold text-clay-ink leading-none">Dr. Anita Rao</p>
                  <p className="text-[10px] font-semibold text-clay-ink/60 mt-0.5">Principal, Greenfield Academy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Right form panel — scrollable ─────────────────────── */}
      <main className="flex-1 h-screen overflow-y-auto bg-clay-bg dark:bg-gray-950">
        {/* Mobile logo */}
        <Link to="/" className="lg:hidden flex items-center gap-2 p-6 hover:opacity-80 transition-opacity">
          <div className="h-10 w-10 rounded-2xl border-2.5 border-clay-ink bg-clay-coral flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-clay-ink" />
          </div>
          <span className="text-lg font-extrabold text-clay-ink dark:text-white">Takshashila</span>
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
