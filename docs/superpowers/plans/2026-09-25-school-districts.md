# School Districts + "All grades" Course Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope every Course to an NCES school district + grade, let students set their district, and give the student Courses page "My grade" / "All grades" tabs.

**Architecture:** NCES district reference data is built offline into a static `us-districts.json` served by the existing `geoService` / `/geo` routes. Courses take a `districtId` and the server derives `state/countyFips/county/district` from it. The student catalog is keyed by `districtId`, with `grade` optional ("All grades"). The frontend `LocationSelect` gains a 4th District dropdown.

**Tech Stack:** Express + Mongoose + Zod + Jest/ts-jest/supertest (server); React + TanStack Query + react-hook-form + Tailwind (frontend).

**Spec:** `docs/superpowers/specs/2026-09-25-school-districts-design.md`

## Global Constraints

- District data source (pinned): NCES CCD LEA directory 2023-24 `ccd_lea_029_2324_w_1a_073124.csv` (https://nces.ed.gov/ccd/Data/zip/ccd_lea_029_2324_w_1a_073124.zip) + NCES EDGE `EDGE_GEOCODE_PUBLICLEA_2324.TXT` (https://nces.ed.gov/programs/edge/data/EDGE_GEOCODE_PUBLICLEA_2324.zip). EDGE TXT is pipe-delimited, **no header**, col 0 = LEAID, col 8 = county FIPS.
- Keep: `ST` in 50 states + DC; `LEA_TYPE` in {1, 2}; `SY_STATUS` in {1 Open, 3 New, 4 Added, 5 Changed Boundary, 8 Reopened}; `OPERATIONAL_SCHOOLS` > 0; EDGE county known to `us-counties.json`. Expected ≈ 13,215 districts.
- District `id` = 7-digit NCES LEAID **string** (leading zeros kept, e.g. `0100005`).
- District is **required** on Course, **optional** on Student profile. Location fields on Course are derived server-side from `districtId`; clients never send them for courses.
- Validation failures use the codebase's `ValidationError` → **HTTP 422** (the spec's "400" is read as the codebase's validation status). Unknown state on geo routes → 404.
- "All grades" = the student's own district only. Students may request courses from any grade.
- Grade order is `GRADE_LIST` from `server/src/modules/students/student.validators.ts` (server) and `frontend/src/constants/grades.ts` (frontend) — no new grades file (spec 4.6 satisfied by the existing list).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run server commands from `server/`, frontend from `frontend/`. Tests: `npx jest <path>`; types: `npx tsc --noEmit -p .`.

## Review Focus

1. LEAIDs with leading zeros (Alabama `0100005`) must survive parsing and lookup as strings — Task 1 test.
2. A student who changes county **without** picking a district must not keep a stale `districtId` from the old county — Task 4 test.
3. A profile update sending a `districtId` that isn't in the sent `countyFips` must be rejected, not silently saved — Task 4 test.
4. "All grades" must order `Grade 9` before `Grade 10` (not string order) — Task 3 test.
5. A student calling the catalog with no `districtId` must get 422, never an unscoped list of every district's courses — Task 3 test.

---

## File Structure

Server:
- Create `src/scripts/us-districts-builder.ts` — pure CSV/TXT → district rows (tested).
- Create `src/scripts/build-us-districts.ts` — file I/O wrapper for the builder.
- Create `src/modules/geo/us-districts.json` — generated data.
- Modify `src/modules/geo/geo.service.ts` — `listDistricts`, `getDistrict`.
- Modify `src/modules/geo/geo.routes.ts` — districts route.
- Modify `src/modules/geo/geo.validators.ts` — `districtIdSchema`.
- Modify `src/modules/courses/course.{model,types,validators,service,controller}.ts`.
- Modify `src/modules/students/student.{model,types,validators,service}.ts`.
- Create `src/scripts/resolve-course-district.ts`, `src/scripts/migrate-course-districts.ts`.
- Tests in `src/tests/modules/`.

Frontend:
- Modify `src/services/geo.service.ts`, `src/hooks/use-geo.ts`, `src/components/shared/LocationSelect.tsx`.
- Modify `src/services/courses.service.ts`, `src/hooks/use-courses.ts`, `src/services/students.service.ts`.
- Modify `src/pages/admin/AdminCurriculumPage.tsx`, `src/pages/shared/ProfilePage.tsx`, `src/pages/student/StudentCoursesPage.tsx`.

---

### Task 1: District builder + generated data

**Files:**
- Create: `server/src/scripts/us-districts-builder.ts`
- Create: `server/src/scripts/build-us-districts.ts`
- Create: `server/src/modules/geo/us-districts.json` (generated)
- Test: `server/src/tests/modules/us-districts-builder.test.ts`

**Interfaces:**
- Produces: `buildDistricts(ccdCsv: string, edgeTxt: string, knownCountyFips: Set<string>): { districts: UsDistrictRow[]; dropped: Record<DropReason, number> }`, `parseCsvLine(line: string): string[]`, `interface UsDistrictRow { id: string; name: string; state: string; countyFips: string }`. JSON file is `UsDistrictRow[]` sorted by state, then name.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/modules/us-districts-builder.test.ts
import { buildDistricts, parseCsvLine } from '../../scripts/us-districts-builder';

const HEADER = 'SCHOOL_YEAR,ST,LEA_NAME,LEAID,SY_STATUS,LEA_TYPE,OPERATIONAL_SCHOOLS';
const ccd = [
  HEADER,
  '2023-2024,AL,Albertville City,0100005,1,1,6',          // kept (leading zero)
  '2023-2024,NC,Wake County Schools,3704720,1,1,200',     // kept
  '2023-2024,NC,"Smith, Jones Academy",3700043,1,7,1',    // charter type → dropped
  '2023-2024,NC,Closed District,3700001,2,1,3',           // closed → dropped
  '2023-2024,NC,Empty District,3700002,1,1,0',            // no schools → dropped
  '2023-2024,PR,Puerto Rico Dept,7200030,1,1,800',        // territory → dropped
  '2023-2024,NC,Unknown County District,3700003,1,2,4',   // county not in gazetteer → dropped
].join('\n');

const edge = [
  '0100005|Albertville City|01|x|x|AL|35950|01|01095|Marshall County',
  '3704720|Wake County Schools|37|x|x|NC|27518|37|37183|Wake County',
  '3700043|Smith|37|x|x|NC|1|37|37183|Wake County',
  '3700001|Closed|37|x|x|NC|1|37|37183|Wake County',
  '3700002|Empty|37|x|x|NC|1|37|37183|Wake County',
  '7200030|PR|72|x|x|PR|1|72|72127|San Juan',
  '3700003|Unknown|37|x|x|NC|1|37|37999|Nowhere',
].join('\r\n');

const known = new Set(['01095', '37183', '72127']);

describe('parseCsvLine', () => {
  it('splits on commas and honours quoted fields with commas and escaped quotes', () => {
    expect(parseCsvLine('a,"b, c","d ""q"" e",')).toEqual(['a', 'b, c', 'd "q" e', '']);
  });
});

describe('buildDistricts', () => {
  it('keeps only open regular districts in the 50 states + DC with a known county', () => {
    const { districts, dropped } = buildDistricts(ccd, edge, known);
    expect(districts).toEqual([
      { id: '0100005', name: 'Albertville City', state: 'AL', countyFips: '01095' },
      { id: '3704720', name: 'Wake County Schools', state: 'NC', countyFips: '37183' },
    ]);
    expect(dropped).toEqual({ state: 1, type: 1, status: 1, noSchools: 1, county: 1 });
  });

  it('keeps LEAIDs as 7-char strings with leading zeros', () => {
    const { districts } = buildDistricts(ccd, edge, known);
    expect(districts[0].id).toBe('0100005');
    expect(typeof districts[0].id).toBe('string');
  });

  it('throws on a CCD file missing a required column', () => {
    expect(() => buildDistricts('LEAID,ST\n0100005,AL', edge, known)).toThrow(/LEA_NAME/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/modules/us-districts-builder`
Expected: FAIL — `Cannot find module '../../scripts/us-districts-builder'`.

- [ ] **Step 3: Write the builder**

```ts
// server/src/scripts/us-districts-builder.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/tests/modules/us-districts-builder`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the I/O script**

```ts
// server/src/scripts/build-us-districts.ts
/**
 * Regenerates src/modules/geo/us-districts.json from two NCES files.
 * Not used at runtime — run it only when refreshing the data.
 *
 * Sources (2023-24):
 *   CCD LEA directory: https://nces.ed.gov/ccd/Data/zip/ccd_lea_029_2324_w_1a_073124.zip
 *   EDGE LEA geocodes: https://nces.ed.gov/programs/edge/data/EDGE_GEOCODE_PUBLICLEA_2324.zip
 *
 * Usage: npx ts-node src/scripts/build-us-districts.ts <ccd_lea_029_....csv> <EDGE_GEOCODE_PUBLICLEA_....TXT>
 */
import fs from 'fs';
import path from 'path';
import usCounties from '../modules/geo/us-counties.json';
import { buildDistricts } from './us-districts-builder';

const [ccdPath, edgePath] = process.argv.slice(2);
if (!ccdPath || !edgePath) {
  console.error('Usage: ts-node src/scripts/build-us-districts.ts <ccd.csv> <edge.txt>');
  process.exit(1);
}

// NCES files are Windows-1252; latin1 decodes every byte without throwing.
const ccd = fs.readFileSync(ccdPath, 'latin1');
const edge = fs.readFileSync(edgePath, 'latin1');
const known = new Set((usCounties as Array<{ fips: string }>).map((c) => c.fips));

const { districts, dropped } = buildDistricts(ccd, edge, known);
const outPath = path.join(__dirname, '../modules/geo/us-districts.json');
fs.writeFileSync(outPath, JSON.stringify(districts) + '\n');
console.log(`Wrote ${districts.length} districts to ${outPath}`);
console.log('Dropped:', dropped);
```

- [ ] **Step 6: Generate the data**

Download and unzip both files (URLs above) into a temp dir, then:
Run: `npx ts-node src/scripts/build-us-districts.ts <tmp>/ccd_lea_029_2324_w_1a_073124.csv <tmp>/EDGE_GEOCODE_PUBLICLEA_2324.TXT`
Expected: `Wrote 13215 districts` (±50), and `dropped.county` is 0.
Spot check: `grep -o '{"id":"3704720"[^}]*}' src/modules/geo/us-districts.json` → `{"id":"3704720","name":"Wake County Schools","state":"NC","countyFips":"37183"}`.

- [ ] **Step 7: Commit**

```bash
git add server/src/scripts/us-districts-builder.ts server/src/scripts/build-us-districts.ts server/src/modules/geo/us-districts.json server/src/tests/modules/us-districts-builder.test.ts
git commit -m "feat: build NCES school district reference data"
```

---

### Task 2: geoService districts, `/geo` districts route, `districtIdSchema`

**Files:**
- Modify: `server/src/modules/geo/geo.service.ts`
- Modify: `server/src/modules/geo/geo.routes.ts`
- Modify: `server/src/modules/geo/geo.validators.ts`
- Test: `server/src/tests/modules/geo.service.test.ts`, `server/src/tests/modules/geo.routes.test.ts`

**Interfaces:**
- Consumes: `us-districts.json` (Task 1).
- Produces: `interface UsDistrict { id; name; state; countyFips }` exported from `geo.service.ts`; `geoService.listDistricts(stateCode: string, countyFips?: string): UsDistrict[] | null`; `geoService.getDistrict(id: string): UsDistrict | undefined`; `districtIdSchema` (Zod string, 7 digits, must exist) exported from `geo.validators.ts`; `GET /api/v1/geo/states/:stateCode/districts?countyFips=`.

- [ ] **Step 1: Write failing tests** — append to `geo.service.test.ts` inside `describe('GeoService', ...)`:

```ts
  it('lists a state\'s districts sorted by name, optionally narrowed to a county', () => {
    const nc = geoService.listDistricts('NC')!;
    expect(nc.length).toBeGreaterThan(100);
    expect(nc.every((d) => d.state === 'NC')).toBe(true);
    const names = nc.map((d) => d.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

    expect(geoService.listDistricts('NC', '37183')).toEqual([
      { id: '3704720', name: 'Wake County Schools', state: 'NC', countyFips: '37183' },
    ]);
    expect(geoService.listDistricts('CA', '06037')!.length).toBeGreaterThan(50);
  });

  it('returns null districts for an unknown state and finds districts by id (leading zeros kept)', () => {
    expect(geoService.listDistricts('ZZ')).toBeNull();
    expect(geoService.getDistrict('0100005')).toEqual(expect.objectContaining({ state: 'AL', name: 'Albertville City' }));
    expect(geoService.getDistrict('100005')).toBeUndefined();
  });
```

And append a `describe` to `geo.validators` coverage in the same file:

```ts
import { districtIdSchema } from '../../modules/geo/geo.validators';

describe('districtIdSchema', () => {
  it('accepts a known district and rejects malformed or unknown ids', () => {
    expect(districtIdSchema.safeParse('3704720').success).toBe(true);
    expect(districtIdSchema.safeParse('37047').success).toBe(false);
    expect(districtIdSchema.safeParse('9999999').success).toBe(false);
  });
});
```

Append to `geo.routes.test.ts` inside `describe('GET /geo', ...)`:

```ts
  it('lists districts for a state, filters by county, 404s an unknown state, 422s a county outside the state', async () => {
    const all = await request(app).get('/api/v1/geo/states/nc/districts');
    expect(all.status).toBe(200);
    expect(all.body.data.length).toBeGreaterThan(100);

    const wake = await request(app).get('/api/v1/geo/states/NC/districts?countyFips=37183');
    expect(wake.status).toBe(200);
    expect(wake.body.data).toEqual([{ id: '3704720', name: 'Wake County Schools', state: 'NC', countyFips: '37183' }]);

    expect((await request(app).get('/api/v1/geo/states/ZZ/districts')).status).toBe(404);
    expect((await request(app).get('/api/v1/geo/states/VA/districts?countyFips=37183')).status).toBe(422);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/tests/modules/geo`
Expected: FAIL — `geoService.listDistricts is not a function`, `districtIdSchema` undefined, route 404.

- [ ] **Step 3: Implement geoService** — edit `geo.service.ts`:

```ts
import usCounties from './us-counties.json';
import usDistricts from './us-districts.json';
import { US_STATES, COUNTRIES } from './us-states';

export interface UsCounty {
  fips: string;
  name: string;
  state: string;
}

/** NCES school district; `id` is the 7-digit LEAID (string — leading zeros matter). */
export interface UsDistrict {
  id: string;
  name: string;
  state: string;
  countyFips: string;
}

/** Static US geography, loaded once. Data: US Census county gazetteer
 *  (regenerate with src/scripts/build-us-counties.ts) and NCES districts
 *  (regenerate with src/scripts/build-us-districts.ts). */
class GeoService {
  private readonly byFips = new Map<string, UsCounty>();
  private readonly byState = new Map<string, UsCounty[]>();
  private readonly districtById = new Map<string, UsDistrict>();
  private readonly districtsByState = new Map<string, UsDistrict[]>();

  constructor() {
    for (const c of usCounties as UsCounty[]) {
      this.byFips.set(c.fips, c);
      const list = this.byState.get(c.state) ?? [];
      list.push(c);
      this.byState.set(c.state, list);
    }
    for (const list of this.byState.values()) list.sort((a, b) => a.name.localeCompare(b.name));

    for (const d of usDistricts as UsDistrict[]) {
      this.districtById.set(d.id, d);
      const list = this.districtsByState.get(d.state) ?? [];
      list.push(d);
      this.districtsByState.set(d.state, list);
    }
    for (const list of this.districtsByState.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ...listCountries / listStates / listCounties / getCounty unchanged...

  /** null when the state code is unknown. */
  listDistricts(stateCode: string, countyFips?: string): UsDistrict[] | null {
    if (!US_STATES.some((s) => s.code === stateCode)) return null;
    const list = this.districtsByState.get(stateCode) ?? [];
    return countyFips ? list.filter((d) => d.countyFips === countyFips) : list;
  }

  getDistrict(id: string): UsDistrict | undefined {
    return this.districtById.get(id);
  }
}
```

- [ ] **Step 4: Implement route** — in `geo.routes.ts` add import `ValidationError` from `'../../utils/error'` alongside `NotFoundError`, and before `export default router;`:

```ts
router.get('/states/:stateCode/districts', (req, res, next) => {
  const stateCode = req.params.stateCode.toUpperCase();
  const countyFips = typeof req.query.countyFips === 'string' ? req.query.countyFips : undefined;
  const districts = geoService.listDistricts(stateCode, countyFips);
  if (!districts) return next(new NotFoundError('State'));
  if (countyFips && geoService.getCounty(countyFips)?.state !== stateCode) {
    return next(new ValidationError({ countyFips: [`County ${countyFips} is not in state ${stateCode}`] }));
  }
  sendSuccess(res, districts, 'Districts fetched');
});
```

- [ ] **Step 5: Implement `districtIdSchema`** — append to `geo.validators.ts`:

```ts
/** NCES LEAID of a district in us-districts.json. Services derive every other
 *  location field from it. */
export const districtIdSchema = z
  .string()
  .regex(/^\d{7}$/, 'District id must be 7 digits')
  .refine((id) => !!geoService.getDistrict(id), { message: 'Unknown school district' });
```

- [ ] **Step 6: Run to verify pass**

Run: `npx jest src/tests/modules/geo`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/modules/geo server/src/tests/modules/geo.service.test.ts server/src/tests/modules/geo.routes.test.ts
git commit -m "feat: serve school districts from geoService and /geo route"
```

---

### Task 3: Course scoped by district; catalog with optional grade

**Files:**
- Modify: `server/src/modules/courses/course.model.ts`, `course.types.ts`, `course.validators.ts`, `course.service.ts`, `course.controller.ts`
- Test: `server/src/tests/modules/course.model.test.ts`, `course.service.test.ts`, `course.controller.test.ts`, `geo.routes.test.ts` (the `POST /courses location validation` block), `course-request.service.test.ts`

**Interfaces:**
- Consumes: `geoService.getDistrict`, `geoService.getCounty`, `districtIdSchema` (Task 2); `GRADE_LIST` from `students/student.validators.ts`.
- Produces: `ICourse.districtId: string`, `ICourse.district: string`; `CreateCourseDto = { districtId, grade, subject, title, description?, topics }`; `courseService.listCatalog(filters: { districtId: string; grade?: string; subject?: string }): Promise<ICourse[]>` sorted by grade order then title; `studentCatalogQuerySchema`; admin list accepts `districtId` filter. Student `GET /courses` requires `districtId` (422 without).

- [ ] **Step 1: Update model test** — in `course.model.test.ts`, add `districtId: '3704720', district: 'Wake County Schools',` to the valid course, and change the required-fields test to:

```ts
  it('requires districtId, district, state, countyFips, county, grade, subject and title', () => {
    const doc = new CourseModel({ publicId: 'course-2', createdByAdminPublicId: 'admin-1', topics: [] });
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(Object.keys(err!.errors)).toEqual(
      expect.arrayContaining(['districtId', 'district', 'state', 'countyFips', 'county', 'grade', 'subject', 'title']),
    );
  });
```

- [ ] **Step 2: Replace service tests** — replace the body of `course.service.test.ts` with:

```ts
import { courseService } from '../../modules/courses/course.service';
import { CourseModel } from '../../modules/courses/course.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const catalogChain = (v: unknown) => ({ sort: () => ({ limit: () => lean(v) }) });

describe('CourseService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('create() derives every location field from the district', async () => {
    const created = { toObject: () => ({ publicId: 'course-1', title: 'Algebra I' }) };
    const createSpy = jest.spyOn(CourseModel, 'create').mockResolvedValue(created as never);

    const result = await courseService.create('admin-user-1', {
      districtId: '3704720',
      grade: 'Grade 8',
      subject: 'Mathematics',
      title: 'Algebra I',
      topics: [],
    } as never);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        createdByAdminPublicId: 'admin-user-1',
        isPublished: false,
        country: 'US',
        state: 'NC',
        countyFips: '37183',
        county: 'Wake County',
        districtId: '3704720',
        district: 'Wake County Schools',
      }),
    );
    expect(result.title).toBe('Algebra I');
  });

  it('create() rejects an unknown district', async () => {
    await expect(
      courseService.create('admin-user-1', { districtId: '9999999', grade: 'Grade 8', subject: 'M', title: 'T', topics: [] } as never),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('update() re-derives location when the district changes', async () => {
    const updateSpy = jest.spyOn(CourseModel, 'findOneAndUpdate').mockReturnValue(lean({ publicId: 'course-1' }) as never);

    await courseService.update('course-1', { districtId: '5101260' } as never);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.anything(),
      {
        $set: expect.objectContaining({
          state: 'VA', countyFips: '51059', county: 'Fairfax County',
          districtId: '5101260', district: 'Fairfax County Public Schools',
        }),
      },
      expect.anything(),
    );
  });

  it('listCatalog() filters by district and grade when grade is given', async () => {
    const findSpy = jest.spyOn(CourseModel, 'find').mockReturnValue(catalogChain([]) as never);

    await courseService.listCatalog({ districtId: '3704720', grade: 'Grade 8' });

    expect(findSpy).toHaveBeenCalledWith({ districtId: '3704720', grade: 'Grade 8', isPublished: true, isDeleted: false });
  });

  it('listCatalog() without grade returns all grades, ordered Grade 9 before Grade 10, then by title', async () => {
    const findSpy = jest.spyOn(CourseModel, 'find').mockReturnValue(
      catalogChain([
        { title: 'A', grade: 'Grade 10' },
        { title: 'B', grade: 'Grade 9' },
        { title: 'A', grade: 'Grade 9' },
        { title: 'Z', grade: 'Grade 1' },
      ]) as never,
    );

    const result = await courseService.listCatalog({ districtId: '3704720' });

    expect(findSpy).toHaveBeenCalledWith({ districtId: '3704720', isPublished: true, isDeleted: false });
    expect(result.map((c) => `${c.grade}/${c.title}`)).toEqual(['Grade 1/Z', 'Grade 9/A', 'Grade 9/B', 'Grade 10/A']);
  });
});
```

- [ ] **Step 3: Update controller tests** — in `course.controller.test.ts`, change the STUDENT test's request to `buildReq('STUDENT', { districtId: '3704720' })`, and add:

```ts
  it('rejects a STUDENT catalog request without districtId (never an unscoped list)', async () => {
    const catalogSpy = jest.spyOn(courseService, 'listCatalog').mockResolvedValue([] as never);
    const next = jest.fn();

    await courseController.list(buildReq('STUDENT'), buildRes(), next);

    expect(catalogSpy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 422 }));
  });

  it('passes districtId and optional grade through to listCatalog', async () => {
    const catalogSpy = jest.spyOn(courseService, 'listCatalog').mockResolvedValue([] as never);

    await courseController.list(buildReq('STUDENT', { districtId: '3704720' }), buildRes(), jest.fn());

    expect(catalogSpy).toHaveBeenCalledWith({ districtId: '3704720' });
  });
