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
    <div className="relative flex h-screen overflow-hidden bg-clay-bg dark:from-gray-950 dark:via-gray-950 dark:to-brand-950/40">
      {/* Decorative clay shapes */}
      <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute -top-12 right-1/4 h-32 w-32 rounded-3xl border-2.5 border-clay-ink bg-clay-coral/30 rotate-12" />
        <div className="absolute bottom-12 left-1/4 h-24 w-24 rounded-full border-2.5 border-clay-ink bg-clay-mint/30" />
        <div className="absolute top-1/2 right-12 h-20 w-20 rounded-2xl border-2.5 border-clay-ink bg-clay-yellow/30 -rotate-6" />
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
