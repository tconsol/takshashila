import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, Calendar, Wallet, Settings,
  BarChart3, Shield, Headphones, GraduationCap, LogOut,
  UserCheck, Video, MessageSquare, Search, UserCircle, Heart, FileText, Building2,
  Sparkles, FolderOpen, PanelLeftClose, PanelLeftOpen, Gamepad2, ChevronRight, Server, Megaphone, ShieldAlert,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import brandLogo from '../../assets/brainbaseedulogo.png';
import { useAuthStore } from '../../stores/auth.store';
import { useSidebarBadges } from '../../hooks/use-sidebar-badges';
import { useScheduleAlertsStore } from '../../stores/schedule-alerts.store';
import { useDismissedBadgesStore } from '../../stores/dismissed-badges.store';
import { useDemoRequestsAsTutor } from '../../hooks/use-demo-requests';
import { useSidebarSearchStore } from '../../stores/sidebar-search.store';
import type { Role } from '../../types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** One or more badge counters. An item with several (Classes carries both the
   *  live "starting now" alert and the count of newly booked sessions) shows
   *  their sum. */
  badgeKey?: string | string[];
}

/** These two are client-side signals, not server counts — they clear on their
 *  own terms and must not be written into the seen-count store. */
const LOCAL_BADGE_KEYS = new Set(['scheduleAlert', 'demoRequests']);

const asKeys = (badgeKey: NavItem['badgeKey']): string[] =>
  !badgeKey ? [] : Array.isArray(badgeKey) ? badgeKey : [badgeKey];

