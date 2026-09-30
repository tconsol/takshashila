# Curriculum Foundation (Plan 1 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the state-anchored Curriculum → Chapter → Topic data model, a Word-file loader (dry-run by default), and a state-based student catalog, so the 7 first-release states can be loaded as drafts.

**Architecture:** Curriculum documents gain `stateCode`, `level`, `courseName`, `source`, `sourceKind` and `chapters[]`; a derived `topics` mirror (= chapters, same publicIds) keeps today's course/materials code working until Plan 2/3. A dependency-free `.docx` reader (Node `zlib`) feeds a heading-based parser; an importer writes drafts idempotently and produces a per-state report; a CLI wraps it with a dry-run default, a mandatory backup and a database-name confirmation before `--commit`.

**Tech Stack:** Node/Express, Mongoose, TypeScript, zod, Jest (server); React/Vite (frontend, Task 10).

**Spec:** `docs/superpowers/specs/2026-09-30-curriculum-chapters-design.md` (read §3, §4, §6 first). Later plans: Plan 2 (chapters in course flow), Plan 3 (materials, admin editing, county display, demand list) — outlined at the bottom.

## Global Constraints

- Server code lives in `server/src`; tests in `server/src/tests/**/*.test.ts`; run with `cd server && npx jest <path>`.
- State is stored as USPS code (`CO`, `GA`…) using `US_STATES` from `server/src/modules/geo/us-states.ts`.
- `Kindergarten` becomes a grade value; sort order Kindergarten, Grade 1 … Grade 12.
- High school (Grades 9–12) is parked (spec §8): the loader skips them and counts them in the report; nothing is created for them.
- A subject whose note starts with "Not verified" has no standard for that state: import nothing for it.
- Everything loaded is `isPublished: false` (draft). Loader never publishes, never deletes, never touches an already-published curriculum.
- `--commit` needs: backup file written, and `--confirm-db=<name>` equal to the connected database name. Default is dry-run.
- No new npm dependency.
- Existing tests must stay green after every task (`cd server && npx jest`).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Word file has a heading style spelled `Heading 1` vs `Heading1` vs `heading1` — parser must accept all (Task 4).
- Empty or "Not verified" subject must create nothing, and appear in the report (Task 4, 7).
- Re-running the loader must not duplicate documents or change chapter/topic publicIds (Task 7).
- A published curriculum must never be overwritten by a re-run (Task 7).
- `--commit` without matching `--confirm-db` or without backup must refuse and write nothing (Task 8).
- Existing district-based curricula (legacy fields, no `stateCode`) must still load, list and validate (Task 2).
- Georgia files use plain paragraphs (no bullet style) for topics (Task 4).

---

## File Structure

- Modify `server/src/modules/students/student.validators.ts` — add `Kindergarten` to `GRADE_LIST`.
- Modify `server/src/modules/curricula/curriculum.service.ts` — rank works with Kindergarten (uses `GRADE_LIST`, no change needed once list updated; verify), add `listByState`.
- Create `server/src/modules/geo/state-codes.ts` — `stateCodeFromName`.
- Modify `server/src/modules/curricula/curriculum.types.ts`, `curriculum.model.ts` — new fields, topics mirror.
- Create `server/src/modules/curricula/county-addition.model.ts` (+ types in same file) — `CountyAddition`.
- Create `server/src/modules/curricula/import/docx-reader.ts` — zip + paragraph extraction.
- Create `server/src/modules/curricula/import/curriculum-parser.ts` — headings → structure.
- Create `server/src/modules/curricula/import/sources-parser.ts` — source citations.
- Create `server/src/modules/curricula/import/county-parser.ts` — county additions.
- Create `server/src/modules/curricula/import/curriculum-importer.ts` — write drafts + report.
- Create `server/src/scripts/import-state-curricula.ts` — CLI.
- Modify `server/src/modules/settings/settings.model.ts` + `settings.service.ts` — `enabledSubjects`.
- Create `server/src/tests/curriculum-import/docx-fixture.ts` — builds small `.docx` buffers for tests.
- Frontend: Modify `frontend/src/pages/student/StudentCurriculumPage.tsx` (Task 10).

---

### Task 1: Kindergarten grade and state-name helper

**Files:**
- Modify: `server/src/modules/students/student.validators.ts:5-9`
- Create: `server/src/modules/geo/state-codes.ts`
- Test: `server/src/tests/curriculum-import/state-codes.test.ts`

**Interfaces:**
- Produces: `GRADE_LIST` now starts with `'Kindergarten'`; `stateCodeFromName(name: string): string | null` (case-insensitive, trims, `"District of Columbia"` → `DC`).

- [ ] **Step 1: Write the failing test**

