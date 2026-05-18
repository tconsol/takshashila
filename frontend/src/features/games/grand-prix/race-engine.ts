import type { Racer, CarColor } from './types';

export const TOTAL_SEGMENTS = 20;

const AI_PROFILES: { name: string; color: CarColor; skill: number }[] = [
  { name: 'Blaze',   color: 'blue',   skill: 0.85 },
  { name: 'Vector',  color: 'red',    skill: 0.65 },
  { name: 'Comet',   color: 'orange', skill: 0.55 },
];

export function buildRacers(playerName: string): Racer[] {
  const racers: Racer[] = [
    {
      id: 'player',
      name: playerName || 'You',
      color: 'yellow',
      isPlayer: true,
      progress: 0,
      displayProgress: 0,
      segment: 0,
      finished: false,
      finishTime: null,
      correct: 0,
      wrong: 0,
      nextAnswerAt: null,
      skill: 1,
    },
  ];
  AI_PROFILES.forEach((p, i) => {
    racers.push({
      id: `ai-${i}`,
      name: p.name,
      color: p.color,
      isPlayer: false,
      progress: 0,
      displayProgress: 0,
      segment: 0,
      finished: false,
      finishTime: null,
      correct: 0,
      wrong: 0,
      nextAnswerAt: null,
      skill: p.skill,
    });
  });
  return racers;
}

// Schedule next AI advance. Faster skill → shorter delay.
export function scheduleNextAi(racer: Racer, now: number): void {
  if (racer.isPlayer || racer.finished) return;
  const base = 2200 - racer.skill * 1100; // skill 1.0 → 1100ms, skill 0.5 → 1650ms
  const jitter = (Math.random() - 0.5) * 900;
  racer.nextAnswerAt = now + Math.max(700, base + jitter);
}

// Apply ease toward target progress (call every frame).
export function easeDisplay(racers: Racer[], dt: number): void {
  // 0.0035 per ms feels good for a 16ms frame
  const k = 1 - Math.exp(-0.0035 * dt);
  for (const r of racers) {
    r.displayProgress += (r.progress - r.displayProgress) * k;
  }
}

// Advance a racer by one segment. Returns true if they just finished.
export function advanceRacer(racer: Racer, raceStartTime: number, now: number): boolean {
  if (racer.finished) return false;
  racer.segment += 1;
  racer.progress = racer.segment / TOTAL_SEGMENTS;
  if (racer.segment >= TOTAL_SEGMENTS) {
    racer.progress = 0.9999; // never quite snap back to 0
    racer.finished = true;
    racer.finishTime = now - raceStartTime;
    return true;
  }
  return false;
}

// AI tick: returns array of AI racers that just answered (so we can play sounds, etc.)
export function tickAi(racers: Racer[], raceStartTime: number, now: number): Racer[] {
  const advanced: Racer[] = [];
  for (const r of racers) {
    if (r.isPlayer || r.finished) continue;
    if (r.nextAnswerAt === null) {
      scheduleNextAi(r, now);
      continue;
    }
    if (now >= r.nextAnswerAt) {
      // AI mostly correct, sometimes wrong (depends on skill)
      const willGetCorrect = Math.random() < (0.7 + r.skill * 0.25);
      if (willGetCorrect) {
        r.correct += 1;
        advanceRacer(r, raceStartTime, now);
        advanced.push(r);
      } else {
        r.wrong += 1;
      }
      scheduleNextAi(r, now);
    }
  }
  return advanced;
}

export function standings(racers: Racer[]): Racer[] {
  return [...racers].sort((a, b) => {
    if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0);
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
}
