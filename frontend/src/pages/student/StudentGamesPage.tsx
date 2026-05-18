import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';
import { GameShell } from '../../components/games/GameShell';
import { MathRacerGame } from '../../features/games/MathRacerGame';
import { WordScrambleGame } from '../../features/games/WordScrambleGame';
import { MemoryMatchGame } from '../../features/games/MemoryMatchGame';
import { NumberOrderGame } from '../../features/games/NumberOrderGame';
import { TrueOrFalseGame } from '../../features/games/TrueOrFalseGame';
import { TimesTableGame } from '../../features/games/TimesTableGame';
import { PatternPuzzleGame } from '../../features/games/PatternPuzzleGame';
import { BubblePopGame } from '../../features/games/BubblePopGame';
import { QuickCountGame } from '../../features/games/QuickCountGame';
import { EmojiSpellGame } from '../../features/games/EmojiSpellGame';

interface GameCard {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  color: string;
  tag: string;
}

const GAMES: GameCard[] = [
  {
    id: 'math-racer',
    title: 'Math Racer',
    desc: 'Blast your rocket to the finish line by answering math!',
    emoji: '🚀',
    color: 'from-indigo-500 to-violet-600',
    tag: '+ − × ÷ · Speed',
  },
  {
    id: 'word-scramble',
    title: 'Word Scramble',
    desc: 'Unscramble the letters to form the correct word.',
    emoji: '📝',
    color: 'from-emerald-500 to-teal-600',
    tag: 'Spelling · Vocabulary',
  },
  {
    id: 'memory-match',
    title: 'Memory Match',
    desc: 'Flip cards and match pairs to train your memory.',
    emoji: '🧠',
    color: 'from-pink-500 to-rose-600',
    tag: 'Memory · Focus',
  },
  {
    id: 'number-order',
    title: 'Number Order',
    desc: 'Tap numbers 1 to 16 in order as fast as you can!',
    emoji: '🔢',
    color: 'from-orange-500 to-amber-600',
    tag: 'Numbers · Speed',
  },
  {
    id: 'true-or-false',
    title: 'True or False',
    desc: 'Decide if math equations are true or false in time!',
    emoji: '✅',
    color: 'from-cyan-500 to-blue-600',
    tag: 'Math · Reflex',
  },
  {
    id: 'times-table',
    title: 'Times Table Blitz',
    desc: 'Answer multiplication questions in 60 seconds!',
    emoji: '✖️',
    color: 'from-purple-500 to-fuchsia-600',
    tag: 'Multiplication · Blitz',
  },
  {
    id: 'pattern-puzzle',
    title: 'Pattern Puzzle',
    desc: 'Find the missing number that completes the sequence!',
    emoji: '🔮',
    color: 'from-yellow-500 to-orange-600',
    tag: 'Patterns · Logic',
  },
  {
    id: 'bubble-pop',
    title: 'Bubble Pop',
    desc: 'Pop the bubble with the target number before time runs out!',
    emoji: '🫧',
    color: 'from-teal-500 to-emerald-600',
    tag: 'Numbers · Reflex',
  },
  {
    id: 'quick-count',
    title: 'Quick Count',
    desc: 'Count the dots on screen before they disappear!',
    emoji: '👀',
    color: 'from-rose-500 to-pink-600',
    tag: 'Counting · Visual',
  },
  {
    id: 'emoji-spell',
    title: 'Emoji Spell',
    desc: 'See the emoji and spell the word using scrambled letters!',
    emoji: '🎨',
    color: 'from-violet-500 to-purple-700',
    tag: 'Spelling · Emoji',
  },
];

const GAME_COMPONENTS: Record<string, React.ComponentType> = {
  'math-racer': MathRacerGame,
  'word-scramble': WordScrambleGame,
  'memory-match': MemoryMatchGame,
  'number-order': NumberOrderGame,
  'true-or-false': TrueOrFalseGame,
  'times-table': TimesTableGame,
  'pattern-puzzle': PatternPuzzleGame,
  'bubble-pop': BubblePopGame,
  'quick-count': QuickCountGame,
  'emoji-spell': EmojiSpellGame,
};

const fadeUp = (i: number) => ({
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 22, delay: i * 0.06 } },
});

export function StudentGamesPage() {
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const ActiveComponent = activeGame ? GAME_COMPONENTS[activeGame] : null;
  const activeCard = activeGame ? GAMES.find((g) => g.id === activeGame) : null;

  return (
    <>
      <AnimatePresence>
        {activeGame && ActiveComponent && activeCard && (
          <GameShell
            key={activeGame}
            title={activeCard.title}
            emoji={activeCard.emoji}
            color={activeCard.color}
            onBack={() => setActiveGame(null)}
          >
            <ActiveComponent />
          </GameShell>
        )}
      </AnimatePresence>

      {/* Games hub */}
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-6 py-6 shadow-xl shadow-violet-500/25"
        >
          <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-8 left-1/3 h-24 w-24 rounded-full bg-pink-400/20 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, -10, 10, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur-sm"
            >
              🎮
            </motion.div>
            <div>
              <h1 className="text-3xl font-extrabold text-white">Learning Arcade</h1>
              <p className="text-sm text-white/80">10 games · Tap any tile to play!</p>
            </div>
            <Gamepad2 className="ml-auto h-10 w-10 text-white/30" />
          </div>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((game, i) => (
            <motion.div key={game.id} variants={fadeUp(i)} initial="hidden" animate="show">
              <motion.button
                onClick={() => setActiveGame(game.id)}
                whileHover={{ scale: 1.03, y: -4 }}
                whileTap={{ scale: 0.97 }}
                className="group w-full text-left rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow cursor-pointer block"
              >
                <div className={`bg-gradient-to-br ${game.color} p-6 flex flex-col items-start gap-2 relative overflow-hidden min-h-[200px]`}>
                  <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
                  <div className="absolute -bottom-6 -right-2 h-16 w-16 rounded-full bg-white/10" />
                  <motion.div
                    animate={{ rotate: [0, 8, -4, 0], y: [0, -2, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
                    className="text-5xl drop-shadow-lg relative"
                  >
                    {game.emoji}
                  </motion.div>
                  <h2 className="text-xl font-extrabold text-white relative">{game.title}</h2>
                  <p className="text-sm text-white/80 leading-relaxed relative">{game.desc}</p>
                  <div className="mt-auto inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white group-hover:bg-white/30 transition-colors relative">
                    Play now →
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-t-0 border-gray-100 dark:border-gray-800 rounded-b-3xl px-4 py-2.5">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">{game.tag}</p>
                </div>
              </motion.button>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center text-xs text-gray-400 dark:text-gray-500"
        >
          ⏸ Press ESC or P during a game to pause · 🎯 Play daily to sharpen your skills
        </motion.p>
      </div>
    </>
  );
}