```ts
import { stateCodeFromName } from '../../modules/geo/state-codes';
import { GRADE_LIST } from '../../modules/students/student.validators';

describe('stateCodeFromName', () => {
  it('maps full names to USPS codes, ignoring case and spaces', () => {
    expect(stateCodeFromName('Colorado')).toBe('CO');
    expect(stateCodeFromName('  hawaii ')).toBe('HI');
    expect(stateCodeFromName('District of Columbia')).toBe('DC');
  });
  it('returns null for unknown names', () => {
    expect(stateCodeFromName('Atlantis')).toBeNull();
  });
});

describe('GRADE_LIST', () => {
  it('has Kindergarten first, then Grade 1 to 12', () => {
    expect(GRADE_LIST[0]).toBe('Kindergarten');
    expect(GRADE_LIST[1]).toBe('Grade 1');
    expect(GRADE_LIST[GRADE_LIST.length - 1]).toBe('Grade 12');
    expect(GRADE_LIST).toHaveLength(13);
  });
});
```

- [ ] **Step 2: Run** `cd server && npx jest src/tests/curriculum-import/state-codes.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`state-codes.ts`:
```ts
import { US_STATES } from './us-states';

const BY_NAME = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s.code]));

export function stateCodeFromName(name: string): string | null {
  return BY_NAME.get(name.trim().toLowerCase()) ?? null;
}
```
In `student.validators.ts` change the list to start with `'Kindergarten',` (keep Grade 1–12 after it).

- [ ] **Step 4: Run** the new test plus `npx jest src/tests/modules/curriculum` — Expected: PASS. If a sort test assumed `Grade 1` at index 0, update it to the new order.

- [ ] **Step 5: Frontend grade lists.** `frontend/src/constants/grades.ts` holds the UI list; add `'Kindergarten'` first there too (the student, parent and principal forms read it). Run `cd frontend && npx tsc --noEmit`.

- [ ] **Step 6: Commit** `git add -A server frontend && git commit -m "feat: add Kindergarten grade and state-name helper"`.

---

### Task 2: Curriculum model gains chapters, state and source (with topics mirror)

**Files:**
- Modify: `server/src/modules/curricula/curriculum.types.ts`
- Modify: `server/src/modules/curricula/curriculum.model.ts`
- Test: `server/src/tests/curriculum-import/curriculum.model.test.ts`

**Interfaces:**
- Produces types:
```ts
export interface ICurriculumChapter { publicId: string; title: string; order: number; topics: ICurriculumTopic[] }
export interface ICurriculumSource { name: string; year: number | null; url: string }
```
`ICurriculum` gains optional: `stateCode?: string; level?: 'KINDERGARTEN' | 'GRADE'; courseName?: string; usualGrade?: string; source?: ICurriculumSource; sourceKind?: 'revised' | 'master'; chapters: ICurriculumChapter[]`. Legacy fields `state, countyFips, county, districtId, district` become optional. `topics` stays and is always `chapters.map(c => ({publicId: c.publicId, title: c.title, order: c.order}))`.
- Rule: `stateCode` or `districtId` must be present (validate in a `pre('validate')` hook).

- [ ] **Step 1: Write the failing test** (validation only, no DB connection — `doc.validateSync()`):

```ts
import { CurriculumModel } from '../../modules/curricula/curriculum.model';

const base = { subject: 'Mathematics', grade: 'Grade 3', title: 'Mathematics Grade 3', createdByAdminPublicId: 'sys' };

