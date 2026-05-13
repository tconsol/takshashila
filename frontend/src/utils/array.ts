export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce<Record<string, T[]>>((acc, item) => {
    const group = String(item[key]);
    (acc[group] ??= []).push(item);
    return acc;
  }, {});
}

export function sortBy<T>(array: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return direction === 'asc' ? cmp : -cmp;
  });
}

export function unique<T>(array: T[], key?: keyof T): T[] {
  if (!key) return [...new Set(array)];
  const seen = new Set<unknown>();
  return array.filter((item) => {
    const k = item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function sum(array: number[]): number {
  return array.reduce((acc, n) => acc + n, 0);
}

export function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
