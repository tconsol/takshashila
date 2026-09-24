import { US_STATE_CODES } from '../modules/geo/us-states';

export interface UsDistrictRow {
  id: string;
  name: string;
  state: string;
  countyFips: string;
}

type DropReason = 'state' | 'type' | 'status' | 'noSchools' | 'county';

// 1 = regular district, 2 = regular district that is a supervisory-union component.
const KEEP_TYPES = new Set(['1', '2']);
// 1 Open, 3 New, 4 Added, 5 Changed boundary, 8 Reopened. Drops Closed/Inactive/Future.
const KEEP_STATUS = new Set(['1', '3', '4', '5', '8']);

/** Minimal RFC-4180 line splitter: commas, double-quoted fields, "" escapes. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out;
}

/**
 * Joins the CCD LEA directory (type/status/name) with the EDGE LEA geocode file
 * (county) on LEAID. Pure — the caller does the file I/O.
 */
export function buildDistricts(ccdCsv: string, edgeTxt: string, knownCountyFips: Set<string>) {
  const countyByLeaid = new Map<string, string>();
  for (const line of edgeTxt.split(/\r?\n/)) {
    const cols = line.split('|');
    // No header row; skip anything that isn't a data line.
    if (!/^\d{7}$/.test(cols[0]?.trim() ?? '')) continue;
    countyByLeaid.set(cols[0].trim(), (cols[8] ?? '').trim());
  }

  const [header, ...rows] = ccdCsv.split(/\r?\n/).filter((l) => l.trim());
  const cols = parseCsvLine(header).map((c) => c.trim());
  const col = (name: string) => {
    const i = cols.indexOf(name);
    if (i < 0) throw new Error(`CCD file is missing column ${name}`);
    return i;
  };
  const iId = col('LEAID');
  const iName = col('LEA_NAME');
  const iSt = col('ST');
  const iType = col('LEA_TYPE');
  const iStatus = col('SY_STATUS');
  const iSchools = col('OPERATIONAL_SCHOOLS');

  const states = new Set<string>(US_STATE_CODES);
  const dropped: Record<DropReason, number> = { state: 0, type: 0, status: 0, noSchools: 0, county: 0 };
  const districts: UsDistrictRow[] = [];

  for (const line of rows) {
    const c = parseCsvLine(line).map((v) => v.trim());
    if (!states.has(c[iSt])) { dropped.state++; continue; }
    if (!KEEP_TYPES.has(c[iType])) { dropped.type++; continue; }
    if (!KEEP_STATUS.has(c[iStatus])) { dropped.status++; continue; }
    if (!(Number(c[iSchools]) > 0)) { dropped.noSchools++; continue; }
    const countyFips = countyByLeaid.get(c[iId]);
    if (!countyFips || !knownCountyFips.has(countyFips)) { dropped.county++; continue; }
    districts.push({ id: c[iId], name: c[iName], state: c[iSt], countyFips });
  }

  districts.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
  return { districts, dropped };
}
