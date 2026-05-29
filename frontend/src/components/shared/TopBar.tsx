import { useRef } from 'react';
import { Menu, Search, X, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { useThemeStore } from '../../stores/theme.store';
import { useSidebarSearchStore } from '../../stores/sidebar-search.store';
import { getInitials, cn } from '../../lib/utils';
import { ROLE_LABELS } from '../../constants/roles';
import { NotificationBell } from '../../features/notifications/NotificationBell';

const AVATAR_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'from-violet-500 to-purple-600',
  ADMIN:       'from-indigo-500 to-blue-600',
  PRINCIPAL:   'from-teal-500 to-emerald-600',
  TUTOR:       'from-orange-500 to-amber-500',
  STUDENT:     'from-pink-500 to-rose-500',
  PARENT:      'from-sky-500 to-cyan-500',
  SUPPORT:     'from-slate-500 to-gray-600',
};

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useAuthStore();
  const { resolvedTheme, setTheme } = useThemeStore();
  const { query, setQuery, clear } = useSidebarSearchStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  const avatarGradient = user ? (AVATAR_COLORS[user.role] ?? AVATAR_COLORS.ADMIN) : AVATAR_COLORS.ADMIN;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-5 gap-3 dark:bg-slate-900 dark:border-slate-800">
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors lg:hidden shrink-0"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && clear()}
            placeholder="Search pages…"
            className={cn(
              'w-full rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700',
              'placeholder:text-slate-400 pl-9 pr-8 py-2',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white',
              'transition-all duration-150',
              'dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200',
            )}
          />
          {query && (
            <button
              onClick={() => { clear(); inputRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-4 w-4" />}
        </button>

        <NotificationBell />

        <div className="ml-1 flex items-center gap-2.5">
          <div
            className={cn(
              'h-8 w-8 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-bold text-white shrink-0 ring-2 ring-white shadow-sm',
              avatarGradient,
            )}
          >
            {user ? getInitials(user.firstName, user.lastName) : '?'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-none">
              {user ? `${user.firstName} ${user.lastName}` : ''}
            </p>
            <p className="mt-0.5 text-xs text-slate-400 leading-none">
              {user ? ROLE_LABELS[user.role] : ''}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
