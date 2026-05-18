export type CarColor = 'yellow' | 'blue' | 'red' | 'orange';

export interface Racer {
  id: string;
  name: string;
  color: CarColor;
  isPlayer: boolean;
  progress: number;          // 0..1 around the circuit (target)
  displayProgress: number;   // current eased position for rendering
  segment: number;           // how many correct answers (0..TOTAL_SEGMENTS)
  finished: boolean;
  finishTime: number | null; // ms elapsed when finished
  correct: number;
  wrong: number;
  // AI only
  nextAnswerAt: number | null;
  skill: number;             // 0..1 — higher = answers faster + more accurate
}

export interface Question {
  id: number;
  a: number;
  b: number;
  answer: number;
  choices: number[];
}

export type Phase = 'menu' | 'countdown' | 'racing' | 'results';

export interface RaceConfig {
  totalSegments: number;
  factorMax: number;     // 1..N for both factors
}