describe('Curriculum model', () => {
  it('accepts a state curriculum with chapters and mirrors them into topics', () => {
    const doc = new CurriculumModel({
      ...base, stateCode: 'CO', level: 'GRADE', sourceKind: 'revised',
      source: { name: 'Colorado Academic Standards', year: 2020, url: 'https://cde.state.co.us' },
      chapters: [{ title: 'Fractions', order: 1, topics: [{ title: 'Halves', order: 1 }, { title: 'Quarters', order: 2 }] }],
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.topics).toHaveLength(1);
    expect(doc.topics[0].publicId).toBe(doc.chapters[0].publicId);
    expect(doc.topics[0].title).toBe('Fractions');
    expect(doc.chapters[0].topics[0].publicId).toBeTruthy();
  });
  it('still accepts a legacy district curriculum', () => {
    const doc = new CurriculumModel({
      ...base, state: 'CO', countyFips: '08031', county: 'Denver', districtId: 'd1', district: 'Denver 1',
      topics: [{ title: 'Old topic', order: 1 }],
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.topics).toHaveLength(1);
    expect(doc.chapters).toHaveLength(0);
  });
  it('rejects a document with neither stateCode nor districtId', () => {
    expect(new CurriculumModel({ ...base }).validateSync()).toBeDefined();
  });
});
```
Note: when `chapters` is empty the mirror must NOT wipe legacy `topics`.

- [ ] **Step 2: Run** `npx jest src/tests/curriculum-import/curriculum.model.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement.** Add `curriculumChapterSchema` (`publicId` default uuid, `title` required, `order` required, `topics: [curriculumTopicSchema]`, `_id:false`). In `curriculumSchema`: make the five legacy fields `required: false`, add `stateCode: {type:String, index:true, uppercase:true}`, `level: {type:String, enum:['KINDERGARTEN','GRADE']}`, `courseName`, `usualGrade`, `source: {name:String, year:Number, url:String}` (as nested `_id:false`), `sourceKind: {type:String, enum:['revised','master']}`, `chapters: [curriculumChapterSchema]`. Add:
```ts
curriculumSchema.pre('validate', function (next) {
  if (!this.stateCode && !this.districtId) return next(new Error('A curriculum needs a stateCode or a districtId'));
  if (this.chapters && this.chapters.length > 0) {
    this.topics = this.chapters.map((c) => ({ publicId: c.publicId, title: c.title, order: c.order })) as never;
  }
  next();
});
curriculumSchema.index({ stateCode: 1, grade: 1, subject: 1, isPublished: 1 });
```
Keep the existing `{districtId, grade, isPublished}` index. The topic subschema's `publicId` default runs at construction so nested topics get ids.

- [ ] **Step 4: Run** the new test and `npx jest src/tests/modules/curriculum` — Expected: PASS.

- [ ] **Step 5: Commit** `feat: curriculum model gains state, source and chapters`.

---

### Task 3: Dependency-free .docx reader

**Files:**
- Create: `server/src/tests/curriculum-import/docx-fixture.ts`
- Create: `server/src/modules/curricula/import/docx-reader.ts`
- Test: `server/src/tests/curriculum-import/docx-reader.test.ts`

**Interfaces:**
- Produces: `interface DocxParagraph { style: string; text: string }`; `readDocxParagraphs(buf: Buffer): DocxParagraph[]`; test helper `buildDocx(paras: {style?: string; text: string}[]): Buffer`.

- [ ] **Step 1: Write the fixture builder** `docx-fixture.ts` (single-entry stored/deflated zip; the reader ignores CRC):

```ts
import { deflateRawSync } from 'zlib';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildDocx(paras: { style?: string; text: string }[]): Buffer {
  const body = paras
    .map((p) => `<w:p>${p.style ? `<w:pPr><w:pStyle w:val="${p.style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${esc(p.text)}</w:t></w:r></w:p>`)
    .join('');
  const xml = Buffer.from(`<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${body}</w:body></w:document>`, 'utf8');
  const data = deflateRawSync(xml);
  const name = Buffer.from('word/document.xml');

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(xml.length, 22); local.writeUInt16LE(name.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(xml.length, 24); central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);

  const centralStart = local.length + name.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(centralStart, 16);

  return Buffer.concat([local, name, data, central, name, end]);
}
```

- [ ] **Step 2: Write the failing test**

```ts
import { readDocxParagraphs } from '../../modules/curricula/import/docx-reader';
import { buildDocx } from './docx-fixture';

describe('readDocxParagraphs', () => {
  it('returns style and text per paragraph', () => {
    const buf = buildDocx([{ style: 'Heading1', text: 'Grade 3' }, { text: 'Plain line' }, { style: 'ListBullet', text: 'Fractions & decimals <5' }]);
    expect(readDocxParagraphs(buf)).toEqual([
      { style: 'Heading1', text: 'Grade 3' },
      { style: '', text: 'Plain line' },
      { style: 'ListBullet', text: 'Fractions & decimals <5' },
    ]);
  });
  it('skips paragraphs with no text', () => {
    expect(readDocxParagraphs(buildDocx([{ text: '   ' }, { text: 'x' }]))).toEqual([{ style: '', text: 'x' }]);
  });
  it('throws a clear error for a file that is not a docx', () => {
    expect(() => readDocxParagraphs(Buffer.from('not a zip'))).toThrow(/not a valid \.docx/i);
  });
});
```

- [ ] **Step 3: Run** — Expected: FAIL (module missing).

- [ ] **Step 4: Implement** `docx-reader.ts`:

```ts
import { inflateRawSync } from 'zlib';

export interface DocxParagraph { style: string; text: string }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()];
  });

function readEntry(buf: Buffer, wanted: string): Buffer {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This is not a valid .docx file (no zip directory)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localAt = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const dataAt = localAt + 30 + buf.readUInt16LE(localAt + 26) + buf.readUInt16LE(localAt + 28);
      const raw = buf.subarray(dataAt, dataAt + size);
      return method === 0 ? raw : inflateRawSync(raw);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`This is not a valid .docx file (missing ${wanted})`);
}

