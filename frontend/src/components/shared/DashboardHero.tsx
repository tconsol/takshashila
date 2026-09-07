import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { Role } from '../../types';

interface DashboardHeroProps {
  role: Role;
  eyebrow: string;
  title: string;
  description?: string;
  icon: ReactNode;
  /** Buttons / links rendered on the right (desktop) or below (mobile). */
  actions?: ReactNode;
  className?: string;
}

// One gradient identity per role — mirrors the avatar colors in TopBar so a
// user's role reads consistently everywhere (avatar chip, sidebar, dashboard hero).
const ROLE_GRADIENT: Record<Role, string> = {
  SUPER_ADMIN: 'from-violet-600 via-purple-600 to-fuchsia-600',
  ADMIN:       'from-indigo-600 via-blue-600 to-sky-600',
  PRINCIPAL:   'from-teal-600 via-emerald-600 to-green-600',
  TUTOR:       'from-orange-600 via-amber-500 to-yellow-500',
  STUDENT:     'from-brand-500 via-violet-500 to-indigo-500',
  PARENT:      'from-sky-600 via-cyan-600 to-teal-500',
  SUPPORT:     'from-slate-700 via-slate-600 to-zinc-600',
};

// Matching shadow tint so the banner's glow reads as the same hue, not a
// generic gray drop shadow.
const ROLE_SHADOW: Record<Role, string> = {
  SUPER_ADMIN: 'shadow-purple-500/25',
  ADMIN:       'shadow-blue-500/25',
  PRINCIPAL:   'shadow-emerald-500/25',
  TUTOR:       'shadow-amber-500/25',
  STUDENT:     'shadow-brand-500/25',
  PARENT:      'shadow-cyan-500/25',
  SUPPORT:     'shadow-slate-500/20',
};

export function DashboardHero({ role, eyebrow, title, description, icon, actions, className }: DashboardHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={cn(
        'relative overflow-hidden rounded-3xl bg-gradient-to-br px-6 py-6 shadow-lg sm:px-8 sm:py-7',
        ROLE_GRADIENT[role],
        ROLE_SHADOW[role],
        className,
      )}
    >
      {/* Atmosphere: soft light orbs + a faint dot grid, kept behind the content */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-black/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
      </div>

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm sm:h-14 sm:w-14">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">{eyebrow}</p>
            <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-white sm:text-[26px]">{title}</h1>
            {description && (
              <p className="mt-1.5 max-w-xl text-sm text-white/80">{description}</p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
        )}
      </div>
    </motion.div>
  );
}
