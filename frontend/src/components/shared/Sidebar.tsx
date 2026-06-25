import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, Calendar, Wallet, Settings,
  BarChart3, Shield, Headphones, GraduationCap, LogOut,
  UserCheck, Video, MessageSquare, Search, UserCircle, Heart, FileText, Building2,
  Sparkles, FolderOpen, PanelLeftClose, PanelLeftOpen, Gamepad2, ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
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
  badgeKey?: string;
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { label: 'Overview',    href: '/dashboard/super-admin',          icon: LayoutDashboard },
    { label: 'Admins',      href: '/dashboard/super-admin/admins',   icon: Shield },
    { label: 'Analytics',   href: '/dashboard/super-admin/analytics',icon: BarChart3 },
    { label: 'Audit Logs',  href: '/dashboard/super-admin/audit',    icon: BookOpen },
    { label: 'Settings',    href: '/dashboard/super-admin/settings', icon: Settings },
    { label: 'Messages',    href: '/chat',                            icon: MessageSquare, badgeKey: 'messages' },
    { label: 'Profile',     href: '/profile',                        icon: UserCircle },
  ],
  ADMIN: [
    { label: 'Overview',    href: '/dashboard/admin',             icon: LayoutDashboard },
    { label: 'Principals',  href: '/dashboard/admin/principals',  icon: Users,          badgeKey: 'principals' },
    { label: 'Tutors',      href: '/dashboard/admin/tutors',      icon: GraduationCap,  badgeKey: 'tutors' },
    { label: 'Analytics',   href: '/dashboard/admin/analytics',   icon: BarChart3 },
    { label: 'Support',     href: '/dashboard/admin/support',     icon: Headphones,     badgeKey: 'support' },
    { label: 'Messages',    href: '/chat',                        icon: MessageSquare,  badgeKey: 'messages' },
    { label: 'Profile',     href: '/profile',                     icon: UserCircle },
  ],
  PRINCIPAL: [
    { label: 'Overview',    href: '/dashboard/principal',           icon: LayoutDashboard, badgeKey: 'scheduleAlert' },
    { label: 'Tutors',      href: '/dashboard/principal/tutors',    icon: GraduationCap,   badgeKey: 'tutors' },
    { label: 'Students',    href: '/dashboard/principal/students',  icon: Users,           badgeKey: 'students' },
    { label: 'Classes',     href: '/dashboard/principal/classes',   icon: Video },
    { label: 'Content',     href: '/dashboard/principal/content',   icon: FileText },
    { label: 'Analytics',   href: '/dashboard/principal/analytics', icon: BarChart3 },
    // ── Teaching (principal also teaches) ──
    { label: 'My Schedule',    href: '/dashboard/principal/teach/schedule',    icon: Calendar },
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
    { label: 'Students',       href: '/dashboard/tutor/students',         icon: Users },
    { label: 'Classes',        href: '/dashboard/tutor/classes',          icon: Video },
    { label: 'Schedule',       href: '/dashboard/tutor/schedule',         icon: Calendar },
    { label: 'Assignments',    href: '/dashboard/tutor/assignments',      icon: BookOpen },
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
    { label: 'Classes',         href: '/dashboard/student/classes',          icon: Video,          badgeKey: 'scheduleAlert' },
    { label: 'Homework',        href: '/dashboard/student/worksheets',       icon: FileText,       badgeKey: 'worksheets' },
    { label: 'Games',           href: '/dashboard/student/games',            icon: Gamepad2 },
    { label: 'Resources',       href: '/dashboard/student/resources',        icon: FolderOpen },
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
        item.badgeKey !== 'scheduleAlert' &&
        item.badgeKey !== 'demoRequests' &&
        (location.pathname === item.href || location.pathname.startsWith(item.href + '/')),
    );
    // Mark the current server count as seen so the dot clears for this page.
    if (active?.badgeKey) markSeen(active.badgeKey, badges[active.badgeKey] ?? 0);
  }, [location.pathname, badges]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const isOnPage = (href: string): boolean => {
    if (location.pathname === href) return true;
    const hasChildItem = allItems.some((item) => item.href !== href && item.href.startsWith(href + '/'));
    if (hasChildItem) return false;
    return location.pathname.startsWith(href + '/');
  };

  const getBadgeCount = (badgeKey: string | undefined, href: string): number => {
    if (!badgeKey) return 0;
    if (isOnPage(href)) {
      if (badgeKey === 'scheduleAlert' && scheduleAlertCount > 0) setTimeout(clearScheduleAlerts, 0);
      return 0;
    }
    if (badgeKey === 'scheduleAlert') return scheduleAlertCount;
    if (badgeKey === 'demoRequests') return demoRequestCount;
    // Show the dot only when the server count exceeds what the user last saw.
    const count = badges[badgeKey] ?? 0;
    return count > (seen[badgeKey] ?? 0) ? count : 0;
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
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-white border-r border-slate-200 transition-all duration-300',
          'dark:bg-slate-900 dark:border-slate-800',
          'lg:static lg:translate-x-0',
          collapsed ? 'w-[64px]' : 'w-64',
          isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
        )}
      >
        {/* Brand header */}
        <div className={cn(
          'flex h-14 shrink-0 items-center bg-gradient-to-r from-indigo-600 to-violet-600',
          collapsed ? 'justify-center' : 'justify-between px-4',
        )}>
          {collapsed ? (
            <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 hover:bg-white/30 transition-colors">
              <GraduationCap className="h-5 w-5 text-white" />
            </Link>
          ) : (
            <>
              <Link to="/" className="flex flex-1 items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <GraduationCap className="h-4 w-4 text-white" />
                </div>
                <span className="truncate text-sm font-bold text-white tracking-tight">Brainbase Edu</span>
              </Link>
              <button
                onClick={onToggleCollapse}
                className="hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
          {/* Expand toggle collapsed only, top of nav */}
          {collapsed && (
            <div className="flex justify-center px-2 pb-1">
              <button
                onClick={onToggleCollapse}
                title="Expand sidebar"
                className="hidden lg:flex h-8 w-10 items-center justify-center rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 transition-colors"
              >
                <PanelLeftOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </button>
            </div>
          )}
          <ul className={cn('space-y-1', collapsed ? 'px-2' : 'px-2.5')}>
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = isOnPage(item.href);
              const badgeCount = getBadgeCount(item.badgeKey, item.href);
              return (
                <li key={item.href}>
                  {collapsed ? (
                    /* ── COLLAPSED: icon pill, always-visible bg ── */
                    <Link
                      to={item.href}
                      onClick={() => { onClose(); clearSearch(); }}
                      title={item.label}
                      className="flex justify-center"
                    >
                      <div className={cn(
                        'relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150',
                        isActive
                          ? 'bg-indigo-600 shadow-sm shadow-indigo-500/30'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700',
                      )}>
                        <Icon
                          className={cn('h-[18px] w-[18px]', isActive ? 'text-white' : 'text-slate-600 dark:text-slate-300')}
                        />
                        {badgeCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                          </span>
                        )}
                      </div>
                    </Link>
                  ) : (
                    /* ── EXPANDED: icon + label ── */
                    <Link
                      to={item.href}
                      onClick={() => { onClose(); clearSearch(); }}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-900/30 dark:text-indigo-300'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                      )}
                    >
                      <div className="relative shrink-0">
                        <Icon className={cn('h-4 w-4', isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400')} />
                        {badgeCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                          </span>
                        )}
                      </div>
                      <span className="truncate">{item.label}</span>
                      {badgeCount > 0 && !isActive && (
                        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                      {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-indigo-400" />}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer / logout */}
        <div className={cn('shrink-0 border-t border-slate-100 py-2 dark:border-slate-800', collapsed ? 'px-2' : 'px-2.5')}>
          {collapsed ? (
            <button
              onClick={handleLogout}
              title="Sign out"
              className="flex w-full justify-center"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-900/30 transition-colors">
                <LogOut className="h-[18px] w-[18px] text-slate-600 hover:text-rose-600 dark:text-slate-300" />
              </div>
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-900/20 dark:hover:text-rose-400"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
