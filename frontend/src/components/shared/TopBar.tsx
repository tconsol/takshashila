import { Moon, Sun, Menu } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { useThemeStore } from '../../stores/theme.store';
import { getInitials } from '../../lib/utils';
import { ROLE_LABELS } from '../../constants/roles';
import { NotificationBell } from '../../features/notifications/NotificationBell';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useAuthStore();
  const { theme, setTheme, resolvedTheme } = useThemeStore();

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900 lg:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <NotificationBell />

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-semibold text-white">
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