```

- [ ] **Step 4: Update route validation tests** — in `geo.routes.test.ts`, replace the two tests inside `describe('POST /courses location validation', ...)` that send `state/countyFips` with:

```ts
  it('422s an unknown district', async () => {
    const createSpy = jest.spyOn(courseService, 'create');
    const res = await request(app).post('/api/v1/courses').send({ ...body, districtId: '9999999' });
    expect(res.status).toBe(422);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('accepts a valid district and strips client-sent location fields', async () => {
    const createSpy = jest.spyOn(courseService, 'create').mockResolvedValue({ publicId: 'c-1' } as never);
    const res = await request(app).post('/api/v1/courses').send({ ...body, districtId: '3704720', state: 'VA', countyFips: '51059' });
    expect(res.status).toBe(201);
    const dto = createSpy.mock.calls[0][1] as unknown as Record<string, unknown>;
    expect(dto.districtId).toBe('3704720');
    expect(dto.state).toBeUndefined();
    expect(dto.countyFips).toBeUndefined();
  });
```

(Keep any other test in that block that doesn't depend on `state/countyFips`; delete ones that assert county validation for courses.)

- [ ] **Step 5: Add cross-grade request test** — in `course-request.service.test.ts` inside `describe('create', ...)`:

```ts
    it('allows requesting a course from a different grade than the student\'s', async () => {
      jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'student-prof-1', grade: 'Grade 6' } as never);
      jest.spyOn(courseService, 'getByPublicId').mockResolvedValue(baseCourse({ grade: 'Grade 10' }) as never);
      jest.spyOn(tutorService, 'getByPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(null) as never);
      const createSpy = jest.spyOn(CourseRequestModel, 'create').mockResolvedValue({ toObject: () => baseRequest() } as never);
      jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

      await courseRequestService.create('student-user-1', baseCreateDto());

      expect(createSpy).toHaveBeenCalledTimes(1);
    });
```

- [ ] **Step 6: Run to verify failures**

Run: `npx jest src/tests/modules/course src/tests/modules/geo.routes`
Expected: FAIL on districtId-related assertions (the cross-grade request test already passes — it pins existing behaviour).

- [ ] **Step 7: Model + types**

`course.types.ts` — add to `ICourse` after `county: string;`:

```ts
  districtId: string; // NCES LEAID; state/countyFips/county/district are derived from it
  district: string;
```

`course.model.ts` — add after the `county` field:

```ts
    districtId: { type: String, required: true, index: true },
    district: { type: String, required: true }, // display name, derived from districtId
```

and replace the compound index line with:

```ts
courseSchema.index({ districtId: 1, grade: 1, isPublished: 1 });
```

- [ ] **Step 8: Validators** — replace `course.validators.ts` from the imports through `updateCourseSchema`/`courseCatalogQuerySchema`:

```ts
import { z } from 'zod';
import { GRADE_LIST } from '../students/student.validators';
import { districtIdSchema } from '../geo/geo.validators';

const topicInputSchema = z.object({
  publicId: z.string().optional(), // present when editing an existing topic
  title: z.string().min(1).max(200),
  order: z.number().int().min(0),
  resourceIds: z.array(z.string()).default([]),
  assignmentIds: z.array(z.string()).default([]),
  worksheetIds: z.array(z.string()).default([]),
});

/** Location is never accepted from clients: the service derives state/county/district
 *  names from `districtId`, and Zod strips any other location keys sent. */
const courseBaseSchema = z.object({
  districtId: districtIdSchema,
  grade: z.enum(GRADE_LIST),
  subject: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  topics: z.array(topicInputSchema).default([]),
});

export const createCourseSchema = courseBaseSchema;

export const updateCourseSchema = courseBaseSchema.partial();

export const courseCatalogQuerySchema = z.object({
  state: z.string().optional(),
  countyFips: z.string().optional(),
  districtId: z.string().optional(),
  grade: z.string().optional(),
  subject: z.string().optional(),
  isPublished: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** Student catalog: always district-scoped; no grade = "All grades". */
export const studentCatalogQuerySchema = z.object({
  districtId: districtIdSchema,
  grade: z.enum(GRADE_LIST).optional(),
  subject: z.string().optional(),
});
```

(Keep the three `export type ... = z.infer<...>` lines; add `export type StudentCatalogQueryDto = z.infer<typeof studentCatalogQuerySchema>;`.)

- [ ] **Step 9: Service** — in `course.service.ts`:

Imports: add `import { GRADE_LIST } from '../students/student.validators';` and add `StudentCatalogQueryDto` to the validators type import.

In `create`, replace the four location lines (`country` … `county: countyName(...)`) with `...locationFromDistrict(dto.districtId),`.

Replace `update`'s first two lines with:

```ts
    const { districtId, ...rest } = dto;
    const setFields: Record<string, unknown> = { ...rest };
    if (districtId) Object.assign(setFields, locationFromDistrict(districtId));
```

Replace `listCatalog` with:

```ts
  /** Student-facing catalog: published courses in one district. With `grade` it's the
   *  "My grade" view; without, "All grades", ordered by grade then title. */
  async listCatalog(filters: StudentCatalogQueryDto): Promise<ICourse[]> {
    const filter: Record<string, unknown> = { districtId: filters.districtId, isPublished: true, isDeleted: false };
    if (filters.grade) filter.grade = filters.grade;
    if (filters.subject) filter.subject = filters.subject;
    const courses = await CourseModel.find(filter).sort({ title: 1 }).limit(500).lean();
    // Stable sort keeps the title order within a grade.
    return courses.sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade));
  }
```

In `listForAdmin`, after the `countyFips` filter line add `if (query.districtId) filter.districtId = query.districtId;`.

Replace the `countyName` helper at the bottom with:

```ts
/** Validators already reject unknown districts; this guards direct service callers. */
function locationFromDistrict(districtId: string) {
  const district = geoService.getDistrict(districtId);
  if (!district) throw new ValidationError({ districtId: [`Unknown school district ${districtId}`] });
  return {
    country: 'US',
    state: district.state,
    countyFips: district.countyFips,
    // The district builder only keeps districts whose county is in the gazetteer.
    county: geoService.getCounty(district.countyFips)?.name ?? district.countyFips,
    districtId: district.id,
    district: district.name,
  };
}

const GRADE_RANK = new Map<string, number>(GRADE_LIST.map((g, i) => [g, i]));
/** Unknown grade strings sort after every known grade. */
function gradeRank(grade: string): number {
  return GRADE_RANK.get(grade) ?? GRADE_LIST.length;
}
```

- [ ] **Step 10: Controller** — in `course.controller.ts`, import `ValidationError` next to `NotFoundError` and `studentCatalogQuerySchema` from `./course.validators`, then replace the student branch of `list`:

```ts
      } else {
        const parsed = studentCatalogQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
        }
        const result = await courseService.listCatalog(parsed.data);
        sendSuccess(res, result, 'Courses fetched');
      }
