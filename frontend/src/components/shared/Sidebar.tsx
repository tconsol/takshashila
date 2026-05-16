import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, Calendar, Wallet, Settings,
  BarChart3, Shield, Headphones, GraduationCap, LogOut, ChevronRight,
  UserCheck, Video, MessageSquare, Search, UserCircle, Heart, FileText, Building2,
  Sparkles, FolderOpen,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import { useSidebarBadges } from '../../hooks/use-sidebar-badges';
import { useScheduleAlertsStore } from '../../stores/schedule-alerts.store';
import { useDemoRequestsAsTutor } from '../../hooks/use-demo-requests';
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
    { label: 'Find Tutors', href: '/dashboard/student/tutors', icon: Search },
    { label: 'Classes', href: '/dashboard/student/classes', icon: Video, badgeKey: 'scheduleAlert' },
    { label: 'Assignments', href: '/dashboard/student/assignments', icon: BookOpen },
    { label: 'Worksheets', href: '/dashboard/student/worksheets', icon: FileText, badgeKey: 'worksheets' },
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
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();
  const badges = useSidebarBadges();
  const scheduleAlertCount = useScheduleAlertsStore((s) => s.count);
  const clearScheduleAlerts = useScheduleAlertsStore((s) => s.clear);
  const isTutor = user?.role === 'TUTOR';
  const { data: demoRequestData } = useDemoRequestsAsTutor(
    { status: 'PENDING', limit: '1' },
    isTutor,
  );
  const demoRequestCount = isTutor ? (demoRequestData?.total ?? 0) : 0;

  if (!user) return null;

  const items = NAV_ITEMS[user.role] ?? [];

  const isOnPage = (href: string): boolean =>
    href === '/chat' ? location.pathname.startsWith('/chat') : location.pathname === href;

  const getBadgeCount = (badgeKey: string | undefined, href: string): number => {
    if (!badgeKey) return 0;
    if (isOnPage(href)) {
      if (badgeKey === 'scheduleAlert' && scheduleAlertCount > 0) setTimeout(clearScheduleAlerts, 0);
      return 0;
    }
    if (badgeKey === 'scheduleAlert') return scheduleAlertCount;
    if (badgeKey === 'demoRequests') return demoRequestCount;
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
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-white border-r border-gray-200 transition-transform duration-300 dark:bg-gray-900 dark:border-gray-700',
          'lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center border-b border-gray-200 px-6 dark:border-gray-700">
          <span className="text-xl font-bold text-brand-600">Takshashila</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              const badgeCount = getBadgeCount(item.badgeKey, item.href);

              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white',
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <Icon className="h-4 w-4" />
                      {badgeCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                      )}
                    </div>
                    {item.label}
                    {badgeCount > 0 && !isActive && (
                      <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                    {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-gray-200 p-3 dark:border-gray-700">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
