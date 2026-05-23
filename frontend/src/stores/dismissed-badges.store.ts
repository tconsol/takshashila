import { create } from 'zustand';

interface DismissedBadgesStore {
  dismissed: Record<string, boolean>;
  dismiss: (key: string) => void;
  restore: (key: string) => void;
}

export const useDismissedBadgesStore = create<DismissedBadgesStore>((set) => ({
  dismissed: {},
  dismiss: (key) => set((s) => ({ dismissed: { ...s.dismissed, [key]: true } })),
  restore: (key) =>
    set((s) => {
      const { [key]: _, ...rest } = s.dismissed;
      return { dismissed: rest };
    }),
}));