export function readDocxParagraphs(buf: Buffer): DocxParagraph[] {
  const xml = readEntry(buf, 'word/document.xml').toString('utf8');
  const out: DocxParagraph[] = [];
  for (const m of xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)) {
    const inner = m[1];
    const style = /<w:pStyle\s+w:val="([^"]*)"/.exec(inner)?.[1] ?? '';
    let text = '';
    for (const t of inner.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>/g)) text += t[1] === undefined ? ' ' : decode(t[1]);
    text = text.replace(/\s+/g, ' ').trim();
    if (text) out.push({ style, text });
  }
  return out;
}
```

- [ ] **Step 5: Run** the test — Expected: PASS. Also smoke-test against one real file with a throwaway `node -e` using `ts-node --transpile-only` printing the first 10 paragraphs of a revised Colorado file from `D:\Brainbaseedu Cirriculums`; confirm headings appear as `Heading1/2/3` (record exact style strings seen in the commit message).

- [ ] **Step 6: Commit** `feat: dependency-free docx paragraph reader`.

---

### Task 4: Curriculum structure parser

**Files:**
- Create: `server/src/modules/curricula/import/curriculum-parser.ts`
- Test: `server/src/tests/curriculum-import/curriculum-parser.test.ts`

**Interfaces:**
- Consumes: `DocxParagraph` (Task 3).
- Produces:
```ts
export interface ParsedChapter { title: string; topics: string[] }
export interface ParsedSubject { name: string; courseName?: string; note?: string; notVerified: boolean; chapters: ParsedChapter[] }
export interface ParsedGrade { grade: string; level: 'KINDERGARTEN' | 'GRADE'; subjects: ParsedSubject[] }
export interface ParsedDoc {
  grades: ParsedGrade[];
  skippedHighSchoolGrades: string[];
  countyParagraphs: DocxParagraph[];
  sourceParagraphs: DocxParagraph[];
}
export function parseCurriculumDoc(paras: DocxParagraph[]): ParsedDoc;
```
Rules: heading level = digits in a style matching `/^heading\s*(\d)$/i` (so `Heading1`, `Heading 1`, `heading1` all work). H1 matching `/^kindergarten\b/i` or `/^grade\s+(\d{1,2})\b/i` starts a grade (Grade ≥ 9 → its subtree is skipped and the label goes to `skippedHighSchoolGrades`); H1 `/^county additions/i` and `/^sources and verification/i` switch section and collect following paragraphs raw; H2 = subject, `"Name (Course)"` splits into `name`/`courseName`; paragraphs after H2 before first H3 form `note` (joined with a space); `note` starting `/^not verified/i` sets `notVerified`; H3 = chapter; any non-heading paragraph after an H3 is a topic (bullet or plain).

- [ ] **Step 1: Write the failing test**

```ts
import { parseCurriculumDoc } from '../../modules/curricula/import/curriculum-parser';

const h = (n: number, text: string) => ({ style: `Heading${n}`, text });
const li = (text: string) => ({ style: 'ListBullet', text });
const p = (text: string) => ({ style: '', text });

describe('parseCurriculumDoc', () => {
  it('reads grade > subject > chapter > topics from bullets', () => {
    const doc = parseCurriculumDoc([h(1, 'Kindergarten'), h(2, 'Mathematics'), p('Grade-band note'), h(3, 'Counting'), li('Count to 10'), li('Count to 20'), h(1, 'Grade 2'), h(2, 'Science'), h(3, 'Plants'), li('Seeds')]);
    expect(doc.grades.map((g) => [g.grade, g.level])).toEqual([['Kindergarten', 'KINDERGARTEN'], ['Grade 2', 'GRADE']]);
    const math = doc.grades[0].subjects[0];
    expect(math).toMatchObject({ name: 'Mathematics', note: 'Grade-band note', notVerified: false });
    expect(math.chapters).toEqual([{ title: 'Counting', topics: ['Count to 10', 'Count to 20'] }]);
  });
  it('reads plain paragraphs as topics (Georgia layout)', () => {
    const doc = parseCurriculumDoc([h(1, 'Grade 5'), h(2, 'Social Studies'), h(3, 'Colonial America'), p('Roanoke'), p('Jamestown')]);
    expect(doc.grades[0].subjects[0].chapters[0].topics).toEqual(['Roanoke', 'Jamestown']);
  });
  it('splits a course name from the subject', () => {
    const doc = parseCurriculumDoc([h(1, 'Grade 8'), h(2, 'Mathematics (Pre-Algebra)'), h(3, 'Ratios'), li('Rates')]);
    expect(doc.grades[0].subjects[0]).toMatchObject({ name: 'Mathematics', courseName: 'Pre-Algebra' });
  });
  it('flags Not verified subjects', () => {
    const doc = parseCurriculumDoc([h(1, 'Grade 1'), h(2, 'Dance'), p('Not verified: no state standard.')]);
    expect(doc.grades[0].subjects[0]).toMatchObject({ notVerified: true, chapters: [] });
  });
  it('accepts "Heading 1" and lowercase style spellings', () => {
    const doc = parseCurriculumDoc([{ style: 'Heading 1', text: 'Grade 1' }, { style: 'heading2', text: 'Science' }, { style: 'Heading 3', text: 'Air' }, li('Wind')]);
    expect(doc.grades[0].subjects[0].chapters[0].topics).toEqual(['Wind']);
  });
  it('skips grades 9 to 12 and reports them', () => {
    const doc = parseCurriculumDoc([h(1, 'Grade 9'), h(2, 'Science'), h(3, 'Cells'), li('x'), h(1, 'Grade 3'), h(2, 'Science'), h(3, 'Air'), li('y')]);
    expect(doc.grades.map((g) => g.grade)).toEqual(['Grade 3']);
    expect(doc.skippedHighSchoolGrades).toEqual(['Grade 9']);
  });
  it('separates county and source sections', () => {
    const doc = parseCurriculumDoc([h(1, 'Grade 1'), h(2, 'Science'), h(3, 'Air'), li('Wind'), h(1, 'County Additions'), h(2, 'Adams County'), h(1, 'Sources and Verification Notes'), h(3, 'Standards used'), li('Science: NGSS (2013) - https://x.org')]);
    expect(doc.countyParagraphs.map((x) => x.text)).toEqual(['Adams County']);
    expect(doc.sourceParagraphs.map((x) => x.text)).toEqual(['Standards used', 'Science: NGSS (2013) - https://x.org']);
  });
  it('keeps a subject with a chapter but no topics as an empty chapter', () => {
    const doc = parseCurriculumDoc([h(1, 'Grade 1'), h(2, 'Art'), h(3, 'Colour')]);
    expect(doc.grades[0].subjects[0].chapters).toEqual([{ title: 'Colour', topics: [] }]);
  });
});
```
County/source paragraphs keep their style so the sub-parsers can see headings (the test above compares only `.text`).

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement** as a single-pass state machine: `section: 'grades' | 'county' | 'sources'`, `skipGrade: boolean`, `currentGrade`, `currentSubject`, `currentChapter`. For an H1 that matches none of the known patterns and no section is open, ignore it. In `county`/`sources` sections push every paragraph (including headings) into the respective array. Non-heading paragraph handling: if `currentChapter` → push to topics; else if `currentSubject` → append to `noteParts`; finalise `note = noteParts.join(' ')` when the first H3 arrives or the subject ends, and set `notVerified = /^not verified/i.test(note)`. Wrap subject heading split with `/^(.*?)\s*\((.+)\)\s*$/`.

- [ ] **Step 4: Run** the test — Expected: PASS.

- [ ] **Step 5: Real-file smoke check.** Parse the Colorado revised file and Georgia master file; print per-grade counts of subjects/chapters/topics. Sanity: Kindergarten present for at least one file; Georgia topics > 0. Paste counts into the commit body.

- [ ] **Step 6: Commit** `feat: heading-based curriculum document parser`.

---

### Task 5: Sources parser

**Files:**
- Create: `server/src/modules/curricula/import/sources-parser.ts`
- Test: `server/src/tests/curriculum-import/sources-parser.test.ts`

**Interfaces:**
- Consumes: `DocxParagraph[]` (the `sourceParagraphs` from Task 4).
- Produces: `interface SourceRef { name: string; year: number | null; url: string }`; `parseSources(paras: DocxParagraph[]): { bySubject: Map<string, SourceRef>; stateWide: SourceRef | null; notes: string[] }`; `pickSource(sources, subjectName): SourceRef | null` (subject match case-insensitive and by "starts with"; falls back to `stateWide`).

Rules: a paragraph is a citation if it contains a URL (`/https?:\/\/\S+/`). Year = first `/\b(19|20)\d{2}\b/`. Text before the first `:` becomes the subject key only when the prefix is ≤ 40 chars and has no URL; the citation name is the remainder before the URL, stripped of `- `, `(year)` and trailing punctuation. Citations without a subject prefix become `stateWide` (first one wins). Paragraphs without URL inside headings like "Build warnings", "Notes", "Not verified" are collected to `notes`.

- [ ] **Step 1: Write the failing test**

```ts
import { parseSources, pickSource } from '../../modules/curricula/import/sources-parser';

