import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, Calendar, Wallet, Settings,
  BarChart3, Shield, Headphones, GraduationCap, LogOut, ChevronRight,
  UserCheck, Video, MessageSquare, Search, UserCircle, Heart, FileText, Building2,
  Sparkles, FolderOpen, PanelLeftClose, PanelLeftOpen, Gamepad2,
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
    { label: 'Overview', href: '/dashboard/super-admin', icon: LayoutDashboard },
    { label: 'Admins', href: '/dashboard/super-admin/admins', icon: Shield },
    { label: 'Analytics', href: '/dashboard/super-admin/analytics', icon: BarChart3 },
    { label: 'Audit Logs', href: '/dashboard/super-admin/audit', icon: BookOpen },
    { label: 'Settings', href: '/dashboard/super-admin/settings', icon: Settings },
    { label: 'Messages', href: '/chat', icon: MessageSquare, badgeKey: 'messages' },
    { label: 'Profile', href: '/profile', icon: UserCircle },
  ],
  ADMIN: [
    { label: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard },
    { label: 'Principals', href: '/dashboard/admin/principals', icon: Users, badgeKey: 'principals' },
    { label: 'Tutors', href: '/dashboard/admin/tutors', icon: GraduationCap, badgeKey: 'tutors' },
    { label: 'Analytics', href: '/dashboard/admin/analytics', icon: BarChart3 },
    { label: 'Support', href: '/dashboard/admin/support', icon: Headphones, badgeKey: 'support' },
    { label: 'Messages', href: '/chat', icon: MessageSquare, badgeKey: 'messages' },
    { label: 'Profile', href: '/profile', icon: UserCircle },
  ],
  PRINCIPAL: [
    { label: 'Overview', href: '/dashboard/principal', icon: LayoutDashboard, badgeKey: 'scheduleAlert' },
    { label: 'Tutors', href: '/dashboard/principal/tutors', icon: GraduationCap, badgeKey: 'tutors' },
    { label: 'Students', href: '/dashboard/principal/students', icon: Users, badgeKey: 'students' },
    { label: 'Classes', href: '/dashboard/principal/classes', icon: Video },
    { label: 'Analytics', href: '/dashboard/principal/analytics', icon: BarChart3 },
    { label: 'Messages', href: '/chat', icon: MessageSquare, badgeKey: 'messages' },
    { label: 'Wallet', href: '/dashboard/principal/wallet', icon: Wallet },
    { label: 'Profile', href: '/profile', icon: UserCircle },
  ],
  TUTOR: [
    { label: 'Overview', href: '/dashboard/tutor', icon: LayoutDashboard },
    { label: 'Demo Requests', href: '/dashboard/tutor/demo-requests', icon: Sparkles, badgeKey: 'demoRequests' },
    { label: 'Students', href: '/dashboard/tutor/students', icon: Users },
    { label: 'Classes', href: '/dashboard/tutor/classes', icon: Video },
    { label: 'Schedule', href: '/dashboard/tutor/schedule', icon: Calendar },
    { label: 'Assignments', href: '/dashboard/tutor/assignments', icon: BookOpen },
    { label: 'Worksheets', href: '/dashboard/tutor/worksheets', icon: FileText, badgeKey: 'worksheets' },
    { label: 'Resources', href: '/dashboard/tutor/resources', icon: FolderOpen },
    { label: 'Attendance', href: '/dashboard/tutor/attendance', icon: UserCheck },
    { label: 'Progress', href: '/dashboard/tutor/progress', icon: BarChart3 },
    { label: 'Find Principal', href: '/dashboard/tutor/principals', icon: Building2, badgeKey: 'principals' },
    { label: 'Messages', href: '/chat', icon: MessageSquare, badgeKey: 'messages' },
    { label: 'Wallet', href: '/dashboard/tutor/wallet', icon: Wallet },
    { label: 'Profile', href: '/profile', icon: UserCircle },
  ],
  STUDENT: [
    { label: 'Overview', href: '/dashboard/student', icon: LayoutDashboard },
    { label: 'My Tutor', href: '/dashboard/student/my-tutor', icon: GraduationCap },
    { label: 'My Organization', href: '/dashboard/student/my-organization', icon: Building2 },
    { label: 'Find Tutors', href: '/dashboard/student/tutors', icon: Search },
    { label: 'Classes', href: '/dashboard/student/classes', icon: Video, badgeKey: 'scheduleAlert' },
    { label: 'Assignments', href: '/dashboard/student/assignments', icon: BookOpen },
    { label: 'Worksheets', href: '/dashboard/student/worksheets', icon: FileText, badgeKey: 'worksheets' },
    { label: 'Games', href: '/dashboard/student/games', icon: Gamepad2 },
    { label: 'Resources', href: '/dashboard/student/resources', icon: FolderOpen },
    { label: 'Attendance', href: '/dashboard/student/attendance', icon: UserCheck },
    { label: 'Progress', href: '/dashboard/student/progress', icon: BarChart3 },
    { label: 'Messages', href: '/chat', icon: MessageSquare, badgeKey: 'messages' },
    { label: 'Wallet', href: '/dashboard/student/wallet', icon: Wallet },
    { label: 'Profile', href: '/profile', icon: UserCircle },
  ],
  PARENT: [
    { label: 'Overview', href: '/dashboard/parent', icon: LayoutDashboard },
    { label: 'My Children', href: '/dashboard/parent/children', icon: Heart },
    { label: 'Find Tutors', href: '/dashboard/parent/tutors', icon: GraduationCap },
    { label: 'Find Principals', href: '/dashboard/parent/principals', icon: Building2 },
    { label: 'Classes', href: '/dashboard/parent/classes', icon: Video },
    { label: 'Attendance', href: '/dashboard/parent/attendance', icon: UserCheck },
    { label: 'Assignments', href: '/dashboard/parent/assignments', icon: BookOpen },
    { label: 'Worksheets', href: '/dashboard/parent/worksheets', icon: FileText },
    { label: 'Progress', href: '/dashboard/parent/progress', icon: BarChart3 },
    { label: 'Messages', href: '/chat', icon: MessageSquare, badgeKey: 'messages' },
    { label: 'Profile', href: '/profile', icon: UserCircle },
  ],
  SUPPORT: [
    { label: 'Overview', href: '/dashboard/support', icon: LayoutDashboard },
    { label: 'Tickets', href: '/dashboard/support/tickets', icon: Headphones, badgeKey: 'tickets' },
    { label: 'Accounts', href: '/dashboard/support/accounts', icon: UserCheck },
    { label: 'Messages', href: '/chat', icon: MessageSquare, badgeKey: 'messages' },
    { label: 'Profile', href: '/profile', icon: UserCircle },
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
  const { data: demoRequestData } = useDemoRequestsAsTutor(
    { status: 'PENDING', limit: '1' },
    isTutor,
  );
  const demoRequestCount = isTutor ? (demoRequestData?.total ?? 0) : 0;
  const { query: searchQuery, clear: clearSearch } = useSidebarSearchStore();
  const searchLower = searchQuery.toLowerCase().trim();

  const allItems = NAV_ITEMS[user?.role ?? 'STUDENT'] ?? [];
  const items = searchLower
    ? allItems.filter((item) => item.label.toLowerCase().includes(searchLower))
    : allItems;

  useEffect(() => {
    const active = allItems.find(
      (item) =>
        item.badgeKey &&
        item.badgeKey !== 'scheduleAlert' &&
        item.badgeKey !== 'demoRequests' &&
        (location.pathname === item.href || location.pathname.startsWith(item.href + '/')),
    );
    if (active?.badgeKey) {
      dismiss(active.badgeKey);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const isOnPage = (href: string): boolean => {
    if (location.pathname === href) return true;
    // Only use prefix match if no sibling nav item lives under this path
    // (prevents /dashboard/student matching /dashboard/student/tutors etc.)
    const hasChildItem = allItems.some(
      (item) => item.href !== href && item.href.startsWith(href + '/'),
    );
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
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-clay-surface border-r-2.5 border-clay-ink transition-all duration-300',
          'lg:static lg:translate-x-0',
          collapsed ? 'w-16' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex h-16 items-center border-b-2.5 border-clay-ink shrink-0',
          collapsed ? 'justify-center px-0' : 'justify-between px-4',
        )}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-clay-ink bg-clay-coral shrink-0">
                <GraduationCap className="h-4 w-4 text-clay-ink" />
              </div>
              <span className="text-lg font-extrabold text-clay-ink truncate">Takshashila</span>
            </div>
          )}
          {/* Collapse toggle — desktop only */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center h-8 w-8 rounded-xl border-2 border-clay-ink bg-clay-yellow text-clay-ink hover:translate-x-[1px] hover:translate-y-[1px] transition-all shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
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
                      'flex items-center rounded-xl transition-all',
                      collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                      'text-sm font-extrabold',
                      isActive
                        ? 'bg-clay-green text-white border-2 border-clay-ink shadow-clay-sm'
                        : 'text-clay-ink/70 hover:bg-clay-bg hover:text-clay-ink dark:text-gray-400 dark:hover:bg-gray-800',
                    )}
                  >
                    <div className="relative shrink-0">
                      <Icon className="h-4 w-4" />
                      {badgeCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 border border-clay-ink" />
                        </span>
                      )}
                    </div>

                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {badgeCount > 0 && !isActive && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-clay-ink bg-rose-500 px-1.5 text-[10px] font-extrabold text-white">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                        {isActive && <ChevronRight className="ml-auto h-4 w-4 shrink-0" />}
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t-2.5 border-clay-ink p-2 shrink-0">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={cn(
              'flex w-full items-center rounded-xl text-sm font-extrabold text-clay-ink transition-all hover:bg-clay-coral border-2 border-transparent hover:border-clay-ink',
              collapsed ? 'justify-center py-2.5 px-0' : 'gap-3 px-3 py-2.5',
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
