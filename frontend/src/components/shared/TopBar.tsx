import { useRef } from 'react';
import { Moon, Sun, Menu, Search, X } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { useThemeStore } from '../../stores/theme.store';
import { useSidebarSearchStore } from '../../stores/sidebar-search.store';
import { getInitials } from '../../lib/utils';
import { ROLE_LABELS } from '../../constants/roles';
import { NotificationBell } from '../../features/notifications/NotificationBell';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useAuthStore();
  const { resolvedTheme, setTheme } = useThemeStore();
  const { query, setQuery, clear } = useSidebarSearchStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900 lg:px-6 gap-3">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden shrink-0"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && clear()}
            placeholder="Search pages…"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 pl-9 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
          />
          {query && (
            <button
              onClick={() => { clear(); inputRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <NotificationBell />

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
            {user ? getInitials(user.firstName, user.lastName) : '?'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {user ? `${user.firstName} ${user.lastName}` : ''}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {user ? ROLE_LABELS[user.role] : ''}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
