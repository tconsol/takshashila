import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Clock } from 'lucide-react';
import { useGameStore } from '../../stores/game.store';
import { Confetti } from '../../components/games/Confetti';
import { gameSounds } from '../../lib/game-sounds';

const EMOJIS = ['🐶','🐱','🐭','🐹','🦊','🐻','🐼','🐨','🦁','🐮','🐸','🦋'];

interface Card { id: number; emoji: string; flipped: boolean; matched: boolean; }

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildDeck(): Card[] {
  const pairs = shuffle(EMOJIS).slice(0, 8);
  return shuffle([...pairs, ...pairs].map((emoji, id) => ({ id, emoji, flipped: false, matched: false })));
}

export function MemoryMatchGame() {
  const paused = useGameStore((s) => s.paused);
  const triggerFlash = useGameStore((s) => s.triggerFlash);
  const [cards, setCards] = useState<Card[]>(buildDeck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  useEffect(() => {
    if (!running || done || paused) return;
    const t = setInterval(() => setTime((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running, done, paused]);

  const matched = cards.filter((c) => c.matched).length;

  useEffect(() => {
    if (matched === cards.length && cards.length > 0) {
      setDone(true);
      setRunning(false);
      gameSounds.gameOver();
    }
  }, [matched, cards.length]);

  const flip = useCallback(
    (id: number) => {
      if (paused || flipped.length === 2) return;
      const card = cards.find((c) => c.id === id);
      if (!card || card.flipped || card.matched) return;

      gameSounds.tap();
      const newFlipped = [...flipped, id];
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, flipped: true } : c)));
      setFlipped(newFlipped);

      if (newFlipped.length === 2) {
        setMoves((m) => m + 1);
        const [a, b] = newFlipped.map((fid) => cards.find((c) => c.id === fid)!);
        if (a.emoji === b.emoji) {
          gameSounds.success();
          triggerFlash('green');
          setCards((cs) => cs.map((c) => (newFlipped.includes(c.id) ? { ...c, matched: true } : c)));
          setFlipped([]);
          setConfettiKey((k) => k + 1);
        } else {
          setTimeout(() => {
            gameSounds.fail();
            setCards((cs) => cs.map((c) => (newFlipped.includes(c.id) ? { ...c, flipped: false } : c)));
            setFlipped([]);
          }, 900);
        }
      }
    },
    [flipped, cards, paused, triggerFlash],
  );

  const restart = () => {
    setCards(buildDeck());
    setFlipped([]);
    setMoves(0);
    setTime(0);
    setDone(false);
    setRunning(true);
  };

  const stars = moves <= 12 ? 3 : moves <= 18 ? 2 : 1;

  if (done)
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-10 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="text-8xl mb-2">🏆</div>
          <h2 className="text-4xl font-black text-white">Matched All!</h2>
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
          <p className="text-blue-300 font-bold">{moves} moves · {time}s</p>
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
        <Confetti key={confettiKey} count={20} />
      </AnimatePresence>

      <div className="flex flex-wrap justify-center gap-2 text-sm font-bold text-white">
        <span className="rounded-xl bg-white/10 border border-white/10 px-3 py-1.5">🃏 {moves} moves</span>
        <span className="rounded-xl bg-white/10 border border-white/10 px-3 py-1.5">
          <Clock className="inline h-3.5 w-3.5 mr-1" />
          {time}s
        </span>
        <span className="rounded-xl bg-green-500/20 border border-green-500/40 px-3 py-1.5 text-green-300">
          {matched}/{cards.length} matched
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 w-full max-w-sm sm:max-w-md">
        {cards.map((card) => (
          <motion.button
            key={card.id}
            onClick={() => flip(card.id)}
            whileTap={!card.flipped && !card.matched ? { scale: 0.9 } : {}}
            whileHover={!card.flipped && !card.matched ? { scale: 1.05 } : {}}
            className={`aspect-square rounded-2xl text-3xl sm:text-4xl font-bold transition-all flex items-center justify-center shadow-lg backdrop-blur-sm
              ${card.matched
                ? 'bg-green-500/30 border-2 border-green-400 scale-95'
                : card.flipped
                  ? 'bg-white/20 border-2 border-white/40'
                  : 'bg-gradient-to-br from-indigo-700 to-indigo-900 border-2 border-indigo-500/60 cursor-pointer hover:from-indigo-600 hover:to-indigo-800'}`}
            style={card.matched ? { boxShadow: '0 0 20px rgba(74, 222, 128, 0.5)' } : {}}
          >
            <AnimatePresence mode="wait">
              {card.flipped || card.matched ? (
                <motion.span
                  key="emoji"
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: 90, opacity: 0 }}
                >
                  {card.emoji}
                </motion.span>
              ) : (
                <motion.span key="back" className="text-indigo-300 text-2xl">
                  ?
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
