import { create } from 'zustand';

/**
 * Count-driven badge model.
 * A dot shows when the server's unread count for a key is GREATER than the
 * count the user has already seen. Visiting the page marks the current count
 * as seen, clearing the dot. New data pushes the server count back above
 * "seen", so the dot reappears — no socket event required.
 *
 * Intentionally NOT persisted: persisting "seen" globally leaked across users
 * (a prior session's seen counts suppressed dots for the next login). In-memory
 * means each load starts fresh → pending data always surfaces a dot, and the
 * dot clears the moment you open that page. `reset()` is also called on logout.
 */
interface SeenBadgesStore {
  seen: Record<string, number>;
  markSeen: (key: string, count: number) => void;
  reset: () => void;
}

export const useDismissedBadgesStore = create<SeenBadgesStore>()((set) => ({
  seen: {},
  markSeen: (key, count) =>
    set((s) => (s.seen[key] === count ? s : { seen: { ...s.seen, [key]: count } })),
  reset: () => set({ seen: {} }),
}));
