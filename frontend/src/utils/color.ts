const PALETTE = [
  'bg-red-100 text-red-700',
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-700',
  'bg-green-100 text-green-700',
  'bg-teal-100 text-teal-700',
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function attendanceColor(rate: number): string {
  if (rate >= 75) return 'text-green-600';
  if (rate >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

export function scoreColor(score: number, max: number): string {
  const pct = (score / max) * 100;
  if (pct >= 80) return 'text-green-600';
  if (pct >= 50) return 'text-yellow-600';
  return 'text-red-600';
}
