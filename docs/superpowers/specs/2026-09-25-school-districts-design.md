# School Districts + "All grades" Course Tab — Design Spec

Date: 2026-09-25
Status: Draft — awaiting review
Builds on: `2026-09-23-course-curriculum-design.md` and the structured-location
work (commit `4ea8e12`, country/state/countyFips).

## 1. Problem / Goal

Curriculum in the US is set per **school district**, not per county: one county
can contain many districts, each with its own curriculum. Today a Course is
scoped to `countyFips + grade`, so two districts in the same county can't have
different courses, and a student sees whatever was authored for the whole county.

Goals:

1. Scope every Course to a school district + grade.
2. Let students record their district on their profile and see their district's
   curriculum.
3. On the student Courses page, add two tabs: **My grade** (current behaviour,
   district-scoped) and **All grades** (every published course in the student's
   district, grouped by grade).

## 2. Decisions (from brainstorming — not open questions)

- District data comes from the **NCES** (US Dept. of Education, Common Core of
  Data / EDGE) public district files, bundled as static JSON — same approach as
  `us-counties.json`. No admin-managed district collection.
- **District is required on every Course.** State and county are still stored on
  the Course but are *derived* from the district server-side, never sent by the
  client.
- District is **optional** on the Student profile (as grade/county are today).
- **All grades** tab = all published courses in the *student's own district*,
  all grades. Not a nationwide browse.
- Students **may request** a course from any grade (catch-up / get ahead).
  `CourseRequestService` has no grade or location check today, so nothing to relax.
- Existing courses without a district are handled by a best-effort migration
  plus a manual "Assign district" action in the admin editor.

## 3. District reference data

### 3.1 Source

NCES publishes, per school year:

- **CCD LEA directory file** — `LEAID`, `LEA_NAME`, `ST`, `LEA_TYPE`,
  `SY_STATUS` (operational status).
