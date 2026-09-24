import { geoService, type UsCounty } from '../modules/geo/geo.service';
import { US_STATES } from '../modules/geo/us-states';

export type CountyResolution =
  | { status: 'resolved'; county: UsCounty }
  | { status: 'ambiguous'; candidates: UsCounty[] }
  | { status: 'unmatched' };

const SUFFIX = /\s+(county|parish|borough|city and borough|census area|municipality|municipio|city)$/;
const STATE_CODES = new Set<string>(US_STATES.map((s) => s.code));

/** "Fairfax County" → "fairfax"; "St. Louis city" → "st louis". */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(SUFFIX, '')
    .trim();
}

let index: Map<string, UsCounty[]> | null = null;
function byNormalizedName(): Map<string, UsCounty[]> {
  if (index) return index;
  index = new Map();
  for (const state of US_STATES) {
    for (const c of geoService.listCounties(state.code) ?? []) {
      const key = normalize(c.name);
      index.set(key, [...(index.get(key) ?? []), c]);
    }
  }
  return index;
}

/**
 * Maps a legacy free-text county ("Fairfax", "Fairfax County, VA", "Orleans Parish LA")
 * to a Census county. A trailing USPS code in the text wins over `stateHint`.
 */
export function resolveLegacyCounty(raw: string, stateHint?: string): CountyResolution {
  let text = raw.trim();
  let state = stateHint?.toUpperCase();

  const trailing = text.match(/[,\s]+([A-Za-z]{2})$/);
  if (trailing && STATE_CODES.has(trailing[1].toUpperCase())) {
    state = trailing[1].toUpperCase();
    text = text.slice(0, trailing.index);
  }

  const key = normalize(text);
  if (!key) return { status: 'unmatched' };

  let candidates = byNormalizedName().get(key) ?? [];
  if (state) candidates = candidates.filter((c) => c.state === state);

  if (candidates.length === 1) return { status: 'resolved', county: candidates[0] };
  if (candidates.length > 1) return { status: 'ambiguous', candidates };
  return { status: 'unmatched' };
}