const li = (text: string) => ({ style: 'ListBullet', text });
const h3 = (text: string) => ({ style: 'Heading3', text });

describe('parseSources', () => {
  it('reads "Subject: Name (year) - url" lines', () => {
    const s = parseSources([h3('Standards used'), li('Mathematics: Colorado Academic Standards (2020) - https://cde.state.co.us/math'), li('Science: NGSS (2013) - https://nextgenscience.org')]);
    expect(pickSource(s, 'Mathematics')).toEqual({ name: 'Colorado Academic Standards', year: 2020, url: 'https://cde.state.co.us/math' });
    expect(pickSource(s, 'science')?.year).toBe(2013);
  });
  it('uses a state-wide citation when the subject has none (Georgia layout)', () => {
    const s = parseSources([h3('Sources Used for Georgia'), { style: '', text: 'Georgia Standards of Excellence (2021) https://www.gadoe.org/standards' }]);
    expect(pickSource(s, 'Social Studies')).toEqual({ name: 'Georgia Standards of Excellence', year: 2021, url: 'https://www.gadoe.org/standards' });
  });
  it('returns null and keeps notes when nothing matches', () => {
    const s = parseSources([h3('Notes'), { style: '', text: 'Some caveat' }]);
    expect(pickSource(s, 'Art')).toBeNull();
    expect(s.notes).toEqual(['Some caveat']);
  });
});
```

- [ ] **Step 2: Run** — Expected: FAIL. **Step 3:** implement per rules. **Step 4:** Run — PASS.
- [ ] **Step 5: Real-file check:** run over the Colorado, Hawaii and Georgia source sections; every enabled subject (ELA, Mathematics, Science, Social Studies, Computer Science) should resolve to a source or be listed as a gap — print the gaps. Adjust the regexes only if a real citation is mis-split (add a test line for the failing sample).
- [ ] **Step 6: Commit** `feat: parse standards sources from document`.

---

### Task 6: County additions parser and model

**Files:**
- Create: `server/src/modules/curricula/county-addition.model.ts`
- Create: `server/src/modules/curricula/import/county-parser.ts`
- Test: `server/src/tests/curriculum-import/county-parser.test.ts`

**Interfaces:**
- Produces: `interface ParsedCountyAddition { county: string; district: string; gradeFrom: number; gradeTo: number; category: string; description: string }` (Kindergarten = 0); `parseCountyAdditions(paras: DocxParagraph[]): ParsedCountyAddition[]`; Mongoose model `CountyAdditionModel` (collection `countyadditions`) with fields `publicId, stateCode, county, district, gradeFrom, gradeTo, category, subjectName?, description, topics: string[], isPublished (default false), isDeleted`; unique index `{stateCode, county, district, gradeFrom, gradeTo, category}`.

Rules: H2 = county/district heading (`district` = the heading text when it contains "District", otherwise `''`; `county` = heading text); H3 = grade band: numbers via `/\d+/g`, `kindergarten` → 0, one number → from = to, none → 0–12; lines matching `/^([^:]{2,40}):\s*(.+)$/` → category + description (other lines are appended to the previous entry's description).

- [ ] **Step 1: Write the failing test**

```ts
import { parseCountyAdditions } from '../../modules/curricula/import/county-parser';
const h = (n: number, text: string) => ({ style: `Heading${n}`, text });
const li = (text: string) => ({ style: 'ListBullet', text });

