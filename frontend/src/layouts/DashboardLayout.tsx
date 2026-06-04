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
    <div className="relative flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
