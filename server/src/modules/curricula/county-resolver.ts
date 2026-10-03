import { geoService, type UsCounty } from '../geo/geo.service';

/** Words that differ between how the state files name a county and how the Census gazetteer does. */
const NOISE = /\b(county|counties|borough|municipality|census area|city and|parish|of|the|schools?|public|school district|district|isd|unified)\b/g;

const normalize = (s: string): string =>
  s.toLowerCase().replace(NOISE, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Finds the county a state file's heading refers to. Headings look like "Fulton County Schools",
 * "Denver County – Denver Public Schools" or "Municipality of Anchorage – Anchorage School District";
 * the part before the dash is the county. Returns undefined when nothing matches exactly, so a wrong
 * county is never guessed (an admin can link the record by hand).
 */
export function resolveCounty(stateCode: string, label: string): UsCounty | undefined {
  const counties = geoService.listCounties(stateCode);
  if (!counties) return undefined;
  const head = normalize(label.split(/\s[–—-]\s/)[0]);
  if (!head) return undefined;
  const hits = counties.filter((c) => normalize(c.name) === head);
  return hits.length === 1 ? hits[0] : undefined;
}
