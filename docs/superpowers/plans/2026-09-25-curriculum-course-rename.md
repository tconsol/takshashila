# Curriculum / Course Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the admin-authored `Course` to `Curriculum` and the student's `CourseRequest` to `Course` across server, frontend, API and database, with no behaviour change.

**Architecture:** A scripted, ordered token rename (so the two meanings of "course" never collide) applied to `server/src` and `frontend/src`, including file moves; then targeted manual fixups the script can't know (Mongo collection name, response keys, route params, UI copy); then a guarded data-migration script for the collections and fields.

**Tech Stack:** TypeScript, Express, Mongoose, Jest; React + TanStack Query; Python 3 for the one-off rename tool (not committed).

**Spec:** `docs/superpowers/specs/2026-09-25-curriculum-course-rename-design.md`

## Global Constraints

- Pure rename — no behaviour change. Full server suite count stays 213 before the new tests added here.
- Persisted strings stay exactly: `'COURSE_REQUEST_ACCEPT'`, `'COURSE_REQUEST_CANCEL'`, `` `course-request-accept-${…}` ``, `` `course-request-cancel-${…}` ``, `` `course-class-${…}-${…}` ``, `` `course-class-cancel-refund-${…}` ``; each gets the comment `// Persisted in wallettransactions — do not rename (see rename spec §3.5).`
- Kept names: `COURSE_PREPAID`, `COURSE_CLASS_SCHEDULED`, `scheduleCourseClassSchema`, `ScheduleCourseClassDto`, `useScheduleCourseClass`, `coursePrepaidClass`, `TutorCourseRequestsPage`, `MyCoursesSection`, `StudentCourseProgressPage`, `CourseProgress`, `useCourseProgress`, `computeTopicProgress`, file `course-progress.ts`.
- Curriculum Mongoose model uses collection `'curricula'` explicitly; Course model collection is `'courses'`.
- Student URLs: `/dashboard/student/curriculum`, `/dashboard/student/curriculum/:curriculumPublicId`, `/dashboard/student/courses`, `/dashboard/student/courses/:coursePublicId`. Tutor `/dashboard/tutor/course-requests` and admin `/dashboard/admin/curriculum` unchanged.
- API: `/curricula…` (was `/courses…`), `/courses…` (was `/course-requests…`); route param for a student course is `:coursePublicId`.
- Historical docs under `docs/superpowers/` are not touched.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. The Curriculum model must read/write collection `curricula` — Mongoose would default to `curriculums`, silently reading an empty collection after migration. — Task 1 test.
2. Wallet `referenceType` and idempotency-key strings must be byte-identical after the rename, or a retried accept/cancel could double-charge/refund. — Task 1 test.
3. Migration run twice, or on a half-migrated DB, must refuse rather than rename `courses` (now student courses) into `curricula`. — Task 4 test.
4. ScheduledClass field swap: `coursePublicId` must become `curriculumPublicId` **before** `courseRequestPublicId` becomes `coursePublicId`, or curriculum ids overwrite course ids. — Task 4 test.
5. UI copy: automated rename turns every "course" into "curriculum"; student-course wording ("My courses", "Send course to tutor", "Course not found") must be restored. — Task 3 leftover check + manual list.

---

## File Structure

Server moves (git mv, done by the tool):
- `src/modules/courses/course.*.ts` → `src/modules/curricula/curriculum.*.ts`
- `src/modules/course-requests/course-request.*.ts` → `src/modules/courses/course.*.ts`; `course-progress.ts` → `src/modules/courses/course-progress.ts`
- Tests: `src/tests/modules/course.*.test.ts` → `curriculum.*.test.ts`; `course-request.*.test.ts` → `course.*.test.ts`; `course-progress.test.ts` stays.
- Scripts: `migrate-course-districts.ts` → `migrate-curriculum-districts.ts`; `resolve-course-district.ts` → `resolve-curriculum-district.ts`.
- New: `src/scripts/curriculum-course-rename-plan.ts` (pure planner), `src/scripts/migrate-curriculum-course-rename.ts`, tests `src/tests/modules/rename.names.test.ts`, `src/tests/modules/rename.migration.test.ts`.

