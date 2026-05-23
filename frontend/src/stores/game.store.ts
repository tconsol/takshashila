import { create } from 'zustand';
import { gameSounds } from '../lib/game-sounds';

const SOUND_KEY = 'takshashila_game_sound';

interface GameStore {
  paused: boolean;
  setPaused: (p: boolean) => void;
  togglePause: () => void;

  soundEnabled: boolean;
  toggleSound: () => void;

  shakeTick: number;        // increment to trigger a shake on subscribers
  triggerShake: () => void;

  flashTick: number;        // increment to trigger a screen flash
  flashColor: 'green' | 'red' | null;
  triggerFlash: (color: 'green' | 'red') => void;
}

const initialSound = typeof window !== 'undefined' ? localStorage.getItem(SOUND_KEY) !== '0' : true;
gameSounds.setEnabled(initialSound);

export const useGameStore = create<GameStore>((set) => ({
  paused: false,
  setPaused: (paused) => set({ paused }),
  togglePause: () => set((s) => ({ paused: !s.paused })),

  soundEnabled: initialSound,
  toggleSound: () =>
    set((s) => {
      const next = !s.soundEnabled;
      gameSounds.setEnabled(next);
      try { localStorage.setItem(SOUND_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return { soundEnabled: next };
    }),

  shakeTick: 0,
  triggerShake: () => set((s) => ({ shakeTick: s.shakeTick + 1 })),

  flashTick: 0,
  flashColor: null,
  triggerFlash: (color) => set((s) => ({ flashTick: s.flashTick + 1, flashColor: color })),
}));
