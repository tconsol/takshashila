import { create } from 'zustand';

interface SidebarSearchStore {
  query: string;
  setQuery: (q: string) => void;
  clear: () => void;
}

export const useSidebarSearchStore = create<SidebarSearchStore>((set) => ({
  query: '',
  setQuery: (q) => set({ query: q }),
  clear: () => set({ query: '' }),
}));