Frontend moves:
- `services/courses.service.ts` → `services/curricula.service.ts`; `services/course-requests.service.ts` → `services/courses.service.ts`
- `hooks/use-courses.ts` → `hooks/use-curricula.ts`; `hooks/use-course-requests.ts` → `hooks/use-courses.ts`
- `pages/student/StudentCoursesPage.tsx` → `StudentCurriculumPage.tsx`; `StudentCourseDetailPage.tsx` → `StudentCreateCoursePage.tsx`; `StudentCourseRequestsPage.tsx` → `StudentMyCoursesPage.tsx`

---

### Task 1: Pin the post-rename names (failing tests first)

**Files:**
- Create: `server/src/tests/modules/rename.names.test.ts`

**Interfaces:**
- Produces: expectations Tasks 2–3 must satisfy: `CurriculumModel` from `modules/curricula/curriculum.model` (collection `curricula`), `CourseModel` from `modules/courses/course.model` (collection `courses`, fields `curriculumPublicId`, `topicPublicIds`), `ScheduledClassModel` fields `coursePublicId`, `curriculumPublicId`, `topicPublicId`, `DomainEvent.COURSE_CREATED…COURSE_COMPLETED`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/modules/rename.names.test.ts
import fs from 'fs';
import path from 'path';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { CourseModel } from '../../modules/courses/course.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { DomainEvent } from '../../constants/events';

