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
    <div className={`flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === tab.key
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {tab.icon}
          {tab.label}
          {tab.indicator && (
            <span className="relative flex h-2 w-2 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
