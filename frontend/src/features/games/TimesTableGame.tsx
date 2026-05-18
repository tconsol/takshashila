import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Flame } from 'lucide-react';
import { useGameStore } from '../../stores/game.store';
import { Confetti } from '../../components/games/Confetti';
import { gameSounds } from '../../lib/game-sounds';

const TOTAL = 20;
const TIME_LIMIT = 60;

function genQ(): { a: number; b: number; answer: number } {
  const a = Math.floor(Math.random() * 12) + 1;
  const b = Math.floor(Math.random() * 12) + 1;
  return { a, b, answer: a * b };
}

function genChoices(correct: number): number[] {
  const set = new Set([correct]);
  while (set.size < 4) {
    const offset = Math.floor(Math.random() * 20) - 10;
    const v = correct + offset;
    if (v > 0 && v !== correct) set.add(v);
  }
  return [...set].sort(() => Math.random() - 0.5);
}

export function TimesTableGame() {
  const paused = useGameStore((s) => s.paused);
  const triggerShake = useGameStore((s) => s.triggerShake);
  const triggerFlash = useGameStore((s) => s.triggerFlash);
  const [questions] = useState(() => Array.from({ length: TOTAL }, genQ));
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [pickedVal, setPickedVal] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [confettiKey, setConfettiKey] = useState(0);
  const answered = useRef(false);
  const [choices, setChoices] = useState(() => genChoices(questions[0].answer));

  useEffect(() => {
    if (done || paused) return;
    if (timeLeft <= 0) { setDone(true); return; }
    if (timeLeft <= 5) gameSounds.countdown();
    const t = setTimeout(() => setTimeLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, done, paused]);

  useEffect(() => {
    if (done) gameSounds.gameOver();
  }, [done]);

  const pick = (val: number) => {
    if (feedback || done || answered.current || paused) return;
    answered.current = true;
    setPickedVal(val);
    const correct = val === questions[qIdx].answer;
    setFeedback(correct ? 'correct' : 'wrong');
    if (correct) {
      gameSounds.success();
      triggerFlash('green');
      setScore((s) => s + 1);
      setStreak((s) => {
        const ns = s + 1;
        setBestStreak((b) => Math.max(b, ns));
        if (ns >= 3 && ns % 3 === 0) setTimeout(() => gameSounds.combo(), 250);
        return ns;
      });
      setConfettiKey((k) => k + 1);
    } else {
      gameSounds.fail();
      triggerShake();
      triggerFlash('red');
      setStreak(0);
    }
    setTimeout(() => {
      setFeedback(null);
      setPickedVal(null);
      answered.current = false;
      if (qIdx + 1 >= TOTAL) { setDone(true); return; }
      const nq = qIdx + 1;
      setQIdx(nq);
      setChoices(genChoices(questions[nq].answer));
    }, 600);
  };

  const restart = () => {
    setQIdx(0);
    setScore(0);
    setTimeLeft(TIME_LIMIT);
    setFeedback(null);
    setPickedVal(null);
    setDone(false);
    setStreak(0);
    setBestStreak(0);
    answered.current = false;
    setChoices(genChoices(questions[0].answer));
  };

  const pct = Math.round((score / TOTAL) * 100);
  const stars = pct >= 90 ? 3 : pct >= 65 ? 2 : 1;

  if (done)
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="text-8xl mb-2">✖️</div>
          <h2 className="text-4xl font-black text-white">Time's Up!</h2>
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
          <p className="text-orange-300 text-sm mt-1 font-bold">Best streak 🔥 {bestStreak}×</p>
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

  const q = questions[qIdx];
  const timerColor = timeLeft > 20 ? 'text-emerald-300' : timeLeft > 10 ? 'text-yellow-300' : 'text-red-400';

  return (
    <div className="flex flex-col items-center gap-5 w-full relative">
      {/* HUD */}
      <div className="flex items-center justify-between w-full max-w-md text-sm font-bold text-white">
        <span className="rounded-xl bg-white/10 border border-white/10 px-3 py-1.5">Q {qIdx + 1}/{TOTAL}</span>
        <AnimatePresence>
          {streak >= 3 && (
            <motion.span
              key={streak}
              initial={{ scale: 0, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0 }}
              className="flex items-center gap-1 rounded-xl bg-orange-500/30 border border-orange-400/50 text-orange-300 px-3 py-1.5"
            >
              <Flame className="h-4 w-4 fill-orange-400" /> {streak}× streak!
            </motion.span>
          )}
        </AnimatePresence>
        <span className={`rounded-xl px-3 py-1.5 font-bold ${timerColor} bg-white/10 border border-white/10`}>
          ⏱ {timeLeft}s
        </span>
      </div>

      {/* Question card */}
      <div className="relative">
        <AnimatePresence>
          {feedback === 'correct' && <Confetti key={confettiKey} count={20} />}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={qIdx}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="rounded-3xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/20 shadow-2xl px-8 py-7 sm:px-12 sm:py-9 text-center"
          >
            <p className="text-white/60 text-xs font-bold mb-2 uppercase tracking-[0.2em]">What is</p>
            <p className="text-5xl sm:text-6xl font-black text-white"
              style={{ textShadow: '0 0 24px rgba(255, 255, 255, 0.35)' }}>
              {q.a} × {q.b} = <span className="text-yellow-300">?</span>
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Feedback */}
      <div className="h-8 flex items-center">
        <AnimatePresence>
          {feedback && (
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className={`text-2xl font-black ${feedback === 'correct' ? 'text-green-400' : 'text-red-400'}`}
              style={{
                textShadow: feedback === 'correct' ? '0 0 18px rgba(74, 222, 128, 0.6)' : '0 0 18px rgba(248, 113, 113, 0.6)',
              }}
            >
              {feedback === 'correct' ? '✅ Correct!' : `❌ ${q.answer}`}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Choices */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {choices.map((c) => {
          const isPicked = pickedVal === c;
          const isCorrectAns = c === q.answer;
          let cls = 'bg-gradient-to-br from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white';
          let glow = 'rgba(99, 102, 241, 0.4)';
          if (feedback) {
            if (isCorrectAns) {
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
              whileTap={!feedback ? { scale: 0.92 } : {}}
              whileHover={!feedback ? { scale: 1.04 } : {}}
              onClick={() => pick(c)}
              disabled={!!feedback}
              className={`py-5 rounded-2xl text-3xl font-black transition-colors shadow-xl ${cls}`}
              style={{ boxShadow: `0 6px 22px ${glow}` }}
            >
              {c}
            </motion.button>
          );
        })}
      </div>

      <p className="text-yellow-300 font-bold">⭐ {score} pts</p>
    </div>
  );
}
