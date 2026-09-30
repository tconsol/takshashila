import { US_STATES } from './us-states';

const BY_NAME = new Map<string, string>(US_STATES.map((s) => [s.name.toLowerCase(), s.code]));

export function stateCodeFromName(name: string): string | null {
  return BY_NAME.get(name.trim().toLowerCase()) ?? null;
}
