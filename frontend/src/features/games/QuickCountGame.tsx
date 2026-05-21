import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useGameStore } from '../../stores/game.store';
import { Confetti } from '../../components/games/Confetti';
import { gameSounds } from '../../lib/game-sounds';

const TOTAL = 12;
const SHOW_MS = 1200;

interface Round {
  dots: { x: number; y: number; color: string }[];
  count: number;
  choices: number[];
}

const DOT_COLORS = ['#f472b6','#60a5fa','#34d399','#fbbf24','#a78bfa','#f87171'];

function buildRound(difficulty: number): Round {
  const count = Math.min(4 + difficulty * 2, 20);
  const jitter = () => 10 + Math.random() * 80;
  const dots = Array.from({ length: count }, (_, i) => ({
    x: jitter(),
    y: jitter(),
    color: DOT_COLORS[i % DOT_COLORS.length],
  }));
  const choices = new Set([count]);
  while (choices.size < 4) {
    const offset = Math.floor(Math.random() * 6) - 3;
    const v = count + offset;
    if (v > 0 && v !== count) choices.add(v);
  }
  return { dots, count, choices: [...choices].sort(() => Math.random() - 0.5) };
}

export function QuickCountGame() {
  const paused = useGameStore((s) => s.paused);
  const triggerShake = useGameStore((s) => s.triggerShake);
  const triggerFlash = useGameStore((s) => s.triggerFlash);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [data, setData] = useState<Round>(() => buildRound(0));
  const [phase, setPhase] = useState<'show' | 'answer'>('show');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [pickedVal, setPickedVal] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const answered = useRef(false);

  useEffect(() => {
    if (phase === 'show' && !paused) {
      const t = setTimeout(() => setPhase('answer'), SHOW_MS);
      return () => clearTimeout(t);
    }
  }, [phase, round, paused]);

  const pick = useCallback(
    (val: number) => {
      if (phase !== 'answer' || feedback || done || answered.current || paused) return;
      answered.current = true;
      setPickedVal(val);
      const correct = val === data.count;
      setFeedback(correct ? 'correct' : 'wrong');
      if (correct) {
        gameSounds.success();
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
        setPickedVal(null);
        answered.current = false;
        if (round + 1 >= TOTAL) { setDone(true); gameSounds.gameOver(); return; }
        const nr = round + 1;
        setRound(nr);
        setData(buildRound(Math.floor(nr / 3)));
        setPhase('show');
      }, 700);
    },
    [phase, feedback, done, data.count, round, paused, triggerFlash, triggerShake],
  );

  const restart = () => {
    setRound(0);
    setScore(0);
    setData(buildRound(0));
    setPhase('show');
    setFeedback(null);
    setPickedVal(null);
    setDone(false);
    answered.current = false;
  };

  const stars = score >= TOTAL * 0.9 ? 3 : score >= TOTAL * 0.6 ? 2 : 1;

  if (done)
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="text-8xl mb-2">👀</div>
          <h2 className="text-4xl font-black text-white">Sharp Eyes!</h2>
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
          <p className="text-3xl font-black text-yellow-300">{score}/{TOTAL} correct</p>
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
    <div className="flex flex-col items-center gap-5 w-full relative">
      <AnimatePresence>
        {feedback === 'correct' && <Confetti key={confettiKey} count={20} />}
      </AnimatePresence>

      <div className="flex items-center justify-between w-full max-w-md text-sm font-bold text-white">
        <span className="rounded-xl bg-white/10 border border-white/10 px-3 py-1.5">Round {round + 1}/{TOTAL}</span>
        <span className="rounded-xl bg-yellow-500/20 border border-yellow-400/40 px-3 py-1.5 text-yellow-300">⭐ {score}</span>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'show' ? (
          <motion.div
            key={`show-${round}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <p className="text-white/70 text-sm font-bold uppercase tracking-widest">Count the dots — quick!</p>
            <div className="relative w-72 h-56 rounded-3xl bg-gradient-to-br from-indigo-900/80 to-purple-900/80 backdrop-blur-sm border-2 border-indigo-400/30 overflow-hidden shadow-2xl">
              {data.dots.map((d, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.03, type: 'spring', stiffness: 400 }}
                  style={{
                    left: `${d.x}%`,
                    top: `${d.y}%`,
                    background: d.color,
                    boxShadow: `0 0 12px ${d.color}`,
                    position: 'absolute',
                  }}
                  className="w-7 h-7 rounded-full -translate-x-1/2 -translate-y-1/2"
                />
              ))}
            </div>
            <motion.div className="w-72 h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                initial={{ width: '100%' }}
                animate={{ width: paused ? '100%' : '0%' }}
                transition={{ duration: paused ? 0 : SHOW_MS / 1000, ease: 'linear' }}
              />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="answer"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <p className="text-white text-lg font-bold">How many dots did you see?</p>

            <AnimatePresence>
              {feedback && (
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className={`text-2xl font-black ${feedback === 'correct' ? 'text-green-400' : 'text-red-400'}`}
                  style={{
                    textShadow:
                      feedback === 'correct'
                        ? '0 0 18px rgba(74, 222, 128, 0.6)'
                        : '0 0 18px rgba(248, 113, 113, 0.6)',
                  }}
                >
                  {feedback === 'correct' ? '✅ Correct!' : `❌ It was ${data.count}`}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              {data.choices.map((c) => {
                const isPicked = pickedVal === c;
                const isCorrect = c === data.count;
                let cls = 'bg-gradient-to-br from-indigo-600 to-indigo-800 hover:from-indigo-500 text-white';
                let glow = 'rgba(99, 102, 241, 0.4)';
                if (feedback) {
                  if (isCorrect) {
                    cls = 'bg-gradient-to-br from-emerald-500 to-green-600 text-white';
                    glow = 'rgba(74, 222, 128, 0.6)';
                  } else if (isPicked) {
                    cls = 'bg-gradient-to-br from-red-500 to-rose-600 text-white';
                    glow = 'rgba(248, 113, 113, 0.6)';
                  } else {
                    cls = 'bg-white/5 text-white/30';
                    glow = 'transparent';
                  }
                }
                return (
                  <motion.button
                    key={c}
                    whileTap={!feedback ? { scale: 0.9 } : {}}
                    whileHover={!feedback ? { scale: 1.05 } : {}}
                    onClick={() => pick(c)}
                    disabled={!!feedback}
                    className={`py-4 rounded-2xl text-3xl font-black transition-colors shadow-xl ${cls}`}
                    style={{ boxShadow: `0 6px 20px ${glow}` }}
                  >
                    {c}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
