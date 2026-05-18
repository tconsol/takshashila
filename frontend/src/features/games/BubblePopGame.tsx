import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useGameStore } from '../../stores/game.store';
import { Confetti } from '../../components/games/Confetti';
import { gameSounds } from '../../lib/game-sounds';

const TOTAL_ROUNDS = 12;
const BUBBLE_COUNT = 6;
const TIME_PER_ROUND = 4;

interface Bubble {
  id: number;
  value: number;
  x: number;
  y: number;
  popped: boolean;
}

function genRound(): { target: number; bubbles: Bubble[] } {
  const target = Math.floor(Math.random() * 20) + 1;
  const values = new Set([target]);
  while (values.size < BUBBLE_COUNT) {
    const v = Math.floor(Math.random() * 24) + 1;
    values.add(v);
  }
  const shuffled = [...values].sort(() => Math.random() - 0.5);
  const bubbles: Bubble[] = shuffled.map((value, i) => ({
    id: i,
    value,
    x: 10 + (i % 3) * 30 + Math.random() * 8,
    y: 15 + Math.floor(i / 3) * 42 + Math.random() * 8,
    popped: false,
  }));
  return { target, bubbles };
}

const BUBBLE_COLORS = [
  'from-pink-500 to-rose-500',
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-yellow-400 to-orange-500',
  'from-indigo-500 to-blue-600',
];

export function BubblePopGame() {
  const paused = useGameStore((s) => s.paused);
  const triggerShake = useGameStore((s) => s.triggerShake);
  const triggerFlash = useGameStore((s) => s.triggerFlash);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_ROUND);
  const [data, setData] = useState(() => genRound());
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [done, setDone] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const answered = useRef(false);

  const advance = useCallback(
    (correct: boolean) => {
      if (answered.current) return;
      answered.current = true;
      setFeedback(correct ? 'correct' : 'wrong');
      if (correct) {
        gameSounds.pop();
        setTimeout(() => gameSounds.success(), 80);
        triggerFlash('green');
        setScore((s) => s + 1);
        setConfettiKey((k) => k + 1);
      } else {
        gameSounds.fail();
        triggerShake();
        triggerFlash('red');
      }
      setTimeout(() => {
        setFeedback(null);
        answered.current = false;
        if (round + 1 >= TOTAL_ROUNDS) { setDone(true); gameSounds.gameOver(); return; }
        setRound((r) => r + 1);
        setData(genRound());
        setTimeLeft(TIME_PER_ROUND);
      }, 700);
    },
    [round, triggerFlash, triggerShake],
  );

  useEffect(() => {
    if (done || feedback || paused) return;
    if (timeLeft <= 0) { advance(false); return; }
    if (timeLeft <= 2) gameSounds.countdown();
    const t = setTimeout(() => setTimeLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, done, feedback, advance, paused]);

  const pop = (b: Bubble) => {
    if (feedback || done || answered.current || paused) return;
    setData((d) => ({ ...d, bubbles: d.bubbles.map((bb) => (bb.id === b.id ? { ...bb, popped: true } : bb)) }));
    advance(b.value === data.target);
  };

  const restart = () => {
    setRound(0);
    setScore(0);
    setTimeLeft(TIME_PER_ROUND);
    setData(genRound());
    setFeedback(null);
    setDone(false);
    answered.current = false;
  };

  const stars = score >= TOTAL_ROUNDS * 0.9 ? 3 : score >= TOTAL_ROUNDS * 0.6 ? 2 : 1;

  if (done)
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="text-8xl mb-2">🫧</div>
          <h2 className="text-4xl font-black text-white">Bubbles Popped!</h2>
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
          <p className="text-3xl font-black text-yellow-300">{score}/{TOTAL_ROUNDS} popped!</p>
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

  const timerPct = (timeLeft / TIME_PER_ROUND) * 100;
  const timerColor = timeLeft > 2 ? 'from-emerald-400 to-green-500' : 'from-red-500 to-pink-600';

  return (
    <div className="flex flex-col items-center gap-4 relative">
      <AnimatePresence>
        {feedback === 'correct' && <Confetti key={confettiKey} count={24} />}
      </AnimatePresence>

      <div className="flex items-center justify-between w-full max-w-md text-sm font-bold text-white">
        <span className="rounded-xl bg-white/10 border border-white/10 px-3 py-1.5">Round {round + 1}/{TOTAL_ROUNDS}</span>
        <span className="rounded-xl bg-yellow-500/20 border border-yellow-400/40 px-3 py-1.5 text-yellow-300">
          ⭐ {score}
        </span>
      </div>

      <div className="w-full max-w-md h-3 rounded-full bg-white/10 overflow-hidden border border-white/10">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${timerColor}`}
          animate={{ width: `${timerPct}%` }}
          transition={{ duration: 0.25 }}
        />
      </div>

      <motion.div
        key={round}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 250, damping: 20 }}
        className="text-center rounded-3xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/20 px-6 py-3 shadow-xl"
      >
        <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Pop bubble showing</p>
        <p className="text-5xl font-black text-yellow-300" style={{ textShadow: '0 0 18px rgba(250, 204, 21, 0.5)' }}>
          {data.target}
        </p>
      </motion.div>

      <AnimatePresence>
        {feedback && (
          <motion.p
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className={`text-2xl font-black ${feedback === 'correct' ? 'text-green-400' : 'text-red-400'}`}
          >
            {feedback === 'correct' ? '💥 Pop!' : '❌ Missed!'}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="relative w-full max-w-xs sm:max-w-sm" style={{ height: 240 }}>
        <AnimatePresence>
          {data.bubbles.map(
            (b) =>
              !b.popped && (
                <motion.button
                  key={`${round}-${b.id}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [1, 1.08, 1], opacity: 1, y: [0, -6, 0] }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{
                    scale: { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: b.id * 0.15 },
                    y: { duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: b.id * 0.2 },
                    opacity: { duration: 0.2 },
                  }}
                  onClick={() => pop(b)}
                  style={{ left: `${b.x}%`, top: `${b.y}%`, position: 'absolute' }}
                  className={`w-16 h-16 rounded-full bg-gradient-to-br ${BUBBLE_COLORS[b.id % BUBBLE_COLORS.length]}
                    text-white text-2xl font-black shadow-xl flex items-center justify-center cursor-pointer
                    hover:scale-110 active:scale-90 transition-transform border-2 border-white/30`}
                >
                  {b.value}
                </motion.button>
              ),
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