describe('curriculum/course rename — names', () => {
  it('stores curricula in "curricula" and student courses in "courses"', () => {
    expect(CurriculumModel.collection.collectionName).toBe('curricula');
    expect(CourseModel.collection.collectionName).toBe('courses');
  });

  it('a course references its curriculum and topics by the new field names', () => {
    const paths = Object.keys(CourseModel.schema.paths);
    expect(paths).toEqual(expect.arrayContaining(['curriculumPublicId', 'topicPublicIds']));
    expect(paths).not.toContain('coursePublicId');
    expect(paths).not.toContain('selectedTopicPublicIds');
  });

  it('a scheduled class links course, curriculum and topic by the new field names', () => {
    const paths = Object.keys(ScheduledClassModel.schema.paths);
    expect(paths).toEqual(expect.arrayContaining(['coursePublicId', 'curriculumPublicId', 'topicPublicId']));
    expect(paths).not.toContain('courseRequestPublicId');
    expect(paths).not.toContain('courseTopicPublicId');
  });

  it('course events use the COURSE_* names', () => {
    expect(DomainEvent).toEqual(expect.objectContaining({
      COURSE_CREATED: 'COURSE_CREATED',
      COURSE_ACCEPTED: 'COURSE_ACCEPTED',
      COURSE_REJECTED: 'COURSE_REJECTED',
      COURSE_CANCELLED: 'COURSE_CANCELLED',
      COURSE_COMPLETED: 'COURSE_COMPLETED',
      COURSE_CLASS_SCHEDULED: 'COURSE_CLASS_SCHEDULED',
    }));
    expect(Object.keys(DomainEvent).some((k) => k.startsWith('COURSE_REQUEST_'))).toBe(false);
  });

  it('keeps persisted wallet strings byte-identical', () => {
    const src = [
      fs.readFileSync(path.join(__dirname, '../../modules/courses/course.service.ts'), 'utf8'),
      fs.readFileSync(path.join(__dirname, '../../modules/classes/class.service.ts'), 'utf8'),
    ].join('\n');
    for (const s of [
      "'COURSE_REQUEST_ACCEPT'",
      "'COURSE_REQUEST_CANCEL'",
      '`course-request-accept-${',
      '`course-request-cancel-${',
      '`course-class-${',
      '`course-class-cancel-refund-${',
    ]) {
      expect(src).toContain(s);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `server/`): `npx jest src/tests/modules/rename.names`
Expected: FAIL — `Cannot find module '../../modules/curricula/curriculum.model'`.

(Commit happens with Task 2 — the suite can't be green in between.)

---

### Task 2: Server rename

**Files:** every `*.ts` under `server/src` except `src/modules/geo/*.json`, the future migration files (Task 4), and `rename.names.test.ts`.

**Interfaces:**
- Consumes: Task 1 expectations.
- Produces: server API per spec §3.4; exported names per spec §3.1 with these rulings on names the spec left open: admin list query `courseCatalogQuerySchema/CourseCatalogQueryDto` → `curriculumAdminQuerySchema/CurriculumAdminQueryDto`; student catalog `studentCatalogQuerySchema/StudentCatalogQueryDto` → `curriculumCatalogQuerySchema/CurriculumCatalogQueryDto`; `findForCourse` → `findForCurriculum`; `CourseTutorCard` → `CurriculumTutorCard`; progress response `{ request, course, topics, otherClasses }` → `{ course, curriculum, topics, otherClasses }`.

- [ ] **Step 1: Save the rename tool** to the session scratchpad as `rename_tool.py` (not committed):

```python
"""Ordered token rename: CourseRequest-family -> tokens, Course-family -> Curriculum,
tokens -> Course. Protected strings are hidden first and restored last."""
import os, re, subprocess, sys

ROOT = sys.argv[1]          # e.g. D:/takshashila/server/src
REPO = sys.argv[2]          # e.g. D:/takshashila
SKIP_FILES = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else set()

PROTECT = [
    "'COURSE_REQUEST_ACCEPT'", "'COURSE_REQUEST_CANCEL'",
    'course-request-accept-', 'course-request-cancel-', 'course-class-',
    'COURSE_PREPAID', 'COURSE_CLASS_SCHEDULED', 'coursePrepaidClass', 'CourseClass',
    'TutorCourseRequestsPage', 'MyCoursesSection', 'features/courses/',
    'StudentCourseProgressPage', 'CourseProgress', 'course-progress',
]
PRE = [  # applied before the phases; outputs that still contain "Course" are tokens
    (r'courseTopicPublicId', 'topicPublicId'),
    (r'selectedTopicPublicIds', 'topicPublicIds'),
    (r'my-courses/', '@@MYC@@'),
    (r'StudentCourseDetailPage', '@@SCCP@@'),
    (r'StudentCourseRequestsPage', '@@SMCP@@'),
    (r'StudentCoursesPage', 'StudentCurriculumPage'),
]
PHASE1 = [  # CourseRequest family -> tokens
    (r'COURSE_REQUEST_', '@@CRU@@'),
    (r'CourseRequests', '@@CRS@@'), (r'CourseRequest', '@@CR@@'),
    (r'courseRequests', '@@crs@@'), (r'courseRequest', '@@cr@@'),
    (r'course-requests', '@@c-rs@@'), (r'course-request', '@@c-r@@'),
    (r'Course requests', '@@Cr_s@@'), (r'course requests', '@@cr_s@@'),
    (r'Course request', '@@Cr_@@'), (r'course request', '@@cr_@@'),
]
PHASE2 = [  # remaining Course family -> Curriculum
    (r'COURSES', 'CURRICULA'), (r'COURSE', 'CURRICULUM'),
    (r'Courses', 'Curricula'), (r'Course', 'Curriculum'),
    (r'courses', 'curricula'), (r'course', 'curriculum'),
]
PHASE3 = [  # tokens -> Course
    ('@@CRU@@', 'COURSE_'), ('@@CRS@@', 'Courses'), ('@@CR@@', 'Course'),
    ('@@crs@@', 'courses'), ('@@cr@@', 'course'),
    ('@@c-rs@@', 'courses'), ('@@c-r@@', 'course'),
    ('@@Cr_s@@', 'Course requests'), ('@@cr_s@@', 'course requests'),
    ('@@Cr_@@', 'Course request'), ('@@cr_@@', 'course request'),
    ('@@MYC@@', 'courses/'),
    ('@@SCCP@@', 'StudentCreateCoursePage'), ('@@SMCP@@', 'StudentMyCoursesPage'),
]

def transform(text):
    saved = {}
    for i, p in enumerate(PROTECT):
        tok = f'@@P{i}@@'
        text = text.replace(p, tok)
        saved[tok] = p
    for a, b in PRE + PHASE1 + PHASE2:
        text = re.sub(a, b, text)
    for a, b in PHASE3:
        text = text.replace(a, b)
    for tok, p in saved.items():
        text = text.replace(tok, p)
    return text

changed, moves = 0, []
for dirpath, _, files in os.walk(ROOT):
    for f in files:
        if not f.endswith(('.ts', '.tsx')):
            continue
        full = os.path.join(dirpath, f)
        rel = os.path.relpath(full, REPO).replace('\\', '/')
        if rel in SKIP_FILES:
            continue
        src = open(full, encoding='utf8').read()
        out = transform(src)
        if out != src:
            open(full, 'w', encoding='utf8', newline='').write(out)
            changed += 1
        new_rel = transform(rel)
        if new_rel != rel:
            moves.append((rel, new_rel))

# Two-step moves: targets can be another file's current name
# (course-request.service.test.ts -> course.service.test.ts), so park everything first.
git = lambda *a: subprocess.run(['git', '-C', REPO, *a], check=True)
for rel, _ in moves:
    git('mv', rel, rel + '.tmpmv')
for rel, new_rel in moves:
    os.makedirs(os.path.dirname(os.path.join(REPO, new_rel)), exist_ok=True)
    git('mv', rel + '.tmpmv', new_rel)
print(f'changed {changed} files, moved {len(moves)}')
```

Note: `transform(rel)` maps `server/src/modules/courses/course.model.ts` → `server/src/modules/curricula/curriculum.model.ts` and `server/src/modules/course-requests/course-request.model.ts` → `server/src/modules/courses/course.model.ts`. All moves are parked under a `.tmpmv` name first, so a target that is another file's current name is free by the time it's used.

- [ ] **Step 2: Run the tool on the server**

```bash
cd D:/takshashila
python <scratchpad>/rename_tool.py D:/takshashila/server/src D:/takshashila server/src/tests/modules/rename.names.test.ts
```
Expected: prints `changed N files, moved M`; `git status` shows renames only under the listed paths.

- [ ] **Step 3: Manual fixups** (each is a small edit):

1. `modules/curricula/curriculum.model.ts`: `mongoose.model<ICurriculum>('Curriculum', curriculumSchema, 'curricula')`.
2. Persisted strings: add `// Persisted in wallettransactions — do not rename (see rename spec §3.5).` above each of the six strings in `modules/courses/course.service.ts` and `modules/classes/class.service.ts`.
3. `modules/courses/course.service.ts` `getProgress` return: key `curriculum:` is the curriculum info (the tool produced it from `course:`); rename the old `request:` key to `course:`. Rename the method's local `request` variable to `course` and the local `curriculum` document variable stays `curriculum`.
4. Route params and event payloads in `modules/courses/*` and `modules/classes/class.service.ts`: `requestPublicId` → `coursePublicId` (routes `/:coursePublicId/...`, controller `req.params.coursePublicId`, service parameter names, event payload key). Do **not** touch `requestPublicId` outside these files (demo/parent requests use it).
5. Curriculum names the spec fixed: rename `curriculumCatalogQuerySchema/CurriculumCatalogQueryDto` (tool output of the admin query) → `curriculumAdminQuerySchema/CurriculumAdminQueryDto` first, then `studentCatalogQuerySchema/StudentCatalogQueryDto` → `curriculumCatalogQuerySchema/CurriculumCatalogQueryDto`.
6. Old migration scripts keep working on the new names: confirm `migrate-county-to-fips.ts` TARGETS reads `{ collection: 'curricula', label: 'curriculum' }` and `migrate-curriculum-districts.ts` reads `mongoose.connection.collection('curricula')`; update their doc comments' usage lines to the new file names.
7. Read `git diff --stat` and skim every changed comment in `modules/courses/*`: prose that now says "curriculum" but describes the student's course → "course".

- [ ] **Step 4: Verify**

Run (from `server/`): `npx tsc --noEmit -p .` → no errors.
Run: `npx jest --runInBand` → all suites pass; test count = 213 + 5 (Task 1).
Run: `grep -rnE "CourseRequest|courseRequest|course-request|selectedTopicPublicIds|courseTopicPublicId|COURSE_REQUEST_[A-Z]+:" src | grep -vE "'COURSE_REQUEST_(ACCEPT|CANCEL)'|course-request-(accept|cancel)-"` → no output.

- [ ] **Step 5: Commit**

```bash
git add -A server/src
git commit -m "refactor(server): rename Course->Curriculum and CourseRequest->Course"
```

---

### Task 3: Frontend rename

**Files:** every `*.ts`/`*.tsx` under `frontend/src`.

**Interfaces:**
- Consumes: server API from Task 2 (`/curricula…`, `/courses…`, fields `curriculumPublicId`, `topicPublicIds`, `topicPublicId`, `curriculumTitle`, progress `{ course, curriculum, topics, otherClasses }`).
- Produces: routes and page names in Global Constraints.

- [ ] **Step 1: Run the tool on the frontend**

```bash
cd D:/takshashila
python <scratchpad>/rename_tool.py D:/takshashila/frontend/src D:/takshashila
```

Expected: `course-requests.service.ts` → `courses.service.ts`, `use-course-requests.ts` → `use-courses.ts`, the three student pages renamed per File Structure.

- [ ] **Step 2: Manual fixups**

1. `routes/index.tsx`: student paths exactly as Global Constraints — tool output `/dashboard/student/curricula` → `/dashboard/student/curriculum`, `/dashboard/student/curricula/:curriculumPublicId` → `/dashboard/student/curriculum/:curriculumPublicId`; confirm `/dashboard/student/courses` (My courses page) and `/dashboard/student/courses/:coursePublicId` (progress). Same for every `Link to=`/`navigate(` using those paths, and `components/shared/Sidebar.tsx`: student item "Curriculum" → `/dashboard/student/curriculum`; add "My courses" → `/dashboard/student/courses` if absent.
2. Progress page (`StudentCourseProgressPage.tsx`): destructure `{ course, curriculum, topics, otherClasses }`; header uses `curriculum.title/subject/grade/district`, counts use `course.*`; route param `coursePublicId`.
3. Hook names per spec §3.6: `useCoursesAsStudent` → `useMyCourses`, `useCoursesAsTutor` → `useIncomingCourses`, `useAcceptCourse/useRejectCourse/useCancelCourse`, `useCreateCourse` (student) — in `hooks/use-courses.ts` and all callers. Keys object `courseKeys` (student courses) vs `curriculumKeys` (curricula).
4. UI copy — restore student-course wording (search `curriculum` in these files and fix): `features/courses/MyCoursesSection.tsx` ("My courses", "No courses yet"), `StudentMyCoursesPage.tsx` (title "My courses"), `StudentCreateCoursePage.tsx` (submit "Send course to tutor", toast via hook "Course sent to tutor"), `StudentCourseProgressPage.tsx` ("Course not found"), `TutorCourseRequestsPage.tsx` (title stays "Course requests"), hooks' toasts: curriculum hooks say "Curriculum created/updated/deleted/published", course hooks say "Course sent to tutor" / "Course accepted" etc.
5. `rg -n "curricul" frontend/src/pages/student frontend/src/features frontend/src/pages/tutor` and read each hit; anything describing the student's bundle of topics → "course".

- [ ] **Step 3: Verify**

Run (from `frontend/`): `npx tsc --noEmit -p .` → clean; `npx vite build` → success.
Run: `grep -rnE "CourseRequest|courseRequest|course-request|selectedTopicPublicIds|courseTopicPublicId|/courses/:coursePublicId'" src | grep -v TutorCourseRequestsPage | grep -v "dashboard/tutor/course-requests"` → only the intended `/dashboard/student/courses/:coursePublicId` route line, nothing else.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(frontend): Curriculum/Course terminology, routes and copy"
```

---

### Task 4: Data migration (planner + script)

**Files:**
- Create: `server/src/scripts/curriculum-course-rename-plan.ts`
- Create: `server/src/scripts/migrate-curriculum-course-rename.ts`
- Test: `server/src/tests/modules/rename.migration.test.ts`

**Interfaces:**
- Produces: `planRenameSteps(state: DbState): Plan` where `interface DbState { collections: string[]; curriculaCount: number; courseRequestsCount: number; coursesHaveCurriculumField: boolean }` and `type Plan = { ok: true; steps: Step[] } | { ok: false; reason: string }`, `type Step = { kind: 'renameCollection'; from: string; to: string } | { kind: 'renameFields'; collection: string; fields: Record<string, string> } | { kind: 'dropIndex'; collection: string; index: string } | { kind: 'syncIndexes' }`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/modules/rename.migration.test.ts
import { planRenameSteps } from '../../scripts/curriculum-course-rename-plan';

const fresh = { collections: ['courses', 'courserequests', 'scheduledclasses'], curriculaCount: 0, courseRequestsCount: 3, coursesHaveCurriculumField: false };

describe('planRenameSteps', () => {
  it('plans collection renames in collision-safe order, then field renames, then indexes', () => {
    const plan = planRenameSteps(fresh);
    expect(plan).toEqual({
      ok: true,
      steps: [
        { kind: 'renameCollection', from: 'courses', to: 'curricula' },
        { kind: 'renameCollection', from: 'courserequests', to: 'courses' },
        { kind: 'renameFields', collection: 'courses', fields: { coursePublicId: 'curriculumPublicId', selectedTopicPublicIds: 'topicPublicIds' } },
        { kind: 'renameFields', collection: 'scheduledclasses', fields: { coursePublicId: 'curriculumPublicId', courseTopicPublicId: 'topicPublicId' } },
        { kind: 'renameFields', collection: 'scheduledclasses', fields: { courseRequestPublicId: 'coursePublicId' } },
        { kind: 'dropIndex', collection: 'scheduledclasses', index: 'courseRequestPublicId_1' },
        { kind: 'syncIndexes' },
      ],
    });
  });

  it('refuses when curricula already has data (already migrated)', () => {
    const plan = planRenameSteps({ ...fresh, collections: ['curricula', 'courses', 'scheduledclasses'], curriculaCount: 4, courseRequestsCount: 0 });
    expect(plan.ok).toBe(false);
  });

  it('refuses when courses already hold curriculumPublicId (partially migrated)', () => {
    const plan = planRenameSteps({ ...fresh, coursesHaveCurriculumField: true });
    expect(plan.ok).toBe(false);
  });

  it('skips the courserequests rename when that collection never existed', () => {
    const plan = planRenameSteps({ ...fresh, collections: ['courses', 'scheduledclasses'], courseRequestsCount: 0 });
    expect(plan.ok && plan.steps.some((s) => s.kind === 'renameCollection' && s.from === 'courserequests')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/tests/modules/rename.migration` → FAIL, module not found.

- [ ] **Step 3: Implement the planner**

```ts
// server/src/scripts/curriculum-course-rename-plan.ts
// Uses the OLD collection/field names on purpose — this is the migration from them.
export interface DbState {
  collections: string[];
  curriculaCount: number;
  courseRequestsCount: number;
  /** true if any doc in `courses` already has curriculumPublicId (i.e. it holds student courses). */
  coursesHaveCurriculumField: boolean;
}

export type Step =
  | { kind: 'renameCollection'; from: string; to: string }
  | { kind: 'renameFields'; collection: string; fields: Record<string, string> }
  | { kind: 'dropIndex'; collection: string; index: string }
  | { kind: 'syncIndexes' };

export type Plan = { ok: true; steps: Step[] } | { ok: false; reason: string };

export function planRenameSteps(state: DbState): Plan {
  const has = (c: string) => state.collections.includes(c);
  if (has('curricula') && state.curriculaCount > 0) {
    return { ok: false, reason: 'curricula already has documents — migration appears to have run' };
  }
  if (state.coursesHaveCurriculumField) {
    return { ok: false, reason: 'courses already contains curriculumPublicId — partially migrated; fix by hand' };
  }

  const steps: Step[] = [];
  if (has('courses')) steps.push({ kind: 'renameCollection', from: 'courses', to: 'curricula' });
  if (has('courserequests')) {
    steps.push({ kind: 'renameCollection', from: 'courserequests', to: 'courses' });
    steps.push({ kind: 'renameFields', collection: 'courses', fields: { coursePublicId: 'curriculumPublicId', selectedTopicPublicIds: 'topicPublicIds' } });
  }
  // $rename can't swap names in one pass: move the curriculum id out of the way first.
  steps.push({ kind: 'renameFields', collection: 'scheduledclasses', fields: { coursePublicId: 'curriculumPublicId', courseTopicPublicId: 'topicPublicId' } });
  steps.push({ kind: 'renameFields', collection: 'scheduledclasses', fields: { courseRequestPublicId: 'coursePublicId' } });
  steps.push({ kind: 'dropIndex', collection: 'scheduledclasses', index: 'courseRequestPublicId_1' });
  steps.push({ kind: 'syncIndexes' });
  return { ok: true, steps };
}
```

- [ ] **Step 4: Run to verify pass** — `npx jest src/tests/modules/rename.migration` → 4 passed.

- [ ] **Step 5: Implement the script**

```ts
// server/src/scripts/migrate-curriculum-course-rename.ts
/**
 * One-off migration for the Curriculum/Course rename (spec: 2026-09-25-curriculum-course-rename-design.md).
 * Run with the API and worker STOPPED, after migrate-county-to-fips / migrate-course-districts
 * have been applied under the old code, and before deploying the renamed code.
 *
 * Dry run by default — pass --apply to write.
 * Usage: npx ts-node src/scripts/migrate-curriculum-course-rename.ts [--apply]
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { planRenameSteps, type Step } from './curriculum-course-rename-plan';

const apply = process.argv.includes('--apply');

async function describe(step: Step): Promise<string> {
  const db = mongoose.connection.db!;
  switch (step.kind) {
    case 'renameCollection':
      return `rename collection ${step.from} -> ${step.to} (${await db.collection(step.from).countDocuments()} docs)`;
    case 'renameFields': {
      const or = Object.keys(step.fields).map((f) => ({ [f]: { $exists: true } }));
      // Before step 1 runs, "courses" still means curricula — count from the source the step will see.
      const n = await db.collection(step.collection).countDocuments({ $or: or }).catch(() => 0);
      return `rename fields on ${step.collection}: ${JSON.stringify(step.fields)} (~${n} docs now)`;
    }
    case 'dropIndex':
      return `drop index ${step.index} on ${step.collection} (if present)`;
    case 'syncIndexes':
      return 'sync indexes for Curriculum, Course, ScheduledClass';
  }
}

async function run(step: Step) {
  const db = mongoose.connection.db!;
  switch (step.kind) {
    case 'renameCollection':
      await db.collection(step.from).rename(step.to);
      return;
    case 'renameFields': {
      const or = Object.keys(step.fields).map((f) => ({ [f]: { $exists: true } }));
      const res = await db.collection(step.collection).updateMany({ $or: or }, { $rename: step.fields });
      console.log(`    modified ${res.modifiedCount}`);
      return;
    }
    case 'dropIndex':
      await db.collection(step.collection).dropIndex(step.index).catch(() => console.log('    (index not present)'));
      return;
    case 'syncIndexes': {
      const { CurriculumModel } = await import('../modules/curricula/curriculum.model');
      const { CourseModel } = await import('../modules/courses/course.model');
      const { ScheduledClassModel } = await import('../modules/schedules/schedule.model');
      await CurriculumModel.syncIndexes();
      await CourseModel.syncIndexes();
      await ScheduledClassModel.syncIndexes();
      return;
    }
  }
}

async function main() {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const collections = (await db.listCollections().toArray()).map((c) => c.name);
  const count = (c: string) => (collections.includes(c) ? db.collection(c).countDocuments() : Promise.resolve(0));
  const plan = planRenameSteps({
    collections,
    curriculaCount: await count('curricula'),
    courseRequestsCount: await count('courserequests'),
    coursesHaveCurriculumField: collections.includes('courses')
      ? (await db.collection('courses').countDocuments({ curriculumPublicId: { $exists: true } })) > 0
      : false,
  });

  if (!plan.ok) {
    console.error(`Refusing to migrate: ${plan.reason}`);
    await disconnectDatabase();
    process.exit(1);
  }

  console.log(apply ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');
  for (const step of plan.steps) {
    console.log(`- ${await describe(step)}`);
    if (apply) await run(step);
  }
  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
```

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit -p .` → clean; `npx jest --runInBand` → all pass (213 + 5 + 4).

```bash
git add server/src/scripts/curriculum-course-rename-plan.ts server/src/scripts/migrate-curriculum-course-rename.ts server/src/tests/modules/rename.migration.test.ts server/src/tests/modules/rename.names.test.ts
git commit -m "feat: guarded data migration for the curriculum/course rename"
```

(Task 1's test file is committed in Task 2's `git add -A server/src`; listing it here is harmless.)

---

### Task 5: Final verification

- [ ] **Step 1:** `cd server && npx jest` (parallel, cold cache: `npx jest --clearCache` first) → all pass.
- [ ] **Step 2:** `cd frontend && npx tsc --noEmit -p . && npx vite build` → clean.
- [ ] **Step 3:** Leftover grep across both apps (from repo root):
  `grep -rnE "CourseRequest|courseRequest|course-request|selectedTopicPublicIds|courseTopicPublicId" server/src frontend/src | grep -vE "curriculum-course-rename-plan|migrate-curriculum-course-rename|'COURSE_REQUEST_(ACCEPT|CANCEL)'|course-request-(accept|cancel)-|TutorCourseRequestsPage|dashboard/tutor/course-requests"` → no output.
- [ ] **Step 4:** Report: manual smoke (spec §6) not run unless a non-production DB is provided; deployment order per spec §5.
