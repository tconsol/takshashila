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
    // `themed-surfaces` retargets legacy literal colours (bg-white, bg-gray-50,
    // and friends) onto the theme tokens in dark mode — see globals.css. Scoped
    // to the dashboard so the deliberately-light landing page and games keep
    // their own palette.
    <div className="grain themed-surfaces relative flex h-screen overflow-hidden bg-paper">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      <div className="relative z-[1] flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex flex-1 flex-col overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
