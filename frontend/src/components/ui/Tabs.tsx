import type { ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
  indicator?: boolean; // pulsing green dot
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-1.5 p-1.5 bg-white border-2.5 border-clay-ink rounded-2xl w-fit shadow-clay-sm ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
            activeTab === tab.key
              ? 'bg-clay-green text-white border-2 border-clay-ink'
              : 'text-clay-ink/60 hover:text-clay-ink hover:bg-clay-bg'
          }`}
        >
          {tab.icon}
          {tab.label}
          {tab.indicator && (
            <span className="relative flex h-2 w-2 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-clay-green-dark opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-clay-green-dark border border-clay-ink" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
