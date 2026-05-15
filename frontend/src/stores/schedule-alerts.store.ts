import { create } from 'zustand';

interface ScheduleAlertsState {
  count: number;
  increment: () => void;
  clear: () => void;
}

export const useScheduleAlertsStore = create<ScheduleAlertsState>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  clear: () => set({ count: 0 }),
}));
