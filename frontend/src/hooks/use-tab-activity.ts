import { useEffect, useRef, useState } from 'react';

/**
 * Tracks per-tab "activity" for a `<Tabs>` bar. Pass a signal per tab key
 * (usually the item count for that tab, or a joined list of ids) — when a
 * signal changes while its tab isn't the active one, that tab is marked
 * dirty and should show `indicator` on the `<Tabs>` item.
 *
 * Typical case: a class moves from "In Progress" to "Completed" — the
 * Completed tab's count goes up, so it lights up until the user opens it.
 *
 * Usage:
 *   const { dirty, markSeen } = useTabActivity({ inProgress: n1, completed: n2 }, activeTab);
 *   <Tabs
 *     tabs={TABS.map((t) => ({ ...t, indicator: dirty.has(t.key) }))}
 *     activeTab={activeTab}
 *     onChange={(key) => { setActiveTab(key); markSeen(key); }}
 *   />
 */
export function useTabActivity(
  signals: Record<string, string | number | undefined>,
  activeTab: string,
) {
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());
  const prevRef = useRef<Record<string, string | number | undefined> | null>(null);
  const signature = JSON.stringify(signals);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev) {
      const changed: string[] = [];
      for (const key of Object.keys(signals)) {
        if (
          key !== activeTab &&
          prev[key] !== undefined &&
          signals[key] !== undefined &&
          prev[key] !== signals[key]
        ) {
          changed.push(key);
        }
      }
      if (changed.length > 0) {
        setDirty((d) => new Set([...d, ...changed]));
      }
    }
    prevRef.current = signals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const markSeen = (key: string) => {
    setDirty((d) => {
      if (!d.has(key)) return d;
      const next = new Set(d);
      next.delete(key);
      return next;
    });
  };

  return { dirty, markSeen };
}
