import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Count-driven badge model.
 * A dot shows when the server's unread count for a key is GREATER than the
 * count the user has already seen. Visiting the page marks the current count
 * as seen, clearing the dot. New data pushes the server count back above
 * "seen", so the dot reappears — no socket event required.
 */
interface SeenBadgesStore {
  seen: Record<string, number>;
  markSeen: (key: string, count: number) => void;
}

export const useDismissedBadgesStore = create<SeenBadgesStore>()(
  persist(
    (set) => ({
      seen: {},
      markSeen: (key, count) =>
        set((s) => (s.seen[key] === count ? s : { seen: { ...s.seen, [key]: count } })),
    }),
    { name: 'seen-badges' },
  ),
);
