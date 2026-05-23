import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, RotateCcw, Flag } from 'lucide-react';
import { useGameStore } from '../../stores/game.store';
import { gameSounds } from '../../lib/game-sounds';
import { Confetti } from '../../components/games/Confetti';
import { drawTrack, WORLD_W, WORLD_H } from './grand-prix/track';
import { drawCar, carHexColor } from './grand-prix/cars';
import {
  buildRacers, TOTAL_SEGMENTS, easeDisplay, advanceRacer, tickAi,
  scheduleNextAi, standings,
} from './grand-prix/race-engine';
import { generateQuestion } from './grand-prix/questions';
import type { Racer, Question, Phase } from './grand-prix/types';

const FACTOR_MAX_BY_DIFF: Record<'easy' | 'medium' | 'hard', number> = {
  easy: 5, medium: 9, hard: 12,
};
type Difficulty = keyof typeof FACTOR_MAX_BY_DIFF;

export function MathRacerGame() {
  const paused = useGameStore((s) => s.paused);
  const triggerFlash = useGameStore((s) => s.triggerFlash);
  const triggerShake = useGameStore((s) => s.triggerShake);

  const [phase, setPhase] = useState<Phase>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [countdown, setCountdown] = useState(3);
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionNum, setQuestionNum] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [pickedAnswer, setPickedAnswer] = useState<number | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [, setUiTick] = useState(0);

  const racersRef = useRef<Racer[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const dashOffsetRef = useRef<number>(0);
  const raceStartRef = useRef<number>(0);
  const uiAccumRef = useRef<number>(0);
  const pausedRef = useRef<boolean>(false);
  pausedRef.current = paused;
  const phaseRef = useRef<Phase>('menu');
  phaseRef.current = phase;

  // ── Start race ──────────────────────────────────────────────────────
  const startRace = useCallback(() => {
    gameSounds.whoosh();
    racersRef.current = buildRacers('You');
    setQuestion(generateQuestion(1, FACTOR_MAX_BY_DIFF[difficulty]));
    setQuestionNum(1);
    setFeedback(null);
    setPickedAnswer(null);
    setCountdown(3);
    setPhase('countdown');
  }, [difficulty]);

  // ── Countdown timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'countdown' || paused) return;
    if (countdown === 0) {
      gameSounds.whoosh();
      raceStartRef.current = performance.now();
      const now = performance.now();
      for (const r of racersRef.current) if (!r.isPlayer) scheduleNextAi(r, now);
      setPhase('racing');
      return;
    }
    gameSounds.countdown();
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [phase, countdown, paused]);

  // ── Game loop (single rAF for menu canvas + race canvas) ────────────
  useEffect(() => {
    const loop = (ts: number) => {
      if (!lastFrameRef.current) lastFrameRef.current = ts;
      const dt = Math.min(50, ts - lastFrameRef.current);
      lastFrameRef.current = ts;
      const racers = racersRef.current;
      const ph = phaseRef.current;

      if ((ph === 'racing' || ph === 'countdown') && !pausedRef.current && racers.length > 0) {
        if (ph === 'racing') {
          tickAi(racers, raceStartRef.current, ts);
        }
        easeDisplay(racers, dt);
        dashOffsetRef.current = (dashOffsetRef.current + dt * 0.05) % 26;

        if (ph === 'racing' && racers.every((r) => r.finished)) {
          setPhase('results');
          gameSounds.gameOver();
        }
      }

      const canvas = canvasRef.current;
      if (canvas && (ph === 'racing' || ph === 'countdown')) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawTrack(ctx, dashOffsetRef.current);
          const indexed = racers.map((r, i) => ({ r, i }));
          indexed.sort((a, b) => a.r.displayProgress - b.r.displayProgress);
          for (const { r, i } of indexed) drawCar(ctx, r, i);
        }
      }

      uiAccumRef.current += dt;
      if (uiAccumRef.current > 120) {
        uiAccumRef.current = 0;
        setUiTick((t) => t + 1);
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Answer handler ──────────────────────────────────────────────────
  const handleAnswer = useCallback((choice: number) => {
    if (phase !== 'racing' || feedback || !question) return;
    const player = racersRef.current.find((r) => r.isPlayer);
    if (!player || player.finished) return;

    setPickedAnswer(choice);
    const correct = choice === question.answer;
    setFeedback(correct ? 'correct' : 'wrong');

    if (correct) {
      gameSounds.success();
      triggerFlash('green');
      player.correct += 1;
      const justFinished = advanceRacer(player, raceStartRef.current, performance.now());
      setConfettiKey((k) => k + 1);
      if (justFinished) gameSounds.levelUp();
    } else {
      gameSounds.fail();
      triggerShake();
      triggerFlash('red');
      player.wrong += 1;
    }

    setTimeout(() => {
      setFeedback(null);
      setPickedAnswer(null);
      if (player.finished) return;
      const nextNum = questionNum + 1;
      setQuestionNum(nextNum);
      setQuestion(generateQuestion(nextNum, FACTOR_MAX_BY_DIFF[difficulty]));
    }, 650);
  }, [phase, feedback, question, questionNum, difficulty, triggerFlash, triggerShake]);

  const restart = () => { setPhase('menu'); };

  // ── MENU SCREEN ─────────────────────────────────────────────────────
  if (phase === 'menu') {
    const DIFFS: { key: Difficulty; label: string; emoji: string; sub: string; grad: string }[] = [
      { key: 'easy',   label: 'Easy',   emoji: '😊', sub: '× up to 5',  grad: 'from-emerald-500 to-green-600' },
      { key: 'medium', label: 'Medium', emoji: '🤔', sub: '× up to 9',  grad: 'from-yellow-500 to-orange-500' },
      { key: 'hard',   label: 'Hard',   emoji: '🔥', sub: '× up to 12', grad: 'from-red-500 to-rose-600' },
    ];
    return (
      <div className="flex flex-col items-center justify-center gap-8 py-6 px-4 min-h-[80vh]">
        <motion.div
          initial={{ scale: 0.7, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
          className="text-center"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-8xl mb-3 inline-block"
          >
            🏎️
          </motion.div>
          <h1 className="text-5xl font-black text-white tracking-tight drop-shadow-2xl">Grand Prix</h1>
          <p className="text-indigo-300 mt-2 text-base font-medium">
            Answer to accelerate. First across the line wins!
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-full max-w-lg"
        >
          <p className="text-xs font-black text-indigo-300 uppercase tracking-[0.2em] mb-3 text-center">
            Difficulty
          </p>
          <div className="grid grid-cols-3 gap-3">
            {DIFFS.map((d) => {
              const active = difficulty === d.key;
              return (
                <motion.button
                  key={d.key}
                  onClick={() => { gameSounds.click(); setDifficulty(d.key); }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative flex flex-col items-center gap-1 rounded-2xl py-4 px-3 font-black border-2 transition-all
                    ${active
                      ? `bg-gradient-to-br ${d.grad} border-transparent text-white`
                      : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:border-white/30'
                    }`}
                  style={active ? { boxShadow: '0 8px 28px rgba(0,0,0,0.4)' } : {}}
                >
                  <span className="text-3xl">{d.emoji}</span>
                  <span className="text-base">{d.label}</span>
                  <span className={`text-xs font-medium ${active ? 'text-white/80' : 'text-white/40'}`}>{d.sub}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        <motion.button
          onClick={startRace}
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.96 }}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          className="rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-10 py-5 text-2xl font-black text-gray-900 shadow-2xl shadow-orange-500/40"
        >
          🏁 Start Race!
        </motion.button>
      </div>
    );
  }

  // ── RESULTS SCREEN ──────────────────────────────────────────────────
  if (phase === 'results') {
    const sorted = standings(racersRef.current);
    const playerStanding = sorted.findIndex((r) => r.isPlayer) + 1;
    const player = racersRef.current.find((r) => r.isPlayer)!;
    const accuracy = player.correct + player.wrong > 0
      ? Math.round((player.correct / (player.correct + player.wrong)) * 100)
      : 0;
    const stars = playerStanding === 1 ? 3 : playerStanding === 2 ? 2 : 1;

    return (
      <div className="flex flex-col items-center gap-6 py-6 px-4">
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14 }}
          className="text-center"
        >
          <div className="text-8xl mb-2">{playerStanding === 1 ? '🏆' : playerStanding === 2 ? '🥈' : playerStanding === 3 ? '🥉' : '🏁'}</div>
          <h2 className="text-4xl font-black text-white">
            {playerStanding === 1 ? 'Victory!' : `${ordinal(playerStanding)} Place`}
          </h2>
          <div className="flex justify-center gap-2 my-3">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2 + i * 0.15, type: 'spring', stiffness: 300 }}
              >
                <Star className={`h-10 w-10 ${i <= stars ? 'fill-yellow-400 text-yellow-400' : 'fill-white/15 text-white/15'}`} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="w-full max-w-2xl flex flex-col gap-2">
          {sorted.map((r, idx) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + idx * 0.1, type: 'spring' }}
              className={`flex items-center gap-4 rounded-2xl px-4 py-3 border-2 ${
                r.isPlayer
                  ? 'bg-yellow-400/15 border-yellow-400/50'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="text-2xl font-black text-white w-12">{ordinal(idx + 1)}</div>
              <div className="w-8 h-5 rounded" style={{ backgroundColor: carHexColor(r.color) }} />
              <div className="flex-1 font-bold text-white">{r.name} {r.isPlayer && '(You)'}</div>
              <div className="text-orange-300 font-mono font-bold">
                {r.finishTime !== null ? `${(r.finishTime / 1000).toFixed(2)}s` : 'DNF'}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="w-full max-w-2xl grid grid-cols-3 gap-3">
          <Stat label="Accuracy" value={`${accuracy}%`} color="text-emerald-300" />
          <Stat label="Correct" value={String(player.correct)} color="text-white" />
          <Stat label="Wrong" value={String(player.wrong)} color="text-red-300" />
        </div>

        <motion.button
          onClick={restart}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-10 py-4 text-xl font-black text-gray-900 shadow-2xl shadow-orange-500/40"
        >
          <RotateCcw className="h-5 w-5" /> Play Again
        </motion.button>
      </div>
    );
  }

  // ── COUNTDOWN + RACING SCREEN ───────────────────────────────────────
  const sorted = standings(racersRef.current);
  const playerStanding = sorted.findIndex((r) => r.isPlayer) + 1;
  const player = racersRef.current.find((r) => r.isPlayer);

  return (
    <div className="flex flex-col items-center gap-3 py-3 px-2 w-full">
      {/* Top HUD: position + question count */}
      <div className="flex items-center justify-between w-full max-w-3xl text-sm font-bold text-white">
        <span className="rounded-xl bg-white/10 border border-white/10 px-3 py-1.5 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-yellow-300" />
          {phase === 'racing' && player ? `Position ${playerStanding}/4` : 'Get ready...'}
        </span>
        <span className="rounded-xl bg-white/10 border border-white/10 px-3 py-1.5">
          Q {questionNum}
        </span>
        <span className="rounded-xl bg-yellow-500/20 border border-yellow-400/40 px-3 py-1.5 text-yellow-300 flex items-center gap-1.5">
          <Flag className="h-3.5 w-3.5" />
          {player ? `${player.segment}/${TOTAL_SEGMENTS}` : `0/${TOTAL_SEGMENTS}`}
        </span>
      </div>

      {/* Canvas (track + cars) */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-white/15 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={WORLD_W}
          height={WORLD_H}
          className="block max-w-full"
          style={{ width: '100%', maxWidth: WORLD_W, height: 'auto' }}
        />
        <AnimatePresence>
          {feedback === 'correct' && (
            <div className="absolute inset-0 pointer-events-none">
              <Confetti key={confettiKey} count={20} />
            </div>
          )}
        </AnimatePresence>

        {/* Countdown overlay */}
        <AnimatePresence mode="wait">
          {phase === 'countdown' && (
            <motion.div
              key={countdown}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1.1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-sm"
            >
              <div className={`text-[10rem] font-black drop-shadow-2xl ${
                countdown === 0 ? 'text-green-400' : 'text-white'
              }`}
                style={{ textShadow: '0 0 40px rgba(255,255,255,0.6)' }}
              >
                {countdown === 0 ? 'GO!' : countdown}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini standings overlay (top-right) */}
        {phase === 'racing' && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 bg-black/55 backdrop-blur-sm rounded-xl p-2 border border-white/15">
            {sorted.map((r, i) => (
              <div key={r.id} className="flex items-center gap-1.5 text-xs font-bold text-white">
                <span className="w-4 text-yellow-300">{ordinal(i + 1)}</span>
                <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: carHexColor(r.color) }} />
                <span className={`min-w-[42px] ${r.isPlayer ? 'text-yellow-300' : ''}`}>{r.name}</span>
                <span className="text-white/60">{r.segment}/{TOTAL_SEGMENTS}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Question + answer panel */}
      {phase === 'racing' && question && player && !player.finished && (
        <motion.div
          key={question.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl flex flex-col items-center gap-3"
        >
          <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-black border-2 border-white/15 px-8 py-4 shadow-2xl">
            <p className="text-5xl font-black text-white text-center" style={{ textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>
              {question.a} × {question.b} = <span className="text-yellow-300">?</span>
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl">
            {question.choices.map((c, idx) => {
              const isPicked = pickedAnswer === c;
              const isCorrect = c === question.answer;
              let cls = 'bg-gradient-to-br from-amber-400 to-yellow-500 text-gray-900 hover:from-amber-300 hover:to-yellow-400';
              let glow = 'rgba(245, 197, 24, 0.5)';
              if (feedback) {
                if (isCorrect) {
                  cls = 'bg-gradient-to-br from-emerald-400 to-green-600 text-white';
                  glow = 'rgba(74, 222, 128, 0.7)';
                } else if (isPicked) {
                  cls = 'bg-gradient-to-br from-red-500 to-rose-600 text-white';
                  glow = 'rgba(248, 113, 113, 0.6)';
                } else {
                  cls = 'bg-white/10 text-white/40';
                  glow = 'transparent';
                }
              }
              return (
                <motion.button
                  key={c}
                  onClick={() => handleAnswer(c)}
                  disabled={!!feedback}
                  whileTap={!feedback ? { scale: 0.93 } : {}}
                  whileHover={!feedback ? { scale: 1.04, y: -2 } : {}}
                  className={`rounded-2xl py-4 text-2xl font-black transition-colors shadow-xl ${cls}`}
                  style={{ boxShadow: `0 6px 22px ${glow}` }}
                >
                  <span className="text-xs opacity-60 mr-1">{idx + 1}.</span>
                  {c}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Player finished waiting state */}
      {phase === 'racing' && player?.finished && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-2xl bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-2 border-green-400/50 px-8 py-6 text-center"
        >
          <p className="text-4xl mb-1">🏁</p>
          <p className="text-2xl font-black text-white">Finished in {((player.finishTime ?? 0) / 1000).toFixed(2)}s</p>
          <p className="text-white/70 text-sm mt-1">Waiting for the rest to cross the line...</p>
        </motion.div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-white/50">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}
