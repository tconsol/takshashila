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
    { label: 'Analytics',   href: '/dashboard/principal/analytics', icon: BarChart3 },
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
    { label: 'Overview',        href: '/dashboard/student',                  icon: LayoutDashboard },
    { label: 'My Tutor',        href: '/dashboard/student/my-tutor',         icon: GraduationCap },
    { label: 'My Organization', href: '/dashboard/student/my-organization',  icon: Building2 },
    { label: 'Find Tutors',     href: '/dashboard/student/tutors',           icon: Search },
    { label: 'Classes',         href: '/dashboard/student/classes',          icon: Video,          badgeKey: 'scheduleAlert' },
    { label: 'Assignments',     href: '/dashboard/student/assignments',      icon: BookOpen },
    { label: 'Worksheets',      href: '/dashboard/student/worksheets',       icon: FileText,       badgeKey: 'worksheets' },
    { label: 'Games',           href: '/dashboard/student/games',            icon: Gamepad2 },
    { label: 'Resources',       href: '/dashboard/student/resources',        icon: FolderOpen },
    { label: 'Attendance',      href: '/dashboard/student/attendance',       icon: UserCheck },
    { label: 'Progress',        href: '/dashboard/student/progress',         icon: BarChart3 },
    { label: 'Messages',        href: '/chat',                               icon: MessageSquare,  badgeKey: 'messages' },
    { label: 'Wallet',          href: '/dashboard/student/wallet',           icon: Wallet },
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
  const { dismissed, dismiss } = useDismissedBadgesStore();
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
    if (active?.badgeKey) dismiss(active.badgeKey);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (dismissed[badgeKey]) return 0;
    return badges[badgeKey] ?? 0;
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
          collapsed ? 'w-[68px]' : 'w-64',
          isOpen ? 'translate-x-0 shadow-sidebar' : '-translate-x-full',
        )}
      >
        {/* Brand header */}
        <div
          className={cn(
            'flex h-14 items-center shrink-0 bg-gradient-to-r from-indigo-600 to-violet-600',
            collapsed ? 'justify-center px-0' : 'justify-between px-4',
          )}
        >
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-bold text-white tracking-tight">Takshashila</span>
            </Link>
          )}
          {collapsed && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
          )}

          {/* Collapse toggle — desktop only */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center h-7 w-7 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = isOnPage(item.href);
              const badgeCount = getBadgeCount(item.badgeKey, item.href);
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    onClick={() => { onClose(); clearSearch(); }}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center rounded-xl transition-all duration-150',
                      collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                      'text-sm',
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-900/30 dark:text-indigo-300'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                    )}
                  >
                    <div className="relative shrink-0">
                      <Icon className={cn('h-4 w-4', isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500')} />
                      {badgeCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                        </span>
                      )}
                    </div>

                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {badgeCount > 0 && !isActive && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                        {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-indigo-400" />}
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800 p-2.5 shrink-0">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={cn(
              'flex w-full items-center rounded-xl text-sm font-medium text-slate-500 transition-all',
              'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400',
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>
    </>
  );
}
