import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Lightbulb } from 'lucide-react';
import { Confetti } from '../../components/games/Confetti';
import { useGameStore } from '../../stores/game.store';
import { gameSounds } from '../../lib/game-sounds';

interface Pattern {
  sequence: (number | null)[];
  answer: number;
  hint: string;
}

function buildPatterns(): Pattern[] {
  const patterns: Pattern[] = [];

  for (let step = 2; step <= 6; step++) {
    const start = Math.floor(Math.random() * 5) + 1;
    const seq = [start, start + step, start + step * 2, null, start + step * 4];
    patterns.push({ sequence: seq, answer: start + step * 3, hint: `+${step} each time` });
  }
  for (const mul of [2, 3]) {
    const start = Math.floor(Math.random() * 3) + 1;
    const seq = [start, start * mul, start * mul * mul, null, start * mul * mul * mul * mul];
    patterns.push({ sequence: seq, answer: start * mul * mul * mul, hint: `×${mul} each time` });
  }
  for (let step = 2; step <= 4; step++) {
    const start = Math.floor(Math.random() * 10) + 20;
    const seq = [start, start - step, start - step * 2, null, start - step * 4];
    patterns.push({ sequence: seq, answer: start - step * 3, hint: `-${step} each time` });
  }

  return patterns.sort(() => Math.random() - 0.5).slice(0, 12);
}

function genChoices(correct: number): number[] {
  const set = new Set([correct]);
  while (set.size < 4) {
    const offset = Math.floor(Math.random() * 8) - 4;
    const v = correct + offset;
    if (v > 0 && v !== correct) set.add(v);
  }
  return [...set].sort(() => Math.random() - 0.5);
}

export function PatternPuzzleGame() {
  const triggerShake = useGameStore((s) => s.triggerShake);
  const triggerFlash = useGameStore((s) => s.triggerFlash);
  const [questions] = useState(buildPatterns);
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [pickedVal, setPickedVal] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [choices] = useState(() => questions.map((q) => genChoices(q.answer)));

  const pick = (val: number) => {
    if (feedback || done) return;
    setPickedVal(val);
    const correct = val === questions[qIdx].answer;
    setFeedback(correct ? 'correct' : 'wrong');
    if (correct) {
      gameSounds.success();
      triggerFlash('green');
      setScore((s) => s + (showHint ? 5 : 10));
      setConfettiKey((k) => k + 1);
    } else {
      gameSounds.fail();
      triggerShake();
      triggerFlash('red');
    }
    setTimeout(() => {
      setFeedback(null);
      setPickedVal(null);
      setShowHint(false);
      if (qIdx + 1 >= questions.length) {
        setDone(true);
        gameSounds.gameOver();
        return;
      }
      setQIdx((q) => q + 1);
    }, 900);
  };

  const restart = () => {
    setQIdx(0);
    setScore(0);
    setFeedback(null);
    setPickedVal(null);
    setDone(false);
    setShowHint(false);
  };

  const maxScore = questions.length * 10;
  const stars = score >= maxScore * 0.9 ? 3 : score >= maxScore * 0.6 ? 2 : 1;

  if (done)
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="text-8xl mb-2">🔮</div>
          <h2 className="text-4xl font-black text-white">Patterns Solved!</h2>
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
          <p className="text-3xl font-black text-yellow-300">{score}/{maxScore} pts</p>
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

  return (
    <div className="flex flex-col items-center gap-5 w-full relative">
      <AnimatePresence>
        {feedback === 'correct' && <Confetti key={confettiKey} count={20} />}
      </AnimatePresence>

      <div className="flex items-center justify-between w-full max-w-md text-sm font-bold text-white">
        <span className="rounded-xl bg-white/10 border border-white/10 px-3 py-1.5">Q {qIdx + 1}/{questions.length}</span>
        <span className="rounded-xl bg-yellow-500/20 border border-yellow-400/40 px-3 py-1.5 text-yellow-300">⭐ {score} pts</span>
      </div>

      <p className="text-white/70 text-sm font-medium">Find the missing number!</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={qIdx}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="rounded-3xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/20 shadow-2xl px-5 py-6"
        >
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {q.sequence.map((n, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl font-black
                  ${n === null
                    ? 'border-2 border-dashed border-yellow-400 bg-yellow-500/20 text-yellow-300 text-3xl animate-pulse'
                    : 'bg-gradient-to-br from-indigo-600 to-indigo-800 border-2 border-indigo-400/50 text-white'}`}
                style={n === null ? { boxShadow: '0 0 16px rgba(250, 204, 21, 0.4)' } : {}}
              >
                {n === null ? '?' : n}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

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
            {feedback === 'correct' ? '✅ Correct!' : `❌ Answer: ${q.answer}`}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {choices[qIdx].map((c) => {
          const isPicked = pickedVal === c;
          const isCorrect = c === q.answer;
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

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowHint(true)}
        disabled={showHint || !!feedback}
        className="flex items-center gap-1.5 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-xs font-bold text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-30 transition-colors"
      >
        <Lightbulb className="h-3.5 w-3.5" /> Hint (-5pts)
      </motion.button>
      {showHint && <p className="text-yellow-300 text-sm font-bold">{q.hint}</p>}
    </div>
  );
}
