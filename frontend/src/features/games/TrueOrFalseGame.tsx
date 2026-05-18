import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Heart, Flame, Check, X } from 'lucide-react';
import { useGameStore } from '../../stores/game.store';
import { Confetti } from '../../components/games/Confetti';
import { gameSounds } from '../../lib/game-sounds';

const MAX_LIVES = 3;
const TIME_PER_Q = 6;
const COMBO_BONUS = 5;

function genQuestion(): { text: string; answer: boolean } {
  const ops = ['+', '-', '*'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  const a = Math.floor(Math.random() * 12) + 1;
  const b = Math.floor(Math.random() * 12) + 1;
  const real = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const correct = Math.random() > 0.45;
  let shown = real;
  if (!correct) {
    const offset = Math.floor(Math.random() * 4) + 1;
    shown = real + (Math.random() > 0.5 ? offset : -offset);
  }
  const opLabel = op === '*' ? '×' : op;
  return { text: `${a} ${opLabel} ${b} = ${shown}`, answer: correct };
}

export function TrueOrFalseGame() {
  const paused = useGameStore((s) => s.paused);
  const triggerShake = useGameStore((s) => s.triggerShake);
  const triggerFlash = useGameStore((s) => s.triggerFlash);
  const [qIdx, setQIdx] = useState(0);
  const [question, setQuestion] = useState(genQuestion);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [pickedSide, setPickedSide] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const answered = useRef(false);

  const next = useCallback((wasCorrect: boolean) => {
    if (answered.current) return;
    answered.current = true;
    if (wasCorrect) {
      gameSounds.success();
      triggerFlash('green');
      setFeedback('correct');
      const newCombo = combo + 1;
      setCombo(newCombo);
      setBestCombo((b) => Math.max(b, newCombo));
      const gain = newCombo >= 3 ? 10 + COMBO_BONUS : 10;
      setScore((s) => s + gain);
      setConfettiKey((k) => k + 1);
      if (newCombo >= 3 && newCombo % 3 === 0) setTimeout(() => gameSounds.combo(), 250);
    } else {
      gameSounds.fail();
      triggerShake();
      triggerFlash('red');
      setFeedback('wrong');
      setCombo(0);
      setShake(true);
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) {
        setTimeout(() => { setDone(true); gameSounds.gameOver(); }, 900);
        return;
      }
    }
    setTimeout(() => {
      setFeedback(null);
      setShake(false);
      setPickedSide(null);
      answered.current = false;
      setQIdx((q) => q + 1);
      setQuestion(genQuestion());
      setTimeLeft(TIME_PER_Q);
    }, 900);
  }, [combo, lives, triggerFlash, triggerShake]);

  useEffect(() => {
    if (done || feedback || paused) return;
    if (timeLeft <= 0) { next(false); return; }
    if (timeLeft <= 2) gameSounds.countdown();
    const t = setTimeout(() => setTimeLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, done, feedback, next, paused]);

  // Keyboard shortcuts: T / F
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (done || feedback || paused) return;
      if (e.key.toLowerCase() === 't') answer(true);
      else if (e.key.toLowerCase() === 'f') answer(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, feedback, paused, question]);

  const answer = (val: boolean) => {
    if (feedback || done || paused) return;
    setPickedSide(val);
    next(val === question.answer);
  };

  const restart = () => {
    setQIdx(0);
    setQuestion(genQuestion());
    setScore(0);
    setLives(MAX_LIVES);
    setCombo(0);
    setBestCombo(0);
    setTimeLeft(TIME_PER_Q);
    setFeedback(null);
    setPickedSide(null);
    setDone(false);
    setShake(false);
    answered.current = false;
  };

  if (done) {
    const stars = score >= 100 ? 3 : score >= 50 ? 2 : 1;
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="text-8xl mb-2">🏆</div>
          <h2 className="text-4xl font-black text-white">Game Over!</h2>
          <div className="flex justify-center gap-2 my-4">
            {[1, 2, 3].map((s) => (
              <motion.span
                key={s}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: s * 0.2, type: 'spring', stiffness: 200 }}
                className={`text-5xl ${s <= stars ? '' : 'opacity-30'}`}
              >
                ⭐
              </motion.span>
            ))}
          </div>
          <p className="text-4xl font-black text-yellow-300" style={{ textShadow: '0 0 20px rgba(250, 204, 21, 0.5)' }}>
            {score} pts
          </p>
          <p className="text-blue-300 text-sm mt-1">{qIdx} questions · Best 🔥 {bestCombo}× combo</p>
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
  }

  const barPct = (timeLeft / TIME_PER_Q) * 100;
  const barGradient =
    timeLeft > 3 ? 'from-emerald-400 to-green-500'
      : timeLeft > 1 ? 'from-yellow-400 to-orange-500'
      : 'from-red-500 to-pink-600';

  return (
    <motion.div
      animate={shake ? { x: [0, -16, 16, -10, 10, -5, 0] } : {}}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-6 w-full"
    >
      {/* HUD */}
      <div className="grid grid-cols-3 items-center w-full gap-2 max-w-md">
        <div className="flex items-center gap-1">
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <motion.div
              key={i}
              animate={i < lives ? { scale: [1, 1.15, 1] } : { scale: 0.85, opacity: 0.3 }}
              transition={{ duration: 1.5, repeat: i < lives ? Infinity : 0, delay: i * 0.2 }}
            >
              <Heart className={`h-6 w-6 ${i < lives ? 'fill-red-500 text-red-500' : 'text-white/20'}`} />
            </motion.div>
          ))}
        </div>
        <div className="flex justify-center">
          <motion.span
            key={score}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="rounded-xl bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 text-base font-black px-4 py-1.5 shadow-lg shadow-yellow-500/10"
          >
            ⭐ {score}
          </motion.span>
        </div>
        <div className="flex justify-end">
          <AnimatePresence>
            {combo >= 2 && (
              <motion.span
                initial={{ scale: 0, x: 30 }}
                animate={{ scale: 1, x: 0 }}
                exit={{ scale: 0 }}
                className="flex items-center gap-1 rounded-xl bg-orange-500/20 border border-orange-400/50 text-orange-300 text-sm font-black px-3 py-1.5 shadow-lg shadow-orange-500/20"
              >
                <Flame className="h-4 w-4 fill-orange-400 text-orange-400" /> {combo}×
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Timer bar */}
      <div className="w-full max-w-md h-3 rounded-full bg-white/10 overflow-hidden border border-white/10">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${barGradient}`}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 0.25 }}
          style={{ boxShadow: timeLeft <= 2 ? '0 0 12px currentColor' : 'none' }}
        />
      </div>

      {/* Question card */}
      <div className="relative">
        <AnimatePresence>
          {feedback === 'correct' && <Confetti key={confettiKey} count={28} />}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={qIdx}
            initial={{ opacity: 0, scale: 0.7, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: -30 }}
            transition={{ type: 'spring', stiffness: 250, damping: 20 }}
            className="rounded-3xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-md border border-white/20 shadow-2xl px-8 py-8 sm:px-12 sm:py-10 text-center min-w-[280px] sm:min-w-[400px]"
          >
            <p className="text-white/60 text-xs font-bold mb-3 uppercase tracking-[0.2em]">Is this correct?</p>
            <motion.p
              key={`${qIdx}-text`}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-5xl sm:text-6xl font-black text-white tracking-tight"
              style={{ textShadow: '0 0 24px rgba(255,255,255,0.4)' }}
            >
              {question.text}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Feedback */}
      <div className="h-10 flex items-center justify-center">
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0 }}
              className={`text-2xl sm:text-3xl font-black ${feedback === 'correct' ? 'text-green-400' : 'text-red-400'}`}
              style={{
                textShadow:
                  feedback === 'correct'
                    ? '0 0 20px rgba(74, 222, 128, 0.7)'
                    : '0 0 20px rgba(248, 113, 113, 0.7)',
              }}
            >
              {feedback === 'correct'
                ? combo >= 3 ? `🔥 COMBO +${10 + COMBO_BONUS}` : '✅ +10 pts'
                : `❌ ${question.answer ? 'TRUE' : 'FALSE'}`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Buttons */}
      <div className="flex gap-4 sm:gap-6 mt-1">
        {[
          {
            val: true,
            label: 'TRUE',
            Icon: Check,
            color: 'from-emerald-500 to-green-600',
            glow: 'rgba(74, 222, 128, 0.55)',
            shortcut: 'T',
          },
          {
            val: false,
            label: 'FALSE',
            Icon: X,
            color: 'from-red-500 to-rose-600',
            glow: 'rgba(248, 113, 113, 0.55)',
            shortcut: 'F',
          },
        ].map((b) => {
          const isPicked = pickedSide === b.val && feedback !== null;
          const showGlow = isPicked && feedback === 'correct';
          const showShake = isPicked && feedback === 'wrong';
          return (
            <motion.button
              key={String(b.val)}
              onClick={() => answer(b.val)}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
              animate={showShake ? { x: [0, -6, 6, -4, 0] } : showGlow ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.35 }}
              disabled={!!feedback}
              className={`relative overflow-hidden px-7 py-5 sm:px-10 sm:py-6 rounded-3xl text-xl sm:text-2xl font-black text-white bg-gradient-to-br ${b.color} shadow-2xl disabled:cursor-not-allowed group min-w-[140px] sm:min-w-[170px]`}
              style={{ boxShadow: `0 8px 30px ${b.glow}` }}
            >
              <div className="relative flex items-center justify-center gap-2">
                <b.Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={3.5} />
                <span>{b.label}</span>
              </div>
              <motion.div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                animate={{ opacity: [0, 0.4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ background: `radial-gradient(circle at center, ${b.glow} 0%, transparent 60%)` }}
              />
              <kbd className="hidden sm:inline-block absolute top-1.5 right-2 text-[10px] font-mono font-bold text-white/50 bg-white/10 rounded px-1.5 py-0.5">
                {b.shortcut}
              </kbd>
            </motion.button>
          );
        })}
      </div>

      <p className="text-white/40 text-xs font-medium">Question {qIdx + 1} · ⏱ {timeLeft}s</p>
    </motion.div>
  );
}