it('reads county, grade band and category lines', () => {
  const out = parseCountyAdditions([h(1, 'County Additions'), h(2, 'Adams County'), h(3, 'Grades 3-5'), li('Local history: Study of the Front Range'), li('Field trip: Farm visit'), h(3, 'Kindergarten'), li('Community: Helpers')]);
  expect(out).toEqual([
    { county: 'Adams County', district: '', gradeFrom: 3, gradeTo: 5, category: 'Local history', description: 'Study of the Front Range' },
    { county: 'Adams County', district: '', gradeFrom: 3, gradeTo: 5, category: 'Field trip', description: 'Farm visit' },
    { county: 'Adams County', district: '', gradeFrom: 0, gradeTo: 0, category: 'Community', description: 'Helpers' },
  ]);
});
it('treats a District heading as district', () => {
  const out = parseCountyAdditions([h(2, 'Denver Public School District'), h(3, 'Grade 1'), li('Art: Murals')]);
  expect(out[0]).toMatchObject({ district: 'Denver Public School District', gradeFrom: 1, gradeTo: 1 });
});
```
- [ ] **Step 2–4:** fail, implement parser + model, pass. **Step 5:** run against the Georgia master county section; print count and first 3 entries; confirm nothing has an empty category. **Step 6: Commit** `feat: county additions parser and model`.

---

### Task 7: Importer service (drafts, idempotent, report)

**Files:**
- Create: `server/src/modules/curricula/import/curriculum-importer.ts`
- Test: `server/src/tests/curriculum-import/curriculum-importer.test.ts`

**Interfaces:**
- Consumes: Tasks 3–6 functions; `CurriculumModel`, `CountyAdditionModel`.
- Produces:
```ts
export interface ImportFile { path: string; stateCode: string; kind: 'revised' | 'master' }
export interface StateReport {
  stateCode: string; kind: 'revised' | 'master';
  created: number; updated: number; unchanged: number; skippedPublished: number;
  chapters: number; topics: number;
  subjectsSkippedNotVerified: string[]; emptySubjects: string[];
  emptyChapters: string[]; missingSource: string[]; highSchoolSkipped: string[];
  countyAdditions: number; subjectsSeen: string[];
}
export function planImport(file: ImportFile, doc: ParsedDoc): PlannedCurriculum[]   // pure, no DB
export async function applyImport(file: ImportFile, doc: ParsedDoc, opts: { commit: boolean }): Promise<StateReport>
```
`PlannedCurriculum` = `{ key: {stateCode, subject, grade, courseName}, title, level, source, chapters: {title, topics: string[]}[] }`. Title = `${subject}${courseName ? ' - ' + courseName : ''} - ${grade}`. Nothing is written when `commit` is false; the report is identical either way.

Rules for `applyImport` (commit=true): look up by key; none → create draft (`isPublished:false`, `createdByAdminPublicId:'system:curriculum-import'`, `sourceKind`, `source`); found + `isPublished` → `skippedPublished++`; found + draft → keep existing chapter/topic publicIds by matching titles (chapter by title, topic by title within chapter), rebuild, save; if nothing changed → `unchanged++`. Subjects with `notVerified` or no chapters go into the report lists, not the database. County additions upsert by their unique key as drafts.

- [ ] **Step 1: Write the failing test.** Cover `planImport` purely (no DB): skips notVerified and empty subjects; builds title with course; reports `missingSource` when no source resolves; counts chapters/topics. Then DB-backed idempotency using the repo's existing DB test approach — first check `server/src/tests` for `mongodb-memory-server` or an existing DB test setup (`grep -rn "memory-server" server/package.json server/src/tests | head`). If present, add: run `applyImport(commit:true)` twice → second run `created 0, unchanged N`, chapter publicIds identical; a curriculum flipped to `isPublished:true` is `skippedPublished` and untouched. If no in-memory DB exists, mock `CurriculumModel.findOne/create/save` with `jest.spyOn` for the same assertions.

```ts
import { planImport } from '../../modules/curricula/import/curriculum-importer';
const doc = {
  grades: [{ grade: 'Grade 2', level: 'GRADE' as const, subjects: [
    { name: 'Mathematics', courseName: undefined, notVerified: false, chapters: [{ title: 'Add', topics: ['a', 'b'] }] },
    { name: 'Dance', notVerified: true, chapters: [] },
    { name: 'Art', notVerified: false, chapters: [] },
  ] }],
  skippedHighSchoolGrades: ['Grade 9'], countyParagraphs: [],
  sourceParagraphs: [{ style: 'ListBullet', text: 'Mathematics: CAS (2020) - https://x.org/m' }],
};
it('plans only subjects with content and reports the rest', () => {
  const plan = planImport({ path: 'x', stateCode: 'CO', kind: 'revised' }, doc);
  expect(plan).toHaveLength(1);
  expect(plan[0]).toMatchObject({ title: 'Mathematics - Grade 2', key: { stateCode: 'CO', subject: 'Mathematics', grade: 'Grade 2' }, source: { year: 2020 } });
});
```
- [ ] **Step 2: Run** — FAIL. **Step 3:** implement. **Step 4:** Run — PASS. **Step 5: Commit** `feat: idempotent draft importer with per-state report`.

---

### Task 8: Import CLI with dry-run default, backup and database confirmation

**Files:**
- Create: `server/src/scripts/import-state-curricula.ts`
- Test: `server/src/tests/curriculum-import/import-cli-guard.test.ts`

**Interfaces:**
- Produces exported pure helper `checkCommitGuard(args: { commit: boolean; confirmDb?: string; connectedDb: string; backupPath?: string }): void` that throws `Error('...')` unless `commit` is false, or `confirmDb === connectedDb` and `backupPath` is set.
- CLI usage: `npx ts-node --transpile-only src/scripts/import-state-curricula.ts --dir "D:\Brainbaseedu Cirriculums" [--commit --confirm-db=<db> --backup-dir=<dir>]`. A manifest constant in the script maps file names to `{stateCode, kind}` for the 7 states (Alaska AK, Colorado CO, Hawaii HI, Idaho ID, Iowa IA, Louisiana LA → `revised`; Georgia GA → `master`), derived from file names via `stateCodeFromName`; exact filenames confirmed by listing the directory in Step 1 and hard-coding them.

- [ ] **Step 1: List the source directory** (`ls "D:/Brainbaseedu Cirriculums"`) and write the manifest with the real filenames; skip California/Missouri (new format, not in first release).

- [ ] **Step 2: Write the failing test**

```ts
import { checkCommitGuard } from '../../scripts/import-state-curricula';

