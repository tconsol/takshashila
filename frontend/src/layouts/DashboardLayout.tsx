import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/shared/Sidebar';
import { TopBar } from '../components/shared/TopBar';
import { useDataInvalidation } from '../hooks/use-data-invalidation';
import { useTimezoneSync } from '../hooks/use-timezone-sync';
import { useScheduleAlerts } from '../hooks/use-schedule-alerts';
import { useSessionExpiry } from '../hooks/use-session-expiry';

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useDataInvalidation();
  useTimezoneSync();
  useScheduleAlerts();
  useSessionExpiry();

  return (
    <div className="relative flex h-screen overflow-hidden bg-gradient-to-br from-brand-50/30 via-white to-violet-50/20 dark:from-gray-950 dark:via-gray-950 dark:to-brand-950/40">
      <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute -top-32 -left-20 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-brand-300/20 via-violet-300/15 to-pink-300/10 blur-3xl dark:from-brand-900/30 dark:via-violet-900/20 dark:to-pink-900/10" />
        <div className="absolute top-1/3 -right-32 h-[480px] w-[480px] rounded-full bg-gradient-to-br from-sky-300/15 via-cyan-200/10 to-brand-300/10 blur-3xl dark:from-sky-900/20 dark:to-brand-900/15" />
      </div>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
