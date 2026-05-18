import type { Question } from './types';

export function generateQuestion(id: number, factorMax: number): Question {
  const a = 1 + Math.floor(Math.random() * factorMax);
  const b = 1 + Math.floor(Math.random() * factorMax);
  const answer = a * b;

  const set = new Set<number>([answer]);
  let attempts = 0;
  while (set.size < 4 && attempts < 50) {
    attempts++;
    // Plausible wrong: nearby multiples
    const variant = Math.floor(Math.random() * 4);
    let candidate: number;
    if (variant === 0)      candidate = a * (b + 1);
    else if (variant === 1) candidate = a * Math.max(1, b - 1);
    else if (variant === 2) candidate = (a + 1) * b;
    else                    candidate = Math.max(1, a - 1) * b;
    if (candidate !== answer && candidate > 0) set.add(candidate);
  }
  // Fill remaining with small offsets in case loop bailed early
  while (set.size < 4) {
    const offset = (Math.floor(Math.random() * 6) + 1) * (Math.random() < 0.5 ? -1 : 1);
    const v = answer + offset;
    if (v > 0 && !set.has(v)) set.add(v);
  }

  const choices = [...set].sort(() => Math.random() - 0.5);
  return { id, a, b, answer, choices };
}

export function buildQuestionBank(count: number, factorMax: number): Question[] {
  return Array.from({ length: count }, (_, i) => generateQuestion(i + 1, factorMax));
}