describe('checkCommitGuard', () => {
  it('allows dry-run with nothing else', () => {
    expect(() => checkCommitGuard({ commit: false, connectedDb: 'prod' })).not.toThrow();
  });
  it('refuses commit without database confirmation', () => {
    expect(() => checkCommitGuard({ commit: true, connectedDb: 'prod', backupPath: 'b.json' })).toThrow(/confirm-db/);
  });
  it('refuses commit when confirmation names another database', () => {
    expect(() => checkCommitGuard({ commit: true, confirmDb: 'test', connectedDb: 'prod', backupPath: 'b.json' })).toThrow(/does not match/);
  });
  it('refuses commit without a backup', () => {
    expect(() => checkCommitGuard({ commit: true, confirmDb: 'prod', connectedDb: 'prod' })).toThrow(/backup/i);
  });
  it('allows a confirmed, backed-up commit', () => {
    expect(() => checkCommitGuard({ commit: true, confirmDb: 'prod', connectedDb: 'prod', backupPath: 'b.json' })).not.toThrow();
  });
});
```
The script must only run `main()` when executed directly (`if (require.main === module)`), so importing it in the test has no side effects.

- [ ] **Step 3: Run** — FAIL. **Step 4: Implement:** connect with `env.MONGODB_URI` (as `seed-super-admin.ts` does; print host and db name only); read args; for each file `readDocxParagraphs` → `parseCurriculumDoc` → `applyImport(..., {commit})`; on `--commit`, before the first write dump the whole `curricula` and `countyadditions` collections to `<backup-dir>/curricula-backup-<timestamp>.json` and pass its path into `checkCommitGuard`; print the report as a table per state plus totals; write the same report as JSON next to the backup (dry-run writes `curriculum-import-report-<timestamp>.json` in the current directory).
- [ ] **Step 5: Run** guard tests — PASS. **Step 6: Dry-run** against the local test database (`MONGODB_URI` in `server/.env` points at the test cluster — say so in output) and read the report for all 7 states; save it in the PR description. Do **not** pass `--commit` in this plan; the production load is a separate, user-approved step (Task 11).
- [ ] **Step 7: Commit** `feat: state curriculum import CLI with dry-run, backup and db confirmation`.

---

### Task 9: enabledSubjects setting and state-based catalog

**Files:**
- Modify: `server/src/modules/settings/settings.model.ts`, `settings.service.ts`, settings DTO/validator (find via `grep -rn "maxClassDurationMinutes" server/src/modules/settings`)
- Modify: `server/src/modules/curricula/curriculum.service.ts`, `curriculum.controller.ts`, `curriculum.routes.ts`, `curriculum.validators.ts`
- Test: `server/src/tests/curriculum-import/curriculum.catalog.test.ts`

**Interfaces:**
- Produces: `PLATFORM_SETTINGS_DEFAULTS.enabledSubjects = ['English Language Arts', 'Mathematics', 'Science', 'Social Studies', 'Computer Science']` (confirm names against the Task 8 report's `subjectsSeen`; adjust the default to the exact names files use). `curriculumService.listByState({ stateCode: string; grade?: string; subject?: string }): Promise<{ curricula: ICurriculum[]; stateLoaded: boolean }>` — published, non-deleted, `stateCode` match, subject in `enabledSubjects`, sorted by `gradeRank` then title; `stateLoaded` is true if any published curriculum exists for the state. Route `GET /curricula/catalog/state?stateCode=CO&grade=Grade 3` (any authenticated role), placed **before** `/:curriculumPublicId` in `curriculum.routes.ts`. Zod: `stateCode` = `z.enum(US_STATES codes)`.

- [ ] **Step 1: Write the failing test** with `jest.spyOn(CurriculumModel, 'find')` and `settingsService.get` mocked: disabled subject filtered out; Kindergarten sorts before Grade 1; `stateLoaded:false` when nothing published; unknown state code rejected by the zod schema.
- [ ] **Step 2–4:** fail, implement (settings key added to defaults, model schema `enabledSubjects: [String]` with default, `EDITABLE_KEYS` handling for arrays in `settingsService.update` — validate every entry is a non-empty string), pass. The `list` controller for non-admins uses `curriculumCatalogQuerySchema` which requires `districtId`: leave it untouched (legacy path) and add the new route separately.
- [ ] **Step 5: Run full server suite** `cd server && npx jest` — all green. **Step 6: Commit** `feat: state-based curriculum catalog with subject switches`.

---

### Task 10: Student catalog page shows state curricula

**Files:**
- Modify: `frontend/src/pages/student/StudentCurriculumPage.tsx` and its service file (find via `grep -rn "curricula" frontend/src/services`)
- Modify: student registration/profile so a `state` exists (already stored as `state` on the student profile; use it as `stateCode`).

- [ ] **Step 1:** Add service `getStateCatalog(stateCode, grade?)` calling the Task 9 route.
- [ ] **Step 2:** In `StudentCurriculumPage`, when the student has a state: call the new catalog with their grade, show each curriculum with its chapters and topics collapsed (chapter title, count of topics; expand to list), plus the source line (`source.name`, year, link). When `stateLoaded` is false: show the message "Your state's curriculum isn't available yet — we've noted your interest". In this plan only the message is shown; recording the demand ships in Plan 3, so wording should not yet claim it was noted — use "Your state's curriculum isn't available yet. We're adding states over time." until Plan 3.
- [ ] **Step 3:** `cd frontend && npx tsc --noEmit && npm run build`. Manually verify in the browser against a local test DB into which Task 8's CLI has committed one state (`--commit --confirm-db=<local db name>`), then publish one curriculum through the existing admin publish endpoint and reload the page.
- [ ] **Step 4: Commit** `feat: student sees state curricula with chapters`.

---

### Task 11: Production rehearsal and load (needs user go-ahead — do not run unattended)

- [ ] **Step 1:** Ask the user which database is production and get the exact database name (only `brainbbasedutest` is known from `server/.env`).
- [ ] **Step 2:** Dry-run against that connection; give the user the per-state report (counts, skipped subjects, missing sources, high school skipped, Georgia's repeated-content subjects) and wait for approval.
- [ ] **Step 3:** With approval only: run with `--commit --confirm-db=<name> --backup-dir=<dir>`; keep the backup file; re-run dry-run to show `unchanged` for everything.
- [ ] **Step 4:** Report totals to the user. Publishing drafts stays a separate, admin-side decision.

---

## Later plans (outline only; each gets its own plan after this one ships)

**Plan 2 — Chapters in the course flow:** course requests by `chapterPublicIds` (replaces topic pick), price/class count from chapter list, `schedule` class fields `chapterPublicId`, `intendedTopicPublicIds`, `coveredTopicPublicIds`; tutor prompt with checkboxes of intended topics at class completion (prompt only, never blocking); course progress from covered topics; remove the `topics` mirror consumer by consumer (`course.service.ts`, `course-structure.ts`, `course-progress.ts`, `course.validators.ts`, `TutorCourseRequestsPage.tsx`, `StudentCreateCoursePage.tsx`, `CurriculumTopicPicker.tsx`).

**Plan 3 — Materials, admin editing, demand:** materials `attachments: [{chapterPublicId, topicPublicIds?}]` across worksheets/assignments/resources (`curriculum-attachment.ts`, `material-access.ts`, `AdminMaterialForms.tsx`); admin edit screens for chapters/topics with deletion guards; subject-switch UI in settings; `StateRequest` demand records and admin demand list; county additions display (info only); conversion script turning existing district curricula into state curricula (dry-run first); Grade 9–12 handling once the high-school discussion concludes.
