import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Lightbulb, Delete } from 'lucide-react';
import { Confetti } from '../../components/games/Confetti';
import { useGameStore } from '../../stores/game.store';
import { gameSounds } from '../../lib/game-sounds';

const WORDS = [
  { emoji: '🐶', word: 'DOG' },
  { emoji: '🐱', word: 'CAT' },
  { emoji: '🦁', word: 'LION' },
  { emoji: '🐘', word: 'ELEPHANT' },
  { emoji: '🦒', word: 'GIRAFFE' },
  { emoji: '🐬', word: 'DOLPHIN' },
  { emoji: '🦋', word: 'BUTTERFLY' },
  { emoji: '🍎', word: 'APPLE' },
  { emoji: '🍌', word: 'BANANA' },
  { emoji: '🌈', word: 'RAINBOW' },
  { emoji: '⭐', word: 'STAR' },
  { emoji: '🌸', word: 'FLOWER' },
  { emoji: '🐸', word: 'FROG' },
  { emoji: '🦊', word: 'FOX' },
  { emoji: '🚀', word: 'ROCKET' },
];

function scramble(word: string): string {
  const arr = word.split('');
  let s = word;
  while (s === word) s = arr.sort(() => Math.random() - 0.5).join('');
  return s;
}

export function EmojiSpellGame() {
  const triggerShake = useGameStore((s) => s.triggerShake);
  const triggerFlash = useGameStore((s) => s.triggerFlash);
  const [questions] = useState(() =>
    WORDS.sort(() => Math.random() - 0.5)
      .slice(0, 10)
      .map((w) => ({ ...w, scrambled: scramble(w.word) })),
  );
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [typed, setTyped] = useState<string[]>([]);
  const [letters, setLetters] = useState(() =>
    questions[0].scrambled.split('').map((ch) => ({ ch, used: false })),
  );
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong' | 'done'>('playing');
  const [showHint, setShowHint] = useState(false);
  const [hintPenalty, setHintPenalty] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  const q = questions[qIdx];

  const resetQ = (idx: number) => {
    setLetters(questions[idx].scrambled.split('').map((ch) => ({ ch, used: false })));
    setTyped([]);
    setStatus('playing');
    setShowHint(false);
    setHintPenalty(false);
  };

  const pick = (i: number) => {
    if (status !== 'playing' || letters[i].used) return;
    gameSounds.tap();
    const newTyped = [...typed, letters[i].ch];
    const newLetters = letters.map((l, li) => (li === i ? { ...l, used: true } : l));
    setTyped(newTyped);
    setLetters(newLetters);

    if (newTyped.length === q.word.length) {
      const correct = newTyped.join('') === q.word;
      setStatus(correct ? 'correct' : 'wrong');
      if (correct) {
        gameSounds.success();
        triggerFlash('green');
        setScore((s) => s + (hintPenalty ? 5 : 10));
        setConfettiKey((k) => k + 1);
      } else {
        gameSounds.fail();
        triggerShake();
        triggerFlash('red');
      }
      setTimeout(() => {
        if (qIdx + 1 >= questions.length) {
          setStatus('done');
          gameSounds.gameOver();
          return;
        }
        const nIdx = qIdx + 1;
        setQIdx(nIdx);
        resetQ(nIdx);
      }, 1100);
    }
  };

  const erase = () => {
    if (status !== 'playing' || typed.length === 0) return;
    gameSounds.click();
    const last = typed[typed.length - 1];
    let unUsed = false;
    const newL = [...letters]
      .reverse()
      .map((l) => {
        if (!unUsed && l.used && l.ch === last) {
          unUsed = true;
          return { ...l, used: false };
        }
        return l;
      })
      .reverse();
    setLetters(newL);
    setTyped(typed.slice(0, -1));
  };

  const restart = () => {
    setQIdx(0);
    setScore(0);
    resetQ(0);
    setStatus('playing');
  };

  if (status === 'done')
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="text-8xl mb-2">🎊</div>
          <h2 className="text-4xl font-black text-white">All Spelled!</h2>
          <p className="text-3xl font-black text-yellow-300 mt-2">{score}/{questions.length * 10} pts</p>
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
        {status === 'correct' && <Confetti key={confettiKey} count={24} />}
      </AnimatePresence>

      <div className="flex items-center justify-between w-full max-w-md text-sm font-bold text-white">
        <span className="rounded-xl bg-white/10 border border-white/10 px-3 py-1.5">Q {qIdx + 1}/{questions.length}</span>
        <span className="rounded-xl bg-yellow-500/20 border border-yellow-400/40 px-3 py-1.5 text-yellow-300">⭐ {score} pts</span>
      </div>

      <motion.div
        key={qIdx}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="text-center rounded-3xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/20 px-6 py-4 shadow-xl"
      >
        <motion.div
          animate={{ rotate: [0, -8, 8, -4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="text-8xl mb-1"
        >
          {q.emoji}
        </motion.div>
        <p className="text-white/50 text-xs">{q.word.length} letters</p>
      </motion.div>

      <div className="flex gap-2 flex-wrap justify-center">
        {Array.from({ length: q.word.length }, (_, i) => (
          <motion.div
            key={i}
            animate={status === 'wrong' ? { x: [0, -8, 8, -6, 6, 0] } : {}}
            transition={{ duration: 0.4 }}
            className={`w-11 h-13 sm:w-12 sm:h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-colors
              ${typed[i]
                ? status === 'correct'
                  ? 'border-green-400 bg-green-500/30 text-green-300'
                  : status === 'wrong'
                    ? 'border-red-400 bg-red-500/30 text-red-300'
                    : 'border-white/40 bg-white/15 text-white'
                : 'border-white/20 bg-white/5'}`}
            style={typed[i] && status === 'correct' ? { boxShadow: '0 0 12px rgba(74, 222, 128, 0.5)' } : {}}
          >
            {typed[i] ?? ''}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {status === 'correct' && (
          <motion.p
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="text-2xl font-black text-green-400"
            style={{ textShadow: '0 0 18px rgba(74, 222, 128, 0.6)' }}
          >
            ✅ +{hintPenalty ? 5 : 10} pts
          </motion.p>
        )}
        {status === 'wrong' && (
          <motion.p
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="text-lg font-bold text-red-400"
          >
            ❌ Answer: {q.word}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {letters.map((l, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.85 }}
            whileHover={!l.used && status === 'playing' ? { scale: 1.08 } : {}}
            onClick={() => pick(i)}
            disabled={l.used || status !== 'playing'}
            className={`w-12 h-12 rounded-xl text-xl font-black transition-all
              ${l.used
                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                : 'bg-gradient-to-br from-purple-600 to-fuchsia-700 hover:from-purple-500 hover:to-fuchsia-600 text-white shadow-lg cursor-pointer'}`}
            style={!l.used ? { boxShadow: '0 4px 16px rgba(168, 85, 247, 0.45)' } : {}}
          >
            {l.ch}
          </motion.button>
        ))}
      </div>

      <div className="flex gap-3">
        <motion.button
          onClick={erase}
          whileTap={{ scale: 0.95 }}
          disabled={status !== 'playing' || typed.length === 0}
          className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/15 disabled:opacity-30 transition-colors"
        >
          <Delete className="h-4 w-4" /> Erase
        </motion.button>
        <motion.button
          onClick={() => {
            setShowHint(true);
            setHintPenalty(true);
          }}
          whileTap={{ scale: 0.95 }}
          disabled={showHint || status !== 'playing'}
          className="flex items-center gap-1.5 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-30 transition-colors"
        >
          <Lightbulb className="h-4 w-4" /> Hint (-5)
        </motion.button>
      </div>
      {showHint && <p className="text-yellow-300 font-bold text-sm">Starts with: {q.word[0]}</p>}
    </div>
  );
}