```

- [ ] **Step 11: Run to verify pass**

Run: `npx jest src/tests/modules/course src/tests/modules/geo.routes && npx tsc --noEmit -p .`
Expected: PASS; no type errors.

- [ ] **Step 12: Commit**

```bash
git add server/src/modules/courses server/src/tests/modules
git commit -m "feat: scope courses to school districts; All-grades student catalog"
```

---

### Task 4: Student profile district

**Files:**
- Modify: `server/src/modules/students/student.model.ts`, `student.types.ts`, `student.validators.ts`, `student.service.ts`
- Test: `server/src/tests/modules/student.county.test.ts`

**Interfaces:**
- Consumes: `districtIdSchema`, `geoService.getDistrict/getCounty` (Task 2).
- Produces: `IStudentProfile.districtId?: string`, `district?: string`; `PATCH /students/me` accepts `districtId`; `studentService.updateMyProfile(userPublicId, { grade?, country?, state?, countyFips?, districtId? })`.

- [ ] **Step 1: Write failing tests** — replace `student.county.test.ts` body:

```ts
import { studentService } from '../../modules/students/student.service';
import { StudentProfileModel } from '../../modules/students/student.model';
import { updateMyStudentProfileSchema } from '../../modules/students/student.validators';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('StudentService.updateMyProfile', () => {
  afterEach(() => jest.restoreAllMocks());

  it('county without a district sets the county and clears any old district', async () => {
    const updateSpy = jest
      .spyOn(StudentProfileModel, 'findOneAndUpdate')
      .mockReturnValue(lean({ publicId: 'student-1', county: 'Wake County', grade: 'Grade 8' }) as never);

    const result = await studentService.updateMyProfile('user-1', { country: 'US', state: 'NC', countyFips: '37183', grade: 'Grade 8' });

    expect(updateSpy).toHaveBeenCalledWith(
      { userPublicId: 'user-1', isDeleted: false },
      {
        $set: { country: 'US', state: 'NC', countyFips: '37183', county: 'Wake County', grade: 'Grade 8' },
        $unset: { districtId: '', district: '' },
      },
      { new: true },
    );
    expect(result.county).toBe('Wake County');
  });

  it('a district derives state, county and district name', async () => {
    const updateSpy = jest.spyOn(StudentProfileModel, 'findOneAndUpdate').mockReturnValue(lean({ publicId: 'student-1' }) as never);

    await studentService.updateMyProfile('user-1', { districtId: '3704720' });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.anything(),
      {
        $set: {
          country: 'US', state: 'NC', countyFips: '37183', county: 'Wake County',
          districtId: '3704720', district: 'Wake County Schools',
        },
      },
      { new: true },
    );
  });

  it('grade-only update touches nothing else', async () => {
    const updateSpy = jest.spyOn(StudentProfileModel, 'findOneAndUpdate').mockReturnValue(lean({}) as never);
    await studentService.updateMyProfile('user-1', { grade: 'Grade 9' });
    expect(updateSpy).toHaveBeenCalledWith(expect.anything(), { $set: { grade: 'Grade 9' } }, { new: true });
  });
});