- **EDGE Public School District geocode file** — `LEAID`, `CNTY` (5-digit county
  FIPS of the district's location), `NMCNTY`.

The builder joins the two on `LEAID`. The exact school year / file names are
pinned in the implementation plan after downloading them; the script takes both
paths as arguments so a refresh is just a re-run.

### 3.2 Filtering

Keep only:

- `ST` in the 50 states + DC (`US_STATE_CODES`, same as counties).
- `LEA_TYPE` 1 (regular local school district) or 2 (local district component of
  a supervisory union). Drop state agencies, supervisory unions themselves,
  regional service agencies, federal agencies, and charter-only agencies.
- `SY_STATUS` open / new / reopened / added. Drop closed and inactive.
- `CNTY` present and known to `geoService.getCounty` (drop rows with a county
  the gazetteer doesn't know, and log the count).

Expected result: roughly 13,000 districts, ~1 MB JSON.

### 3.3 Shape

`server/src/modules/geo/us-districts.json`, an array sorted by state then name:

```json
{ "id": "3704720", "name": "Wake County Schools", "state": "NC", "countyFips": "37183" }
```

`id` is the 7-digit NCES `LEAID`, kept as a string (leading zeros matter).

### 3.4 Builder script

`server/src/scripts/build-us-districts.ts` — mirrors `build-us-counties.ts`:

```
npx ts-node src/scripts/build-us-districts.ts <ccd_lea_directory.csv> <edge_geocode_lea.txt>
```

Parsing/filtering lives in an exported pure function so it can be unit-tested
with a small inline sample; the script wrapper only does file I/O and prints
counts (kept, dropped by reason).

## 4. Backend

### 4.1 geoService

Load `us-districts.json` once, like counties. Add:

- `listDistricts(stateCode: string, countyFips?: string): UsDistrict[] | null` —
  `null` for an unknown state; sorted by name.
- `getDistrict(id: string): UsDistrict | undefined`.

### 4.2 Geo route

`GET /geo/states/:stateCode/districts?countyFips=37183`

- 404 for an unknown state (same as counties).
- 400 if `countyFips` is given but isn't in that state.
- Same auth + `Cache-Control: private, max-age=86400` as the other geo routes.

### 4.3 Course

Model (`course.model.ts`):

- Add `districtId: { type: String, required: true, index: true }` and
  `district: { type: String, required: true }` (display name).
- `state`, `countyFips`, `county` stay, but are derived from the district.
- Replace index `{ countyFips, grade, isPublished }` with
  `{ districtId, grade, isPublished }`.

Validators (`course.validators.ts`):

- Create: require `districtId`, must pass `geoService.getDistrict`. Remove
  `country/state/countyFips` from the create body (derived).
- Update: `districtId` optional; when present, re-derive location fields.
- Catalog query: `districtId` (required for students — see 4.5), `grade`
  optional, `subject` optional.
- Admin list query: add optional `districtId` filter alongside existing
  `state` / `countyFips`.

Service (`course.service.ts`):

- A `locationFromDistrict(id)` helper returns
  `{ country: 'US', state, countyFips, county, districtId, district }`, throwing
  `ValidationError` for an unknown id (guards direct service callers; mirrors
  the existing `countyName` helper, which it replaces).
- `create` / `update` use it.
- `listCatalog({ districtId, grade?, subject? })` — filters by `districtId`;
  `grade` only when given. Sort by grade order then title. Grade order follows
  the shared grade list (see 4.6), not string sort ("Grade 10" after "Grade 9").

### 4.4 Student profile

- Model: add optional `districtId`, `district`.
- `updateMyProfile` accepts `districtId`. When present, the server derives and
  sets `country/state/countyFips/county/district` from it. When `countyFips` is
  sent without `districtId` (older clients), behaviour is unchanged and
  `districtId/district` are unset — a district must belong to the chosen county.
- Validators: `districtId` optional, must exist.

### 4.5 Catalog controller

Student catalog request: `GET /courses?districtId=...&grade=...`.

- Students: `districtId` required (400 without). `grade` optional — absent means
  "All grades".
- Admin/SuperAdmin path unchanged apart from the new `districtId` filter.

### 4.6 Grade ordering

The server needs the canonical grade order for sorting. Move/duplicate the grade
list into `server/src/constants/grades.ts` (the frontend already has
`GRADE_OPTIONS` in `frontend/src/constants/grades.ts`); sort unknown grade
strings last, alphabetically.

## 5. Migration

`server/src/scripts/migrate-course-districts.ts`, same conventions as
`migrate-county-to-fips.ts` (dry run by default, `--apply` to write, raw
collection access, exit code 2 if anything is unresolved):

- For each course with `countyFips` but no `districtId`:
  - if `geoService.listDistricts(state, countyFips)` has exactly one district,
    set `districtId`, `district`;
  - otherwise list it as unresolved with the candidate count.
- Student profiles are **not** migrated — students pick their district in
  Profile; the Courses page prompts them.
- Run order: `migrate-county-to-fips` first, then this.

Unresolved courses stay in the DB (and stay published) but match no student
until an admin assigns a district (6.2).

## 6. Frontend

### 6.1 LocationSelect

`frontend/src/components/shared/LocationSelect.tsx` — add a 4th field:
Country → State → County → **District**.

- `Location` type gains `districtId`.
- New hook `useUsDistricts(state, countyFips)` + `geoService.listDistricts`.
- Changing state clears county + district; changing county clears district.
- District options are the county's districts. Helper text under the field:
  "Don't see your district? It may be listed under a neighbouring county."
  (NCES assigns each district one county.)
- Prop `requireDistrict?: boolean` → used by the admin editor for validation
  messaging; the profile leaves it off.
- Plain `Select` — county-filtered lists are small (typically < 20, max ~80),
  so no combobox library.

### 6.2 Admin curriculum editor

`frontend/src/pages/admin/AdminCurriculumPage.tsx`:

- New-course form: submit disabled until a district is selected; sends
  `districtId` (not state/countyFips).
- Course row subtitle: `District · County, ST · Grade · Subject · N topics`.
- Courses with no `districtId`: warning badge "No district" + an
  **Assign district** button opening a `Modal` with `LocationSelect`
  (`requireDistrict`), saving via the existing update-course mutation.
- List filters: add a district filter (appears once state + county are chosen).

### 6.3 Student profile

`frontend/src/pages/shared/ProfilePage.tsx`: the academic form's
`LocationSelect` now includes district; save sends `districtId` when set.

### 6.4 Student Courses page

`frontend/src/pages/student/StudentCoursesPage.tsx`:

- Header description: `{district}, {state}`.
- `Tabs` (existing pill switcher): **My grade** | **All grades**. Active tab
  lives in the URL as `?tab=all` (default: my grade) so back/refresh keep it.
- **My grade**: `useCourseCatalog({ districtId, grade })` — current card grid.
- **All grades**: `useCourseCatalog({ districtId })` — cards grouped under a
  heading per grade, in grade order; the student's grade heading is marked
  "Your grade". Grades with no courses are omitted.
- Empty / gating states:
  - no `districtId` on profile → "Set your school district in your profile to
    see your curriculum." + link to `/profile` (replaces the county prompt);
  - no `grade` → My grade tab shows "Set your grade in your profile"; All grades
    still works;
  - no courses → per-tab message naming the district (and grade on My grade).
- Course cards link to the existing detail page; requesting works for any grade.
- Query keys include `districtId` and `grade ?? 'all'` so tabs cache separately.

## 7. Error handling

- Unknown `districtId` anywhere → 400 `ValidationError` with a
  `districtId` field message (validators), with the service helper as a backstop.
- Unknown state on the districts route → 404; county not in state → 400.
- Missing districts JSON at startup is a build error (static import), not a
  runtime path.

## 8. Testing

Server (Jest, alongside existing `src/tests/modules/*`):

- `build-us-districts` parser: filters by state/type/status/county; keeps
  leading zeros; sorts.
- `geoService`: `listDistricts` by state, by state+county, unknown state → null;
  `getDistrict`.
- `geo.routes`: districts endpoint 200 / 404 / 400.
- Course validators + service: create requires valid `districtId`; location
  fields derived; update re-derives; catalog with and without `grade`; grade
  sort order.
- Student profile: `districtId` derives location; unknown id rejected.
- Course requests: a student can request a course whose grade differs from
  their profile grade.
- Migration resolver: single-district county resolves; multi-district county
  reported unresolved.

Frontend: no test suite exists. Verify with `tsc --noEmit` and a manual browser
pass: profile district chain, both course tabs incl. empty states, admin
create + assign-district flow.

## 9. Out of scope

- Private / charter-network districts not in NCES (no admin-added districts).
- Nationwide or cross-district course browsing.
- District-level admin roles or per-district branding.
- Migrating student profiles to districts automatically.
