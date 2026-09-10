import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
  indicator?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (key: string) => void;
  className?: string;
}

/**
 * A pill switcher: a bordered track holding one accent-filled pill for the
 * active tab. This is the motif used everywhere a view is switched — status
 * filters, page sections, settings groups.
 */
export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div className={cn('flex w-fit gap-1 rounded border border-rule bg-surface-sunk p-1', className)}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              'relative flex items-center gap-1.5 rounded px-4 py-2 text-sm font-medium transition-colors duration-150',
              active ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink-2',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.indicator && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
