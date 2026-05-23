import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useGameStore } from '../../stores/game.store';
import { Confetti } from '../../components/games/Confetti';
import { gameSounds } from '../../lib/game-sounds';

const SIZE = 16;

function buildGrid(): number[] {
  return [...Array(SIZE)].map((_, i) => i + 1).sort(() => Math.random() - 0.5);
}

export function NumberOrderGame() {
  const paused = useGameStore((s) => s.paused);
  const triggerShake = useGameStore((s) => s.triggerShake);
  const triggerFlash = useGameStore((s) => s.triggerFlash);
  const [grid, setGrid] = useState<number[]>(buildGrid);
  const [next, setNext] = useState(1);
  const [clicked, setClicked] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [confettiKey, setConfettiKey] = useState(0);

  // Pause time tracking — freeze elapsed when paused, resume from same point
  useEffect(() => {
    if (paused) {
      setPausedAt(Date.now());
    } else if (pausedAt !== null) {
      const pauseDuration = Date.now() - pausedAt;
      setStartTime((t) => t + pauseDuration);
      setPausedAt(null);
    }
  }, [paused, pausedAt]);

  useEffect(() => {
    if (done || paused) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 200);
    return () => clearInterval(t);
  }, [done, paused, startTime]);

  const click = useCallback(
    (val: number, idx: number) => {
      if (paused || clicked.has(idx) || done) return;
      if (val === next) {
        gameSounds.pop();
        const newClicked = new Set(clicked).add(idx);
        setClicked(newClicked);
        setNext((n) => n + 1);
        setConfettiKey((k) => k + 1);
        if (newClicked.size === SIZE) {
          setDone(true);
          gameSounds.gameOver();
        }
      } else {
        gameSounds.fail();
        triggerShake();
        triggerFlash('red');
        setWrong(idx);
        setMistakes((m) => m + 1);
        setTimeout(() => setWrong(null), 500);
      }
    },
    [clicked, next, done, paused, triggerFlash, triggerShake],
  );

  const restart = () => {
    setGrid(buildGrid());
    setNext(1);
    setClicked(new Set());
    setWrong(null);
    setDone(false);
    setMistakes(0);
    setElapsed(0);
    setStartTime(Date.now());
  };

  const stars = mistakes === 0 ? 3 : mistakes <= 3 ? 2 : 1;

  if (done)
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="text-8xl mb-2">🎉</div>
          <h2 className="text-4xl font-black text-white">All in order!</h2>
          <div className="flex justify-center gap-2 my-4">
            {[1, 2, 3].map((s) => (
              <motion.span
                key={s}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: s * 0.18, type: 'spring' }}
                className={`text-5xl ${s <= stars ? '' : 'opacity-30'}`}
              >
                ⭐
              </motion.span>
            ))}
          </div>
          <p className="text-blue-300 font-bold">{elapsed}s · {mistakes} mistake{mistakes !== 1 ? 's' : ''}</p>
        </motion.div>
        <motion.button
          onClick={restart}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-8 py-3 font-bold text-gray-900 shadow-lg shadow-orange-500/30"
        >
          <RotateCcw className="h-5 w-5" /> Play Again
        </motion.button>
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-5 relative">
      <AnimatePresence>
        <Confetti key={confettiKey} count={14} />
      </AnimatePresence>

      <div className="flex items-center gap-3 text-sm font-bold text-white">
        <span className="rounded-xl bg-white/10 border border-white/10 px-3 py-1.5">⏱ {elapsed}s</span>
        <motion.span
          key={next}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 px-4 py-1.5 text-emerald-300 text-base"
          style={{ boxShadow: '0 0 16px rgba(52, 211, 153, 0.3)' }}
        >
          Next: {next}
        </motion.span>
        <span className="rounded-xl bg-red-500/20 border border-red-400/40 px-3 py-1.5 text-red-300">
          ✗ {mistakes}
        </span>
      </div>

      <p className="text-white/60 text-sm">Tap numbers 1 → {SIZE} in order!</p>

      <div className="grid grid-cols-4 gap-3 w-full max-w-xs sm:max-w-sm">
        {grid.map((val, idx) => {
          const isClicked = clicked.has(idx);
          const isWrong = wrong === idx;
          return (
            <motion.button
              key={idx}
              onClick={() => click(val, idx)}
              animate={isWrong ? { x: [0, -8, 8, -6, 6, 0] } : {}}
              transition={{ duration: 0.35 }}
              whileTap={!isClicked ? { scale: 0.85 } : {}}
              whileHover={!isClicked ? { scale: 1.05 } : {}}
              disabled={isClicked}
              className={`aspect-square rounded-2xl text-2xl font-black transition-all backdrop-blur-sm
                ${isClicked
                  ? 'bg-emerald-500/30 border-2 border-emerald-400 text-emerald-300 scale-90'
                  : isWrong
                    ? 'bg-red-500/50 border-2 border-red-400 text-white'
                    : 'bg-gradient-to-br from-indigo-600 to-indigo-800 border-2 border-indigo-400/50 text-white hover:from-indigo-500 hover:to-indigo-700 cursor-pointer shadow-lg'}`}
              style={isClicked ? { boxShadow: '0 0 14px rgba(52, 211, 153, 0.5)' } : {}}
            >
              <AnimatePresence mode="wait">
                {isClicked ? (
                  <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-2xl">✓</motion.span>
                ) : (
                  <motion.span key="num">{val}</motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