describe('updateMyStudentProfileSchema', () => {
  it('rejects a district that is not in the sent county', () => {
    const r = updateMyStudentProfileSchema.safeParse({ state: 'VA', countyFips: '51059', districtId: '3704720' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === 'districtId')).toBe(true);
  });

  it('accepts a matching county + district, or a district alone', () => {
    expect(updateMyStudentProfileSchema.safeParse({ state: 'NC', countyFips: '37183', districtId: '3704720' }).success).toBe(true);
    expect(updateMyStudentProfileSchema.safeParse({ districtId: '3704720' }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/tests/modules/student.county`
Expected: FAIL — no `$unset`, no district derivation, schema accepts mismatch.

- [ ] **Step 3: Model + types** — `student.model.ts` after the `county` field:

```ts
    districtId: { type: String, index: true },
    district: { type: String }, // display name, derived from districtId
```

`student.types.ts` after `county?: string;`:

```ts
  districtId?: string;
  district?: string;
```

- [ ] **Step 4: Validators** — in `student.validators.ts` change the geo import to `import { locationShape, refineLocation, districtIdSchema } from '../geo/geo.validators';`, add `import { geoService } from '../geo/geo.service';`, and replace `updateMyStudentProfileSchema`:

```ts
export const updateMyStudentProfileSchema = z
  .object({ grade: z.enum(GRADE_LIST), ...locationShape, districtId: districtIdSchema })
  .partial()
  .superRefine((data, ctx) => {
    refineLocation(data, ctx);
    // A district alone is enough (the service derives the rest); if a county is
    // also sent, the district has to be in it.
    if (data.districtId && data.countyFips) {
      const district = geoService.getDistrict(data.districtId);
      if (district && district.countyFips !== data.countyFips) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['districtId'],
          message: 'District is not in the selected county',
        });
      }
    }
  });
```

- [ ] **Step 5: Service** — replace `updateMyProfile` in `student.service.ts`:

```ts
  async updateMyProfile(
    userPublicId: string,
    data: { grade?: string; country?: string; state?: string; countyFips?: string; districtId?: string },
  ): Promise<IStudentProfile> {
    const $set: Record<string, unknown> = { ...data };
    let $unset: Record<string, ''> | undefined;
    if (data.districtId) {
      const district = geoService.getDistrict(data.districtId);
      if (!district) throw new ValidationError({ districtId: [`Unknown school district ${data.districtId}`] });
      Object.assign($set, {
        country: 'US',
        state: district.state,
        countyFips: district.countyFips,
        county: geoService.getCounty(district.countyFips)?.name ?? district.countyFips,
        district: district.name,
      });
    } else if (data.countyFips) {
      const county = geoService.getCounty(data.countyFips);
      if (!county) throw new ValidationError({ countyFips: [`Unknown county ${data.countyFips}`] });
      $set.country = data.country ?? 'US';
      $set.county = county.name;
      // A district belongs to one county; don't leave the old one behind.
      $unset = { districtId: '', district: '' };
    }
    const updated = await StudentProfileModel.findOneAndUpdate(
      { userPublicId, isDeleted: false },
      $unset ? { $set, $unset } : { $set },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Student profile');
    return updated;
  }
```

Note: the `$set` key order in the district test is `country, state, countyFips, county, districtId, district` — `toHaveBeenCalledWith` compares objects by value, so key order doesn't matter.

- [ ] **Step 6: Run to verify pass**

Run: `npx jest src/tests/modules/student && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/modules/students server/src/tests/modules/student.county.test.ts
git commit -m "feat: students can set their school district"
```

---

### Task 5: Course district migration

**Files:**
- Create: `server/src/scripts/resolve-course-district.ts`
- Create: `server/src/scripts/migrate-course-districts.ts`
- Test: `server/src/tests/modules/resolve-course-district.test.ts`

**Interfaces:**
- Consumes: `geoService.listDistricts`, `UsDistrict` (Task 2).
- Produces: `resolveCourseDistrict(state?: string, countyFips?: string): { status: 'resolved'; district: UsDistrict } | { status: 'unresolved'; candidates: number }`.

- [ ] **Step 1: Write failing test**

```ts
// server/src/tests/modules/resolve-course-district.test.ts
import { resolveCourseDistrict } from '../../scripts/resolve-course-district';

describe('resolveCourseDistrict', () => {
  it('resolves a county that has exactly one district', () => {
    expect(resolveCourseDistrict('NC', '37183')).toEqual({
      status: 'resolved',
      district: { id: '3704720', name: 'Wake County Schools', state: 'NC', countyFips: '37183' },
    });
  });

  it('leaves a multi-district county unresolved with the candidate count', () => {
    const r = resolveCourseDistrict('CA', '06037');
    expect(r.status).toBe('unresolved');
    if (r.status === 'unresolved') expect(r.candidates).toBeGreaterThan(50);
  });

  it('leaves missing or unknown location unresolved', () => {
    expect(resolveCourseDistrict(undefined, '37183')).toEqual({ status: 'unresolved', candidates: 0 });
    expect(resolveCourseDistrict('ZZ', '37183')).toEqual({ status: 'unresolved', candidates: 0 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/tests/modules/resolve-course-district`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement resolver**

```ts
// server/src/scripts/resolve-course-district.ts
import { geoService, type UsDistrict } from '../modules/geo/geo.service';

export type DistrictResolution =
  | { status: 'resolved'; district: UsDistrict }
  | { status: 'unresolved'; candidates: number };

/** A county-scoped course can only be moved to a district automatically when
 *  its county has exactly one district. */
export function resolveCourseDistrict(state?: string, countyFips?: string): DistrictResolution {
  if (!state || !countyFips) return { status: 'unresolved', candidates: 0 };
  const districts = geoService.listDistricts(state, countyFips) ?? [];
  return districts.length === 1
    ? { status: 'resolved', district: districts[0] }
    : { status: 'unresolved', candidates: districts.length };
}
```

- [ ] **Step 4: Implement script**

```ts
// server/src/scripts/migrate-course-districts.ts
/**
 * One-off migration: set districtId/district on courses that were authored
 * per county. Run AFTER migrate-county-to-fips.ts.
 *
 * Dry run by default — pass --apply to write.
 * Usage: npx ts-node src/scripts/migrate-course-districts.ts [--apply]
 *
 * Only counties with exactly one district can be resolved automatically; the
 * rest are listed — assign them in the admin Curriculum page ("Assign district").
 * Student profiles are not migrated: students pick their district in Profile.
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { resolveCourseDistrict } from './resolve-course-district';

const apply = process.argv.includes('--apply');

async function main() {
  await connectDatabase();
  console.log(apply ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');

  // Raw collection: legacy courses lack the now-required districtId.
  const col = mongoose.connection.collection('courses');
  const legacy = col.find({
    isDeleted: { $ne: true },
    $or: [{ districtId: { $exists: false } }, { districtId: null }, { districtId: '' }],
  });

  let resolved = 0;
  const problems: string[] = [];
  for await (const doc of legacy) {
    const r = resolveCourseDistrict(doc.state, doc.countyFips);
    if (r.status === 'unresolved') {
      problems.push(`  course ${doc.publicId}  "${doc.title}"  ${doc.county ?? '?'}, ${doc.state ?? '?'}  (${r.candidates} districts)`);
      continue;
    }
    resolved++;
    console.log(`  course ${doc.publicId}  "${doc.title}" → ${r.district.name} (${r.district.id})`);
    if (apply) {
      await col.updateOne({ _id: doc._id }, { $set: { districtId: r.district.id, district: r.district.name } });
    }
  }

  console.log(`courses: ${resolved} ${apply ? 'updated' : 'would update'}, ${problems.length} need a district assigned by hand`);
  if (problems.length) console.log(problems.join('\n'));
  await disconnectDatabase();
  process.exit(problems.length ? 2 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
```

- [ ] **Step 5: Run to verify pass**

Run: `npx jest src/tests/modules/resolve-course-district && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/scripts/resolve-course-district.ts server/src/scripts/migrate-course-districts.ts server/src/tests/modules/resolve-course-district.test.ts
git commit -m "feat: migration to assign districts to county-scoped courses"
```

---

### Task 6: Frontend geo + LocationSelect district

**Files:**
- Modify: `frontend/src/services/geo.service.ts`, `frontend/src/hooks/use-geo.ts`, `frontend/src/components/shared/LocationSelect.tsx`

**Interfaces:**
- Consumes: `GET /geo/states/:code/districts?countyFips=` (Task 2).
- Produces: `interface UsDistrict { id; name; state; countyFips }`; `Location` gains `districtId: string`; `EMPTY_LOCATION = { country: 'US', state: '', countyFips: '', districtId: '' }`; `useUsDistricts(state?, countyFips?)`; `<LocationSelect requireDistrict?>` renders 4 sibling fields.

- [ ] **Step 1: Service** — in `geo.service.ts`:

```ts
export interface UsDistrict { id: string; name: string; state: string; countyFips: string }

/** A course's or student's location. `districtId` (NCES LEAID) is the course match key;
 *  county and state narrow the district list. Empty string = not chosen. */
export interface Location {
  country: string;
  state: string;
  countyFips: string;
  districtId: string;
}
```

and add to `geoService`:

```ts
  listDistricts: (stateCode: string, countyFips: string): Promise<UsDistrict[]> =>
    api.get(`/geo/states/${stateCode}/districts`, { params: { countyFips } }).then((r) => r.data.data),
```

- [ ] **Step 2: Hook** — in `use-geo.ts` add `districts: (state: string, county: string) => ['geo', 'districts', state, county] as const,` to `geoKeys`, and:

```ts
export function useUsDistricts(stateCode: string | undefined, countyFips: string | undefined) {
  return useQuery({
    queryKey: geoKeys.districts(stateCode ?? '', countyFips ?? ''),
    queryFn: () => geoService.listDistricts(stateCode!, countyFips!),
    enabled: !!stateCode && !!countyFips,
    ...STATIC,
  });
}
```

- [ ] **Step 3: LocationSelect** — rewrite `LocationSelect.tsx`:

```tsx
// frontend/src/components/shared/LocationSelect.tsx
//
// Country → State → County → School district dropdowns. Renders four sibling
// fields so the caller's grid decides the layout. Changing a level clears the
// levels below it, because each only makes sense inside its parent.
import { Select } from '../ui/Select';
import { useCountries, useUsStates, useUsCounties, useUsDistricts } from '../../hooks/use-geo';
import type { Location } from '../../services/geo.service';

interface LocationSelectProps {
  value: Location;
  onChange: (next: Location) => void;
  errors?: Partial<Record<keyof Location, string>>;
  disabled?: boolean;
  /** Courses need a district; the student profile treats it as optional. */
  requireDistrict?: boolean;
}

export const EMPTY_LOCATION: Location = { country: 'US', state: '', countyFips: '', districtId: '' };

export function LocationSelect({ value, onChange, errors, disabled, requireDistrict }: LocationSelectProps) {
  const { data: countries = [] } = useCountries();
  const { data: states = [] } = useUsStates();
  const { data: counties = [], isLoading: countiesLoading } = useUsCounties(value.state || undefined);
  const { data: districts = [], isLoading: districtsLoading } = useUsDistricts(
    value.state || undefined,
    value.countyFips || undefined,
  );

  const districtPlaceholder = !value.countyFips
    ? 'Select a county first'
    : districtsLoading
      ? 'Loading districts…'
      : districts.length === 0
        ? 'No districts listed for this county'
        : 'Select district';

  return (
    <>
      <Select
        label="Country"
        options={countries.map((c) => ({ value: c.code, label: c.name }))}
        placeholder="Select country"
        value={value.country}
        onChange={(e) => onChange({ country: e.target.value, state: '', countyFips: '', districtId: '' })}
        error={errors?.country}
        disabled={disabled}
      />
      <Select
        label="State"
        options={states.map((s) => ({ value: s.code, label: s.name }))}
        placeholder="Select state"
        value={value.state}
        onChange={(e) => onChange({ ...value, state: e.target.value, countyFips: '', districtId: '' })}
        error={errors?.state}
        disabled={disabled || !value.country}
      />
      <Select
        label="County"
        options={counties.map((c) => ({ value: c.fips, label: c.name }))}
        placeholder={!value.state ? 'Select a state first' : countiesLoading ? 'Loading counties…' : 'Select county'}
        value={value.countyFips}
        onChange={(e) => onChange({ ...value, countyFips: e.target.value, districtId: '' })}
        error={errors?.countyFips}
        disabled={disabled || !value.state || countiesLoading}
      />
      <div>
        <Select
          label={requireDistrict ? 'School district' : 'School district (optional)'}
          options={districts.map((d) => ({ value: d.id, label: d.name }))}
          placeholder={districtPlaceholder}
          value={value.districtId}
          onChange={(e) => onChange({ ...value, districtId: e.target.value })}
          error={errors?.districtId}
          disabled={disabled || !value.countyFips || districtsLoading || districts.length === 0}
        />
        {value.countyFips && !districtsLoading && (
          // NCES lists each district under one county, so a district that crosses a
          // county line only appears under its home county.
          <p className="mt-1 text-xs text-ink-muted">Don't see your district? It may be listed under a neighbouring county.</p>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Typecheck** — expected errors only in the three pages that build `Location` objects / call `useCourseCatalog` (fixed in Tasks 7–9).

Run: `npx tsc --noEmit -p .` (from `frontend/`)
Expected: errors limited to `AdminCurriculumPage.tsx`, `ProfilePage.tsx`, `StudentCoursesPage.tsx`, `courses.service.ts`/`use-courses.ts` consumers. No errors in `LocationSelect.tsx`, `use-geo.ts`, `geo.service.ts`.

- [ ] **Step 5: Commit** (with Task 7–9 if tsc must be green per commit — otherwise commit now)

```bash
git add frontend/src/services/geo.service.ts frontend/src/hooks/use-geo.ts frontend/src/components/shared/LocationSelect.tsx
git commit -m "feat(frontend): school district dropdown in LocationSelect"
```

---

### Task 7: Course types + admin curriculum editor

**Files:**
- Modify: `frontend/src/services/courses.service.ts`, `frontend/src/hooks/use-courses.ts`, `frontend/src/pages/admin/AdminCurriculumPage.tsx`

**Interfaces:**
- Consumes: `LocationSelect`, `EMPTY_LOCATION`, `Location` (Task 6); `POST/PUT /courses` with `districtId` (Task 3).
- Produces: `Course.districtId?: string; Course.district?: string` (optional — legacy courses lack them); `CreateCourseDto = { districtId, grade, subject, title, description?, topics }`; `useCourseCatalog({ districtId?, grade?, subject? })` enabled on `districtId` alone.

- [ ] **Step 1: Types + service** — in `courses.service.ts`, add to `Course` after `county`:

```ts
  districtId?: string; // absent on courses not yet migrated to a district
  district?: string;
```

Replace `CreateCourseDto`'s `country/state/countyFips` lines with `districtId: string;`, and change `listCatalog`'s param type to `{ districtId?: string; grade?: string; subject?: string }`.

- [ ] **Step 2: Hook** — replace `useCourseCatalog` in `use-courses.ts`:

```ts
/** No `grade` = the "All grades" view of the district. */
export function useCourseCatalog(params: { districtId?: string; grade?: string; subject?: string }) {
  return useQuery({
    queryKey: courseKeys.catalog({ districtId: params.districtId ?? '', grade: params.grade ?? 'all', subject: params.subject ?? '' }),
    queryFn: () => coursesService.listCatalog(params),
    enabled: !!params.districtId,
  });
}
```

- [ ] **Step 3: Admin page** — in `AdminCurriculumPage.tsx`:

Imports: add `AlertTriangle, MapPin` to the lucide import, `useUpdateCourse` to the hooks import, `import { Modal } from '../../components/ui/Modal';`, and `type Course` to the courses service type import.

In `NewCourseForm`: change the location grid wrapper to `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2`, pass `requireDistrict` to `LocationSelect`, change the save button `disabled` to start with `!location.districtId ||`, and the create payload to:

```ts
              { districtId: location.districtId, grade, subject, title, topics: topics.map((t, i) => ({ ...t, order: i })) },
```

Add, above `AdminCurriculumPage`:

```tsx
/** For courses authored before districts existed (see migrate-course-districts.ts). */
function AssignDistrictModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const { mutate: update, isPending } = useUpdateCourse();
  const [location, setLocation] = useState<Location>({
    country: 'US',
    state: course.state ?? '',
    countyFips: course.countyFips ?? '',
    districtId: '',
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign district — ${course.title}`}
      footer={
        <Button
          variant="gradient"
          loading={isPending}
          disabled={!location.districtId}
          onClick={() =>
            update({ coursePublicId: course.publicId, dto: { districtId: location.districtId } }, { onSuccess: onClose })
          }
        >
          <Save className="h-3.5 w-3.5" /> Save district
        </Button>
      }
    >
      <div className="grid gap-3">
        <LocationSelect value={location} onChange={setLocation} requireDistrict />
      </div>
    </Modal>
  );
}
```

In `AdminCurriculumPage`: add state and filters, replacing the `useAdminCourses` line:

```tsx
  const [filter, setFilter] = useState<Location>(EMPTY_LOCATION);
  const [assigning, setAssigning] = useState<Course | null>(null);
  const params: Record<string, string> = { limit: '100' };
  if (filter.state) params.state = filter.state;
  if (filter.countyFips) params.countyFips = filter.countyFips;
  if (filter.districtId) params.districtId = filter.districtId;
  const { data, isLoading } = useAdminCourses(params);
```

Change the page description to `"Author curricula per US school district and grade for students to browse and request."`.

Right after `{showNew && <NewCourseForm ... />}` add:

```tsx
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <LocationSelect value={filter} onChange={setFilter} />
      </div>
      {assigning && <AssignDistrictModal course={assigning} onClose={() => setAssigning(null)} />}
```

Replace the row's title/subtitle block with:

```tsx
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{course.title}</p>
                      {course.isPublished ? <Badge variant="success" tone="soft">Published</Badge> : <Badge variant="default" tone="soft">Draft</Badge>}
                      {!course.districtId && (
                        <Badge variant="warning" tone="soft"><AlertTriangle className="h-3 w-3" /> No district</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {course.district ? `${course.district} · ` : ''}{course.county ?? '—'}, {course.state ?? '—'} · {course.grade} · {course.subject} · {course.topics.length} topics
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!course.districtId && (
                      <Button size="sm" variant="outline" onClick={() => setAssigning(course)}>
                        <MapPin className="h-3.5 w-3.5" /> Assign district
                      </Button>
                    )}
                    {/* existing Publish/Unpublish <Button> moves in here unchanged */}
                  </div>
```

(Check `Badge` supports `variant="warning"`; if not, use the closest existing variant name from `components/ui/Badge.tsx`.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors in `AdminCurriculumPage.tsx`, `courses.service.ts`, `use-courses.ts`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/courses.service.ts frontend/src/hooks/use-courses.ts frontend/src/pages/admin/AdminCurriculumPage.tsx
git commit -m "feat(frontend): district-scoped curriculum editor with assign-district flow"
```

---

### Task 8: Student profile district

**Files:**
- Modify: `frontend/src/services/students.service.ts`, `frontend/src/pages/shared/ProfilePage.tsx`

**Interfaces:**
- Consumes: `LocationSelect` (Task 6), `PATCH /students/me` with `districtId` (Task 4).
- Produces: `StudentProfile.districtId?`, `district?`; `UpdateMyStudentProfileDto.districtId?`.

- [ ] **Step 1: Types** — in `students.service.ts`, add `districtId?: string; district?: string;` to `StudentProfile` (after `county?`) and `districtId?: string;` to `UpdateMyStudentProfileDto`.

- [ ] **Step 2: Form schema** — in `ProfilePage.tsx` replace `studentAcademicSchema`:

```ts
const studentAcademicSchema = z.object({
  grade: z.string().optional(),
  country: z.string(),
  state: z.string(),
  countyFips: z.string(),
  districtId: z.string(),
}).refine((d) => !d.state || !!d.countyFips, { message: 'Select a county', path: ['countyFips'] });
```

- [ ] **Step 3: Load + save** — in the profile `useEffect` add:

```ts
    academicForm.setValue('districtId', studentProfile.districtId ?? '',   { shouldDirty: false });
```

Replace the submit body's location spread:

```ts
                // A district implies state + county (server derives them). Otherwise the
                // server needs state + county together; send neither until both are picked.
                ...(d.districtId
                  ? { districtId: d.districtId }
                  : d.countyFips ? { country: d.country, state: d.state, countyFips: d.countyFips } : {}),
```

`LocationSelect` `value` gains `districtId: academicForm.watch('districtId'),` and `onChange` gains:

```ts
                  academicForm.setValue('districtId', loc.districtId, { shouldDirty: true });
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors in `ProfilePage.tsx` / `students.service.ts`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/students.service.ts frontend/src/pages/shared/ProfilePage.tsx
git commit -m "feat(frontend): students pick their school district in Profile"
```

---

### Task 9: Student Courses page — My grade / All grades tabs

**Files:**
- Modify: `frontend/src/pages/student/StudentCoursesPage.tsx`

**Interfaces:**
- Consumes: `useCourseCatalog({ districtId, grade? })` (Task 7), `StudentProfile.districtId/district` (Task 8), `Tabs` (`components/ui/Tabs.tsx`), `GRADE_LIST` (`constants/grades.ts`).

- [ ] **Step 1: Rewrite the page**

```tsx
// frontend/src/pages/student/StudentCoursesPage.tsx
//
// grade/district live on the Student PROFILE (server/src/modules/students/student.model.ts),
// not on the User/auth object, so this reads them via `useMyStudentProfile()`.
// Two tabs: "My grade" (the student's grade in their district) and "All grades"
// (every published course in the district, grouped by grade). The tab is kept in
// the URL (?tab=all) so back/refresh keep it.
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, ArrowRight, Inbox } from 'lucide-react';
import { useMyStudentProfile } from '../../hooks/use-students';
import { useCourseCatalog } from '../../hooks/use-courses';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loading';
import { Tabs } from '../../components/ui/Tabs';
import { GRADE_LIST } from '../../constants/grades';
import type { Course } from '../../services/courses.service';

type TabKey = 'mine' | 'all';

function Message({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col items-center py-14 text-center gap-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function ProfileLink() {
  return (
    <Link to="/profile" className="text-sm text-brand-600 hover:underline">
      Go to profile <ArrowRight className="inline h-3.5 w-3.5" />
    </Link>
  );
}

function CourseGrid({ courses }: { courses: Course[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <Link key={course.publicId} to={`/dashboard/student/courses/${course.publicId}`}>
          <Card className="h-full hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
            <CardContent>
              <Badge variant="info" tone="soft">{course.subject}</Badge>
              <p className="mt-2 font-semibold text-gray-900 dark:text-white">{course.title}</p>
              <p className="mt-1 text-xs text-gray-500">{course.topics.length} topics</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

/** Groups in GRADE_LIST order; grades the list doesn't know go last. Empty grades are omitted. */
function groupByGrade(courses: Course[]): Array<[string, Course[]]> {
  const groups = new Map<string, Course[]>();
  for (const c of courses) groups.set(c.grade, [...(groups.get(c.grade) ?? []), c]);
  const rank = (g: string) => {
    const i = (GRADE_LIST as readonly string[]).indexOf(g);
    return i < 0 ? GRADE_LIST.length : i;
  };
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
}

export function StudentCoursesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabKey = searchParams.get('tab') === 'all' ? 'all' : 'mine';
  const { data: profile, isLoading: profileLoading } = useMyStudentProfile();
  const districtId = profile?.districtId;
  const grade = profile?.grade;

  const mine = useCourseCatalog({ districtId, grade: grade || undefined });
  const all = useCourseCatalog({ districtId });
  const active = tab === 'all' ? all : mine;

  if (profileLoading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  if (!districtId) {
    return (
      <div className="animate-fade-in">
        <PageHeader eyebrow="Courses" title="Curriculum" icon={<BookOpen className="h-5 w-5" />} />
        <Message>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Set your school district in your profile to see your curriculum.
          </p>
          <ProfileLink />
        </Message>
      </div>
    );
  }

  const where = `${profile?.district}, ${profile?.state}`;

  let body: React.ReactNode;
  if (tab === 'mine' && !grade) {
    body = (
      <Message>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Set your grade in your profile to see your grade's curriculum.</p>
        <ProfileLink />
      </Message>
    );
  } else if (active.isLoading) {
    body = <div className="flex justify-center py-16"><Spinner /></div>;
  } else if (!active.data || active.data.length === 0) {
    body = (
      <Message>
        <Inbox className="h-6 w-6 text-gray-400" />
        <p className="text-sm text-gray-500">
          {tab === 'mine' ? `No published curriculum yet for ${grade} in ${where}.` : `No published curriculum yet in ${where}.`}
        </p>
      </Message>
    );
  } else if (tab === 'mine') {
    body = <CourseGrid courses={active.data} />;
  } else {
    body = (
      <div className="space-y-8">
        {groupByGrade(active.data).map(([g, courses]) => (
          <section key={g}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{g}</h2>
              {g === grade && <Badge variant="success" tone="soft">Your grade</Badge>}
            </div>
            <CourseGrid courses={courses} />
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Courses"
        title="Curriculum"
        description={tab === 'mine' && grade ? `${grade} curriculum · ${where}` : `All grades · ${where}`}
        icon={<BookOpen className="h-5 w-5" />}
      />
      <Tabs
        className="mb-5"
        tabs={[{ key: 'mine', label: 'My grade' }, { key: 'all', label: 'All grades' }]}
        activeTab={tab}
        onChange={(key) => setSearchParams(key === 'all' ? { tab: 'all' } : {}, { replace: true })}
      />
      {body}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit -p . && npx vite build`
Expected: no errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/student/StudentCoursesPage.tsx
git commit -m "feat(frontend): My grade / All grades tabs on student Courses page"
```

---

### Task 10: Full verification

- [ ] **Step 1: Full server suite** — `npx jest` (from `server/`). Expected: all suites pass. Record counts.
- [ ] **Step 2: Typecheck both apps** — `npx tsc --noEmit -p .` in `server/` and `frontend/`. Expected: clean.
- [ ] **Step 3: Frontend build** — `npx vite build` in `frontend/`. Expected: success.
- [ ] **Step 4: Manual browser pass** (dev servers running against a non-production DB):
  - Profile (student): State NC → County Wake → District "Wake County Schools" → save → reload keeps it. Change county to Durham without picking a district → save → district cleared.
  - Courses (student): no district → prompt. With district: "My grade" shows own grade; "All grades" groups by grade in order with "Your grade" marker; `?tab=all` survives refresh; empty states name the district.
  - Admin Curriculum: create a course requires district; row shows district; filter by district narrows list; a course without `districtId` shows "No district" + Assign district modal that saves.
  - Request a course from another grade from the All grades tab → request created.
- [ ] **Step 5: Report** anything not verified.