const NAV_ITEMS: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { label: 'Overview',    href: '/dashboard/super-admin',          icon: LayoutDashboard },
    { label: 'Admins',      href: '/dashboard/super-admin/admins',   icon: Shield },
    { label: 'Users',       href: '/dashboard/super-admin/users',    icon: Users },
    { label: 'Principals',  href: '/dashboard/super-admin/principals', icon: Building2 },
    { label: 'Tutors',      href: '/dashboard/super-admin/tutors',   icon: GraduationCap },
    { label: 'Students',    href: '/dashboard/super-admin/students', icon: UserCheck },
    { label: 'Classes',     href: '/dashboard/super-admin/classes',  icon: Video },
    { label: 'Analytics',   href: '/dashboard/super-admin/analytics',icon: BarChart3 },
    { label: 'Announcements', href: '/dashboard/super-admin/broadcast', icon: Megaphone },
    { label: 'Oversight',   href: '/dashboard/super-admin/oversight', icon: ShieldAlert },
    { label: 'Finance',     href: '/dashboard/super-admin/finance',  icon: Wallet },
    { label: 'Audit Logs',  href: '/dashboard/super-admin/audit',    icon: BookOpen },
    { label: 'System',      href: '/dashboard/super-admin/system',   icon: Server },
    { label: 'Settings',    href: '/dashboard/super-admin/settings', icon: Settings },
    { label: 'Messages',    href: '/chat',                            icon: MessageSquare, badgeKey: 'messages' },
    { label: 'Profile',     href: '/profile',                        icon: UserCircle },
  ],
  ADMIN: [
    { label: 'Overview',    href: '/dashboard/admin',             icon: LayoutDashboard },
    { label: 'Users',       href: '/dashboard/admin/users',       icon: Users },
    { label: 'Principals',  href: '/dashboard/admin/principals',  icon: Building2,      badgeKey: 'principals' },
    { label: 'Tutors',      href: '/dashboard/admin/tutors',      icon: GraduationCap,  badgeKey: 'tutors' },
    { label: 'Students',    href: '/dashboard/admin/students',    icon: UserCheck },
    { label: 'Classes',     href: '/dashboard/admin/classes',     icon: Video },
    { label: 'Analytics',   href: '/dashboard/admin/analytics',   icon: BarChart3 },
    { label: 'Announcements', href: '/dashboard/admin/broadcast', icon: Megaphone },
    { label: 'Oversight',   href: '/dashboard/admin/oversight',   icon: ShieldAlert },
    { label: 'Finance',     href: '/dashboard/admin/finance',     icon: Wallet },
    { label: 'Audit Logs',  href: '/dashboard/admin/audit',       icon: BookOpen },
    { label: 'System',      href: '/dashboard/admin/system',      icon: Server },
    { label: 'Support',     href: '/dashboard/admin/support',     icon: Headphones,     badgeKey: 'support' },
    { label: 'Messages',    href: '/chat',                        icon: MessageSquare,  badgeKey: 'messages' },
    { label: 'Profile',     href: '/profile',                     icon: UserCircle },
  ],
  PRINCIPAL: [
    { label: 'Overview',    href: '/dashboard/principal',           icon: LayoutDashboard, badgeKey: 'scheduleAlert' },
    { label: 'Tutors',      href: '/dashboard/principal/tutors',    icon: GraduationCap,   badgeKey: 'tutors' },
    { label: 'Students',    href: '/dashboard/principal/students',  icon: Users,           badgeKey: 'students' },
    { label: 'Classes',     href: '/dashboard/principal/classes',   icon: Video,           badgeKey: 'classes' },
    { label: 'Content',     href: '/dashboard/principal/content',   icon: FileText },
    { label: 'Analytics',   href: '/dashboard/principal/analytics', icon: BarChart3 },
    // ── Teaching (principal also teaches) ──
    { label: 'My Calendar',    href: '/dashboard/principal/teach/schedule',    icon: Calendar },
    { label: 'Teach Classes',  href: '/dashboard/principal/teach/classes',     icon: Video },
    { label: 'My Worksheets',  href: '/dashboard/principal/teach/worksheets',  icon: FileText },
    { label: 'My Assignments', href: '/dashboard/principal/teach/assignments', icon: BookOpen },
    { label: 'My Attendance',  href: '/dashboard/principal/teach/attendance',  icon: UserCheck },
    { label: 'Messages',    href: '/chat',                          icon: MessageSquare,   badgeKey: 'messages' },
    { label: 'Wallet',      href: '/dashboard/principal/wallet',    icon: Wallet },
    { label: 'Profile',     href: '/profile',                       icon: UserCircle },
  ],
  TUTOR: [
    { label: 'Overview',       href: '/dashboard/tutor',                  icon: LayoutDashboard },
    { label: 'Demo Requests',  href: '/dashboard/tutor/demo-requests',    icon: Sparkles,     badgeKey: 'demoRequests' },
    { label: 'Students',       href: '/dashboard/tutor/students',         icon: Users,        badgeKey: 'students' },
    { label: 'Classes',        href: '/dashboard/tutor/classes',          icon: Video,        badgeKey: 'classes' },
    { label: 'Calendar',       href: '/dashboard/tutor/schedule',         icon: Calendar },
    { label: 'Assignments',    href: '/dashboard/tutor/assignments',      icon: BookOpen,     badgeKey: 'assignments' },
    { label: 'Worksheets',     href: '/dashboard/tutor/worksheets',       icon: FileText,     badgeKey: 'worksheets' },
    { label: 'Resources',      href: '/dashboard/tutor/resources',        icon: FolderOpen },
    { label: 'Attendance',     href: '/dashboard/tutor/attendance',       icon: UserCheck },
    { label: 'Progress',       href: '/dashboard/tutor/progress',         icon: BarChart3 },
    { label: 'Find Principal', href: '/dashboard/tutor/principals',       icon: Building2,    badgeKey: 'principals' },
    { label: 'Messages',       href: '/chat',                             icon: MessageSquare, badgeKey: 'messages' },
    { label: 'Wallet',         href: '/dashboard/tutor/wallet',           icon: Wallet },
    { label: 'Profile',        href: '/profile',                          icon: UserCircle },
  ],
  STUDENT: [
    { label: 'Home',            href: '/dashboard/student',                  icon: LayoutDashboard },
    { label: 'Tutors',          href: '/dashboard/student/my-tutor',         icon: GraduationCap },
    { label: 'My Organization', href: '/dashboard/student/my-organization',  icon: Building2 },
    { label: 'Classes',         href: '/dashboard/student/classes',          icon: Video,          badgeKey: ['scheduleAlert', 'classes'] },
    { label: 'Homework',        href: '/dashboard/student/worksheets',       icon: FileText,       badgeKey: 'worksheets' },
    { label: 'Games',           href: '/dashboard/student/games',            icon: Gamepad2 },
    { label: 'Resources',       href: '/dashboard/student/resources',        icon: FolderOpen,     badgeKey: 'resources' },
    { label: 'Messages',        href: '/chat',                               icon: MessageSquare,  badgeKey: 'messages' },
    { label: 'Profile',         href: '/profile',                            icon: UserCircle },
  ],
  PARENT: [
    { label: 'Overview',        href: '/dashboard/parent',               icon: LayoutDashboard },
    { label: 'My Children',     href: '/dashboard/parent/children',      icon: Heart },
    { label: 'Find Tutors',     href: '/dashboard/parent/tutors',        icon: GraduationCap },
    { label: 'Find Principals', href: '/dashboard/parent/principals',    icon: Building2 },
    { label: 'Classes',         href: '/dashboard/parent/classes',       icon: Video },
    { label: 'Attendance',      href: '/dashboard/parent/attendance',    icon: UserCheck },
    { label: 'Assignments',     href: '/dashboard/parent/assignments',   icon: BookOpen },
    { label: 'Worksheets',      href: '/dashboard/parent/worksheets',    icon: FileText },
    { label: 'Progress',        href: '/dashboard/parent/progress',      icon: BarChart3 },
    { label: 'Messages',        href: '/chat',                           icon: MessageSquare, badgeKey: 'messages' },
    { label: 'Profile',         href: '/profile',                        icon: UserCircle },
  ],
  SUPPORT: [
    { label: 'Overview',  href: '/dashboard/support',          icon: LayoutDashboard },
    { label: 'Tickets',   href: '/dashboard/support/tickets',  icon: Headphones, badgeKey: 'tickets' },
    { label: 'Accounts',  href: '/dashboard/support/accounts', icon: UserCheck },
    { label: 'Messages',  href: '/chat',                       icon: MessageSquare, badgeKey: 'messages' },
    { label: 'Profile',   href: '/profile',                    icon: UserCircle },
  ],
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();
  const badges = useSidebarBadges();
  const { seen, markSeen } = useDismissedBadgesStore();
  const scheduleAlertCount = useScheduleAlertsStore((s) => s.count);
  const clearScheduleAlerts = useScheduleAlertsStore((s) => s.clear);
  const isTutor = user?.role === 'TUTOR';
  const { data: demoRequestData } = useDemoRequestsAsTutor({ status: 'PENDING', limit: '1' }, isTutor);
  const demoRequestCount = isTutor ? (demoRequestData?.total ?? 0) : 0;
  const { query: searchQuery, clear: clearSearch } = useSidebarSearchStore();
  const searchLower = searchQuery.toLowerCase().trim();

  const allItems = NAV_ITEMS[user?.role ?? 'STUDENT'] ?? [];
  const items = searchLower ? allItems.filter((item) => item.label.toLowerCase().includes(searchLower)) : allItems;

  useEffect(() => {
    const active = allItems.find(
      (item) =>
        item.badgeKey &&
        (location.pathname === item.href || location.pathname.startsWith(item.href + '/')),
    );
    // Mark the current server count as seen so the dot clears for this page.
    asKeys(active?.badgeKey)
      .filter((key) => !LOCAL_BADGE_KEYS.has(key))
      .forEach((key) => markSeen(key, badges[key] ?? 0));
  }, [location.pathname, badges]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const isOnPage = (href: string): boolean => {
    if (location.pathname === href) return true;
    const hasChildItem = allItems.some((item) => item.href !== href && item.href.startsWith(href + '/'));
    if (hasChildItem) return false;
    return location.pathname.startsWith(href + '/');
  };

  const getBadgeCount = (badgeKey: NavItem['badgeKey'], href: string): number => {
    const keys = asKeys(badgeKey);
    if (keys.length === 0) return 0;
    if (isOnPage(href)) {
      if (keys.includes('scheduleAlert') && scheduleAlertCount > 0) setTimeout(clearScheduleAlerts, 0);
      return 0;
    }
    return keys.reduce((total, key) => {
      if (key === 'scheduleAlert') return total + scheduleAlertCount;
      if (key === 'demoRequests') return total + demoRequestCount;
      // Show the dot only when the server count exceeds what the user last saw.
      const count = badges[key] ?? 0;
      return total + (count > (seen[key] ?? 0) ? count : 0);
    }, 0);
  };

  const handleLogout = async () => {
    try {
      const { api } = await import('../../lib/axios');
      await api.post('/auth/logout');
    } finally {
      clearAuth();
      localStorage.removeItem('refreshToken');
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-rule bg-surface transition-all duration-200 ease-editorial',
          'lg:static lg:translate-x-0',
          collapsed ? 'w-[60px]' : 'w-60',
          isOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full',
        )}
      >
        {/* Masthead — flat ink, no gradient. The logo sits in a plain chip. */}
        <div className={cn(
          'flex h-14 shrink-0 items-center border-b border-rule',
          collapsed ? 'justify-center' : 'justify-between px-3.5',
        )}>
          {collapsed ? (
            <Link to="/" className="flex h-9 w-9 items-center justify-center rounded border border-rule bg-surface-sunk p-1 transition-colors hover:bg-surface-hover">
              <img src={brandLogo} alt="Brainbase Edu" className="h-full w-full object-contain" />
            </Link>
          ) : (
            <>
              <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5">
                <img src={brandLogo} alt="" className="h-7 w-7 shrink-0 rounded border border-rule bg-surface-sunk object-contain p-0.5" />
                <span className="truncate font-display text-[15px] font-semibold text-ink">Brainbase</span>
              </Link>
              <button
                onClick={onToggleCollapse}
                className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink lg:flex"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: 'none' }}>
          {collapsed && (
            <div className="flex justify-center px-2 pb-2">
              <button
                onClick={onToggleCollapse}
                title="Expand sidebar"
                className="hidden h-7 w-9 items-center justify-center rounded border border-rule text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink lg:flex"
              >
                <PanelLeftOpen className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <ul className={cn('space-y-0.5', collapsed ? 'px-2' : 'px-2')}>
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = isOnPage(item.href);
              const badgeCount = getBadgeCount(item.badgeKey, item.href);
              return (
                <li key={item.href}>
                  {collapsed ? (
                    /* ── COLLAPSED: icon only, active marked by a left tick ── */
                    <Link
                      to={item.href}
                      onClick={() => { onClose(); clearSearch(); }}
                      title={item.label}
                      className="flex justify-center"
                    >
                      <div className={cn(
                        'relative flex h-9 w-9 items-center justify-center rounded transition-colors duration-150',
                        isActive
                          ? 'bg-accent-wash text-accent'
                          : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                      )}>
                        <Icon className="h-[18px] w-[18px]" />
                        {badgeCount > 0 && (
                          <span className="absolute right-0.5 top-0.5 flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
                          </span>
                        )}
                      </div>
                    </Link>
                  ) : (
                    /* ── EXPANDED: icon + label, active gets a left rule not a fill ── */
                    <Link
                      to={item.href}
                      onClick={() => { onClose(); clearSearch(); }}
                      className={cn(
                        'relative flex items-center gap-2.5 rounded px-2.5 py-[7px] pl-3.5 text-sm transition-colors duration-150',
                        isActive
                          ? 'bg-accent-wash font-semibold text-accent'
                          : 'font-medium text-ink-2 hover:bg-surface-hover hover:text-ink',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute -left-2 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent transition-opacity duration-150',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <Icon className="h-[15px] w-[15px] shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="relative ml-auto flex shrink-0">
                          <span className="absolute inset-0 animate-ping rounded-full bg-danger opacity-60" />
                          <span className="relative flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 font-mono-ui text-[10px] font-semibold text-white">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        </span>
                      )}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer / logout */}
        <div className={cn('shrink-0 border-t border-rule py-2.5', collapsed ? 'px-2' : 'px-2')}>
          {collapsed ? (
            <button onClick={handleLogout} title="Sign out" className="flex w-full justify-center">
              <div className="flex h-9 w-9 items-center justify-center rounded text-ink-muted transition-colors hover:bg-danger-wash hover:text-danger">
                <LogOut className="h-[18px] w-[18px]" />
              </div>
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded px-3 py-[7px] text-sm font-medium text-ink-muted transition-colors hover:bg-danger-wash hover:text-danger"
            >
              <LogOut className="h-[15px] w-[15px] shrink-0" />
              Sign out
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
