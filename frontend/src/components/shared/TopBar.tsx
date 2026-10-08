import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Search, X, Sun, Moon, ChevronDown, Headphones, UserCircle, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { useThemeStore } from '../../stores/theme.store';
import { useSidebarSearchStore } from '../../stores/sidebar-search.store';
import { getInitials, cn } from '../../lib/utils';
import { ROLE_LABELS } from '../../constants/roles';
import { ConfirmDialog } from './ConfirmDialog';
import { NotificationBell } from '../../features/notifications/NotificationBell';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user, clearAuth } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Admin and support staff have their own support pages in the sidebar.
  const showHelp = !!user && !['ADMIN', 'SUPPORT'].includes(user.role);
  const { resolvedTheme, setTheme } = useThemeStore();
  const { query, setQuery, clear } = useSidebarSearchStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const { api } = await import('../../lib/axios');
      await api.post('/auth/logout');
    } finally {
      clearAuth();
      localStorage.removeItem('refreshToken');
    }
  };

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-rule bg-surface px-4 lg:px-6">
      <button
        onClick={onMenuClick}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink lg:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search — an underline field, not a pill, to match the form language */}
      <div className="max-w-xs flex-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && clear()}
            placeholder="Search pages…"
            className={cn(
              'w-full border-0 border-b border-rule bg-transparent py-1.5 pl-6 pr-6 text-sm text-ink',
              'placeholder:text-ink-faint',
              'focus:border-b-2 focus:border-accent focus:pb-[5px] focus:outline-none',
              'transition-colors duration-150',
            )}
          />
          {query && (
            <button
              onClick={() => { clear(); inputRef.current?.focus(); }}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-2"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-4 w-4" />}
        </button>

        <NotificationBell />

        <div ref={menuRef} className="relative ml-2 border-l border-rule pl-3">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-surface-hover"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-ink font-display text-xs font-semibold text-paper">
              {user ? getInitials(user.firstName, user.lastName) : '?'}
            </div>
            <div className="hidden leading-none sm:block">
              <p className="text-[13px] font-semibold text-ink">
                {user ? `${user.firstName} ${user.lastName}` : ''}
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">
                {user ? ROLE_LABELS[user.role] : ''}
              </p>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 text-ink-faint transition-transform', menuOpen && 'rotate-180')} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-52 rounded border border-rule-strong bg-surface py-1 shadow-pop"
            >
              {showHelp && (
                <Link
                  to="/support"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink"
                >
                  <Headphones className="h-4 w-4" /> Help &amp; Support
                </Link>
              )}
              <Link
                to="/profile"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <UserCircle className="h-4 w-4" /> Profile
              </Link>
              <div className="my-1 border-t border-rule" />
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-danger-wash hover:text-danger"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Sign out?"
        message="You will need to sign in again to access your account."
        confirmLabel="Sign out"
        tone="primary"
        loading={loggingOut}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleLogout}
      />
    </header>
  );
}
