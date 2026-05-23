import { useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { ArrowLeft, Pause, Play, RotateCcw, X, Keyboard, Volume2, VolumeX } from 'lucide-react';
import { useGameStore } from '../../stores/game.store';
import { gameSounds } from '../../lib/game-sounds';

interface GameShellProps {
  title: string;
  emoji: string;
  color: string;
  onBack: () => void;
  children: ReactNode;
}

export function GameShell({ title, emoji, color, onBack, children }: GameShellProps) {
  const paused = useGameStore((s) => s.paused);
  const setPaused = useGameStore((s) => s.setPaused);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const shakeTick = useGameStore((s) => s.shakeTick);
  const flashTick = useGameStore((s) => s.flashTick);
  const flashColor = useGameStore((s) => s.flashColor);
  const [gameKey, setGameKey] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const shakeControls = useAnimationControls();
  const [flashVisible, setFlashVisible] = useState(false);

  useEffect(() => () => setPaused(false), [setPaused]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPaused(!paused);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paused, setPaused]);

  // Shake animation on triggerShake()
  useEffect(() => {
    if (shakeTick === 0) return;
    shakeControls.start({
      x: [0, -14, 14, -10, 10, -6, 6, 0],
      transition: { duration: 0.5, ease: 'easeInOut' },
    });
  }, [shakeTick, shakeControls]);

  // Flash overlay on triggerFlash()
  useEffect(() => {
    if (flashTick === 0) return;
    setFlashVisible(true);
    const t = setTimeout(() => setFlashVisible(false), 300);
    return () => clearTimeout(t);
  }, [flashTick]);

  const handleBack = () => { gameSounds.click(); setPaused(false); onBack(); };
  const handleRestart = () => { gameSounds.click(); setPaused(false); setGameKey((k) => k + 1); };
  const handleResume = () => { gameSounds.click(); setPaused(false); };
  const handlePauseClick = () => { gameSounds.click(); setPaused(true); };
  const handleMuteClick = () => { gameSounds.click(); toggleSound(); };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-gradient-to-br from-gray-950 via-indigo-950 to-purple-950"
    >
      <AnimatedBackground />

      {/* Top HUD */}
      <div className="relative z-20 flex items-center justify-between gap-2 px-3 sm:px-5 py-3 bg-black/30 backdrop-blur-md border-b border-white/10 shrink-0">
        <motion.button
          onClick={handleBack}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-3 sm:px-4 py-2 text-white text-sm font-bold transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Quit</span>
        </motion.button>

        <div className={`flex items-center gap-2 rounded-2xl bg-gradient-to-r ${color} px-3 sm:px-5 py-1.5 sm:py-2 shadow-lg shadow-black/30`}>
          <motion.span
            animate={{ rotate: [0, -8, 8, -4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-xl sm:text-2xl"
          >
            {emoji}
          </motion.span>
          <span className="text-white font-extrabold text-sm sm:text-base whitespace-nowrap">{title}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <motion.button
            onClick={handleMuteClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 p-2 text-white transition-colors"
            title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-red-300" />}
          </motion.button>
          <motion.button
            onClick={() => setShowHelp(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="hidden sm:flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 p-2 text-white transition-colors"
            title="Keyboard shortcuts"
          >
            <Keyboard className="h-4 w-4" />
          </motion.button>
          <motion.button
            onClick={handlePauseClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-3 sm:px-4 py-2 text-white text-sm font-bold transition-colors"
          >
            <Pause className="h-4 w-4" />
            <span className="hidden sm:inline">Pause</span>
          </motion.button>
        </div>
      </div>

      {/* Game content (with screen-shake wrapper) */}
      <motion.div
        animate={shakeControls}
        className="relative z-10 flex-1 overflow-auto flex items-start sm:items-center justify-center p-4 sm:p-6"
      >
        <div key={gameKey} className="w-full">
          {children}
        </div>
      </motion.div>

      {/* Flash overlay for correct/wrong */}
      <AnimatePresence>
        {flashVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`pointer-events-none absolute inset-0 z-30 ${
              flashColor === 'green' ? 'bg-green-400' : 'bg-red-500'
            }`}
          />
        )}
      </AnimatePresence>

      {/* Pause overlay */}
      <AnimatePresence>
        {paused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-black/85 backdrop-blur-lg"
          >
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              className="text-center"
            >
              <div className="text-8xl mb-2">⏸️</div>
              <h2 className="text-5xl sm:text-6xl font-black text-white tracking-wider">PAUSED</h2>
              <p className="text-white/50 mt-2 text-sm">Take a deep breath 🌬️</p>
            </motion.div>

            <div className="flex flex-wrap justify-center gap-3">
              <motion.button
                onClick={handleResume}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-3 text-white font-bold shadow-lg shadow-green-500/30"
              >
                <Play className="h-5 w-5 fill-white" /> Resume
              </motion.button>
              <motion.button
                onClick={handleRestart}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-3 text-white font-bold shadow-lg shadow-orange-500/30"
              >
                <RotateCcw className="h-5 w-5" /> Restart
              </motion.button>
              <motion.button
                onClick={handleBack}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 to-pink-600 px-6 py-3 text-white font-bold shadow-lg shadow-red-500/30"
              >
                <X className="h-5 w-5" /> Quit
              </motion.button>
            </div>
            <p className="text-white/40 text-xs">Press ESC or P to resume</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help overlay */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHelp(false)}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-3xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/20 p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Keyboard className="h-5 w-5" /> Shortcuts
                </h3>
                <button onClick={() => setShowHelp(false)} className="text-white/60 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { key: 'ESC / P', desc: 'Pause / Resume' },
                  { key: '1, 2, 3, 4', desc: 'Pick answer choice' },
                  { key: 'T / F', desc: 'True / False (where applicable)' },
                  { key: 'Enter', desc: 'Confirm / Continue' },
                ].map((s) => (
                  <div key={s.key} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <kbd className="rounded-md bg-white/10 border border-white/20 px-2 py-0.5 text-white font-mono text-xs">
                      {s.key}
                    </kbd>
                    <span className="text-white/80">{s.desc}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}

const STARS = Array.from({ length: 25 }, (_, i) => ({
  left: `${(i * 23.7) % 100}%`,
  top: `${(i * 37.3) % 100}%`,
  delay: `${(i * 0.32) % 3}s`,
  duration: `${2 + (i % 3)}s`,
  size: i % 3 === 0 ? '2px' : '1px',
}));

function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Static gradient orbs — no JS animation, CSS only */}
      <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-purple-600/25 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-indigo-600/30 blur-3xl" />
      <div className="absolute top-1/3 left-1/2 w-72 h-72 rounded-full bg-pink-500/15 blur-3xl" />

      {/* Twinkling stars — CSS animation, no Framer Motion */}
      {STARS.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white animate-pulse"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}
    </div>
  );
}
