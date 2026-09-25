# Curriculum Materials + Course Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach every new resource/assignment/worksheet to a curriculum and its topics, let admins author curriculum materials, and show each course's nested structure to students, parents, tutors and admins with role-appropriate access.

**Architecture:** Materials carry `curriculumPublicId`, `topicPublicIds`, `authorRole`, `authorUserPublicId`. One server helper (`material-access.ts`) decides visibility; structure endpoints and item endpoints both use it. The frontend gets one shared `CourseStructureTree` used by four role pages, a shared `CurriculumTopicPicker` for tutor create forms, and admin authoring modals on a curriculum structure page.

**Tech Stack:** Express + Mongoose + Jest/supertest; React + TanStack Query + Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-25-curriculum-materials-design.md`

## Global Constraints

- New material fields: `curriculumPublicId` (string, indexed), `topicPublicIds` (string[]), `authorRole` (`'TUTOR' | 'ADMIN'`, default `'TUTOR'`), `authorUserPublicId` (string). `tutorPublicId` optional on all three; assignment `classPublicId` and `dueDate` optional on the model.
- Tutor create: curriculum + ≥1 topic **required**; curriculum must be published, subject ∈ tutor subjects (case-insensitive), grade ∈ `gradesTaught` (any if empty). Failures → 422 `ValidationError`.
- Visibility: admin items → anyone with an ACCEPTED/COMPLETED course on that curriculum sharing a topic (student, their parents, their tutor) + admins; tutor items → only that tutor, that tutor's such students (+ parents), admins. Denied → 404.
- Status (topic `status`, `nextClass`) returned only when viewer is STUDENT or PARENT.
- Admin items: `authorRole: 'ADMIN'`, no `tutorPublicId`, created PUBLISHED, `assignedToStudentPublicIds: []`, excluded from `/worksheets/student/me`.
- Admin-item submissions stamp `graderTutorPublicId` = tutor of the student's ACCEPTED/COMPLETED course on that curriculum sharing a topic (most recently updated if several).
- Legacy items (no `curriculumPublicId`) keep today's behaviour everywhere.
- `ICurriculumTopic.resourceIds/assignmentIds/worksheetIds` removed (server types + schema, frontend types + admin form).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Server commands from `server/`, frontend from `frontend/`.

## Review Focus

1. A tutor who owns an item but has no course on that curriculum must still open their own item (author check before course check). — Task 4 test.
2. A student whose course is PENDING/REJECTED/CANCELLED must not see or open curriculum materials. — Task 4 test.
3. A curriculum topic removed from the student's course selection hides materials tagged only with that topic. — Task 5 test.
4. Admin worksheets must never appear in any student's Homework list (`/worksheets/student/me`). — Task 9 test.
5. A second tutor teaching the same curriculum must get 403 grading another tutor's student's admin-assignment submission. — Task 11 test.

---

## File Structure

Server:
- Create `src/modules/curricula/curriculum-attachment.ts` — attachable list + attachment validation (tutor/admin).
- Create `src/modules/courses/material-access.ts` — `canViewMaterial`, `materialFilterForCourse`, `findGraderTutor`.
- Create `src/modules/courses/course-structure.ts` — builds structure responses (course + curriculum).
- Modify models/types/services/routes of `resources`, `assignments`, `worksheets`, `curricula`, `courses`.
- Tests: `src/tests/modules/materials.attach.test.ts`, `materials.access.test.ts`, `course.structure.test.ts`, `materials.item-access.test.ts`, `materials.admin.test.ts`, `materials.grading.test.ts`.

Frontend:
- Create `src/lib/media-upload.ts` (upload helpers moved out of tutor pages), `src/lib/excel-questions.ts` (Excel → questions, moved).
- Create `src/components/shared/CurriculumTopicPicker.tsx`, `src/features/courses/CourseStructureTree.tsx`, `src/features/courses/useOpenMaterial.ts`, `src/features/courses/AdminMaterialForms.tsx`.
- Create pages `StudentAssignmentDetailPage.tsx`, `TutorCoursePage.tsx`, `ParentCoursesPage.tsx`, `ParentCoursePage.tsx`, `AdminCurriculumStructurePage.tsx`.
- Modify `curricula.service.ts`, `courses.service.ts`, `use-curricula.ts`, `use-courses.ts`, resources/assignments/worksheets services, `TutorResourcesPage`, `TutorAssignmentsPage`, `StudentCourseProgressPage`, `TutorCourseRequestsPage`, `AdminCurriculumPage`, `routes/index.tsx`, `Sidebar.tsx`.

---

## Phase 1 — Data + tutor attach

### Task 1: Material fields + attachment helper + attachable endpoint

**Files:**
- Modify: `server/src/modules/resources/resource.model.ts`, `resource.types.ts`; `assignments/assignment.model.ts`, `assignment.types.ts`; `worksheets/worksheet.model.ts`, `worksheet.types.ts`; `curricula/curriculum.model.ts`, `curriculum.types.ts`, `curriculum.validators.ts`, `curriculum.controller.ts`, `curriculum.routes.ts`
- Create: `server/src/modules/curricula/curriculum-attachment.ts`
- Test: `server/src/tests/modules/materials.attach.test.ts`

**Interfaces:**
- Produces:
  - `interface CurriculumAttachment { curriculumPublicId?: string; topicPublicIds?: string[]; authorRole?: 'TUTOR' | 'ADMIN'; authorUserPublicId?: string }` in `server/src/shared/material.types.ts`, extended by `IResource`, `IAssignment`, `IWorksheet`.
  - `listAttachableCurricula(tutor: { subjects: string[]; gradesTaught?: string[] }): Promise<AttachableCurriculum[]>` where `AttachableCurriculum = { publicId; title; subject; grade; district; state; topics: { publicId; title; order }[] }`.
  - `resolveTutorAttachment(tutor, input: { curriculumPublicId?: string; topicPublicIds?: string[] }): Promise<{ curriculumPublicId: string; topicPublicIds: string[] }>` (422 on failure).
  - `resolveAdminAttachment(curriculumPublicId: string, topicPublicIds?: string[]): Promise<{ curriculumPublicId: string; topicPublicIds: string[] }>` (404 unknown curriculum, 422 bad topics).
  - `GET /api/v1/curricula/attachable` (TUTOR, PRINCIPAL).

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/modules/materials.attach.test.ts
import request from 'supertest';
import app from '../../app';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { tutorService } from '../../modules/tutors/tutor.service';
import {
  listAttachableCurricula, resolveTutorAttachment, resolveAdminAttachment,
} from '../../modules/curricula/curriculum-attachment';
import { ResourceModel } from '../../modules/resources/resource.model';
import { AssignmentModel } from '../../modules/assignments/assignment.model';
import { WorksheetModel } from '../../modules/worksheets/worksheet.model';

jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'tutor-user-1', role: 'TUTOR' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const chain = (v: unknown) => ({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve(v) }) }) });
const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const algebra = {
  publicId: 'cur-1', title: 'Algebra I', subject: 'Mathematics', grade: 'Grade 8', district: 'Wake', state: 'NC',
  isPublished: true, isDeleted: false,
  topics: [{ publicId: 't-1', title: 'Linear', order: 0 }, { publicId: 't-2', title: 'Quadratic', order: 1 }],
};
const tutor = { publicId: 'tp-1', subjects: ['mathematics'], gradesTaught: ['Grade 8'] };

describe('material models', () => {
  it('carry curriculum attachment fields and no longer require a tutor', () => {
    for (const M of [ResourceModel, AssignmentModel, WorksheetModel] as const) {
      const paths = M.schema.paths as Record<string, { isRequired?: boolean }>;
      expect(Object.keys(paths)).toEqual(expect.arrayContaining(['curriculumPublicId', 'topicPublicIds', 'authorRole', 'authorUserPublicId']));
      expect(paths.tutorPublicId.isRequired).toBeFalsy();
    }
    expect((AssignmentModel.schema.paths as Record<string, { isRequired?: boolean }>).classPublicId.isRequired).toBeFalsy();
    expect((AssignmentModel.schema.paths as Record<string, { isRequired?: boolean }>).dueDate.isRequired).toBeFalsy();
  });

  it('curriculum topics no longer hold material id lists', () => {
    const paths = Object.keys(CurriculumModel.schema.paths);
    expect(paths.some((p) => /resourceIds|assignmentIds|worksheetIds/.test(p))).toBe(false);
  });
});

describe('listAttachableCurricula', () => {
  afterEach(() => jest.restoreAllMocks());

  it('queries published curricula matching the tutor subjects (case-insensitive) and grades', async () => {
    const findSpy = jest.spyOn(CurriculumModel, 'find').mockReturnValue(chain([algebra]) as never);
    const result = await listAttachableCurricula(tutor);
    const filter = (findSpy.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(filter).toEqual(expect.objectContaining({ isPublished: true, isDeleted: false, grade: { $in: ['Grade 8'] } }));
    const subjects = (filter.subject as { $in: RegExp[] }).$in;
    expect(subjects.some((r) => r.test('Mathematics'))).toBe(true);
    expect(result[0]).toEqual({
      publicId: 'cur-1', title: 'Algebra I', subject: 'Mathematics', grade: 'Grade 8', district: 'Wake', state: 'NC',
      topics: [{ publicId: 't-1', title: 'Linear', order: 0 }, { publicId: 't-2', title: 'Quadratic', order: 1 }],
    });
  });

  it('does not filter by grade when the tutor teaches every grade', async () => {
    const findSpy = jest.spyOn(CurriculumModel, 'find').mockReturnValue(chain([]) as never);
    await listAttachableCurricula({ subjects: ['Mathematics'], gradesTaught: [] });
    expect((findSpy.mock.calls[0] as unknown as [Record<string, unknown>])[0]).not.toHaveProperty('grade');
  });

  it('returns nothing without querying when the tutor has no subjects', async () => {
    const findSpy = jest.spyOn(CurriculumModel, 'find');
    expect(await listAttachableCurricula({ subjects: [] })).toEqual([]);
    expect(findSpy).not.toHaveBeenCalled();
  });
});

describe('resolveTutorAttachment', () => {
  afterEach(() => jest.restoreAllMocks());

  it('requires a curriculum and at least one topic', async () => {
    await expect(resolveTutorAttachment(tutor, {})).rejects.toMatchObject({ statusCode: 422 });
    await expect(resolveTutorAttachment(tutor, { curriculumPublicId: 'cur-1', topicPublicIds: [] })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects a curriculum the tutor cannot attach to', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ ...algebra, subject: 'History' }) as never);
    await expect(resolveTutorAttachment(tutor, { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'] }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects an unpublished curriculum and a grade the tutor does not teach', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(resolveTutorAttachment(tutor, { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'] }))
      .rejects.toMatchObject({ statusCode: 422 });
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ ...algebra, grade: 'Grade 3' }) as never);
    await expect(resolveTutorAttachment(tutor, { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'] }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects topics that are not in the curriculum', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(algebra) as never);
    await expect(resolveTutorAttachment(tutor, { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1', 't-9'] }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  it('returns de-duplicated attachment fields for a valid choice', async () => {
    const findOne = jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(algebra) as never);
    expect(await resolveTutorAttachment(tutor, { curriculumPublicId: 'cur-1', topicPublicIds: ['t-2', 't-1', 't-2'] }))
      .toEqual({ curriculumPublicId: 'cur-1', topicPublicIds: ['t-2', 't-1'] });
    expect(findOne).toHaveBeenCalledWith({ publicId: 'cur-1', isPublished: true, isDeleted: false });
  });
});

describe('resolveAdminAttachment', () => {
  afterEach(() => jest.restoreAllMocks());

  it('404s an unknown curriculum, 422s bad topics, accepts unpublished curricula', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(resolveAdminAttachment('nope', ['t-1'])).rejects.toMatchObject({ statusCode: 404 });
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ ...algebra, isPublished: false }) as never);
    await expect(resolveAdminAttachment('cur-1', [])).rejects.toMatchObject({ statusCode: 422 });
    expect(await resolveAdminAttachment('cur-1', ['t-1'])).toEqual({ curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'] });
  });
});

describe('GET /curricula/attachable', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lists attachable curricula for the calling tutor', async () => {
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue(tutor as never);
    jest.spyOn(CurriculumModel, 'find').mockReturnValue(chain([algebra]) as never);
    const res = await request(app).get('/api/v1/curricula/attachable');
    expect(res.status).toBe(200);
    expect(res.body.data[0].publicId).toBe('cur-1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/tests/modules/materials.attach`
Expected: FAIL — `Cannot find module '../../modules/curricula/curriculum-attachment'`.

- [ ] **Step 3: Shared attachment type**

```ts
// server/src/shared/material.types.ts
/** Links a resource/assignment/worksheet to a curriculum's topics (curriculum-materials spec §3). */
export type MaterialAuthorRole = 'TUTOR' | 'ADMIN';

export interface CurriculumAttachment {
  curriculumPublicId?: string;
  topicPublicIds?: string[];
  authorRole?: MaterialAuthorRole;
  authorUserPublicId?: string;
}
```

In `resource.types.ts`, `assignment.types.ts`, `worksheet.types.ts`: `import type { CurriculumAttachment } from '../../shared/material.types';` and make each main interface extend it: `export interface IResource extends CurriculumAttachment {` (same for `IAssignment`, `IWorksheet`). Change `tutorPublicId: string;` → `tutorPublicId?: string;` in all three; in `IAssignment` also `classPublicId?: string;` and `dueDate?: Date;`.

- [ ] **Step 4: Model fields** — in each of `resource.model.ts`, `assignment.model.ts`, `worksheet.model.ts`:

1. `tutorPublicId: { type: String, required: true, index: true }` → `tutorPublicId: { type: String, index: true }` (absent on admin-authored items).
2. Add after `tutorPublicId`:

```ts
    curriculumPublicId: { type: String, index: true },
    topicPublicIds: [{ type: String }],
    authorRole: { type: String, enum: ['TUTOR', 'ADMIN'], default: 'TUTOR' },
    authorUserPublicId: { type: String },
```

3. After the existing schema indexes add (with the schema variable of that file):

```ts
resourceSchema.index({ curriculumPublicId: 1, topicPublicIds: 1, isDeleted: 1 });
```

In `assignment.model.ts` also: `classPublicId: { type: String, index: true }` (drop `required`), `dueDate: { type: Date }` (drop `required`). In `assignment.service.ts` `submit`, the late check becomes `const late = !!assignment.dueDate && new Date() > assignment.dueDate;` used in both status expressions.

- [ ] **Step 5: Remove topic material arrays from the curriculum**

`curriculum.types.ts` `ICurriculumTopic`: delete `resourceIds`, `assignmentIds`, `worksheetIds`.
`curriculum.model.ts` topic sub-schema: delete the three array fields.
`curriculum.validators.ts` `topicInputSchema`: delete the three `z.array(z.string()).default([])` lines.
`curriculum.service.ts` `create`/`update` topic mapping: delete the three `resourceIds: t.resourceIds,` etc. lines.

- [ ] **Step 6: Attachment helper**

```ts
// server/src/modules/curricula/curriculum-attachment.ts
import { CurriculumModel } from './curriculum.model';
import { NotFoundError, ValidationError } from '../../utils/error';
import { normalizeSubject } from '../../utils/taxonomy';

export interface AttachableCurriculum {
  publicId: string;
  title: string;
  subject: string;
  grade: string;
  district?: string;
  state: string;
  topics: { publicId: string; title: string; order: number }[];
}

interface TutorScope { subjects: string[]; gradesTaught?: string[] }
interface AttachmentInput { curriculumPublicId?: string; topicPublicIds?: string[] }
export interface AttachmentFields { curriculumPublicId: string; topicPublicIds: string[] }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const subjectMatcher = (subjects: string[]) =>
  subjects.map((s) => new RegExp(`^${escape(normalizeSubject(s))}$`, 'i'));

/** Published curricula whose subject the tutor teaches (and grade, when grades are set). */
export async function listAttachableCurricula(tutor: TutorScope): Promise<AttachableCurriculum[]> {
  if (tutor.subjects.length === 0) return [];
  const filter: Record<string, unknown> = {
    isPublished: true,
    isDeleted: false,
    subject: { $in: subjectMatcher(tutor.subjects) },
  };
  if (tutor.gradesTaught && tutor.gradesTaught.length > 0) filter.grade = { $in: tutor.gradesTaught };
  const curricula = await CurriculumModel.find(filter).sort({ title: 1 }).limit(200).lean();
  return curricula.map((c) => ({
    publicId: c.publicId,
    title: c.title,
    subject: c.subject,
    grade: c.grade,
    district: c.district,
    state: c.state,
    topics: [...c.topics]
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ publicId: t.publicId, title: t.title, order: t.order })),
  }));
}

function checkTopics(topicIds: string[] | undefined, validIds: Set<string>): string[] {
  const unique = [...new Set(topicIds ?? [])];
  if (unique.length === 0) throw new ValidationError({ topicPublicIds: ['Pick at least one topic'] });
  const bad = unique.filter((id) => !validIds.has(id));
  if (bad.length) throw new ValidationError({ topicPublicIds: [`Not topics of this curriculum: ${bad.join(', ')}`] });
  return unique;
}

/** Validates a tutor's curriculum + topics choice when they create a material. */
export async function resolveTutorAttachment(tutor: TutorScope, input: AttachmentInput): Promise<AttachmentFields> {
  if (!input.curriculumPublicId) throw new ValidationError({ curriculumPublicId: ['Pick a curriculum'] });
  const curriculum = await CurriculumModel.findOne({ publicId: input.curriculumPublicId, isPublished: true, isDeleted: false }).lean();
  const subjects = new Set(tutor.subjects.map((s) => normalizeSubject(s).toLowerCase()));
  const gradeOk = !tutor.gradesTaught?.length || (curriculum && tutor.gradesTaught.includes(curriculum.grade));
  if (!curriculum || !subjects.has(normalizeSubject(curriculum.subject).toLowerCase()) || !gradeOk) {
    throw new ValidationError({ curriculumPublicId: ['You can only attach to published curricula for subjects and grades you teach'] });
  }
  const topicPublicIds = checkTopics(input.topicPublicIds, new Set(curriculum.topics.map((t) => t.publicId)));
  return { curriculumPublicId: curriculum.publicId, topicPublicIds };
}

/** Admins may attach to any curriculum, published or not. */
export async function resolveAdminAttachment(curriculumPublicId: string, topicPublicIds?: string[]): Promise<AttachmentFields> {
  const curriculum = await CurriculumModel.findOne({ publicId: curriculumPublicId, isDeleted: false }).lean();
  if (!curriculum) throw new NotFoundError('Curriculum');
  return {
    curriculumPublicId,
    topicPublicIds: checkTopics(topicPublicIds, new Set(curriculum.topics.map((t) => t.publicId))),
  };
}
```

- [ ] **Step 7: Attachable route** — `curriculum.controller.ts` add:

```ts
  /** Curricula the calling tutor/principal may attach materials to. */
  async listAttachable(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
      const result = await listAttachableCurricula({ subjects: tutor.subjects ?? [], gradesTaught: tutor.gradesTaught });
      sendSuccess(res, result, 'Attachable curricula fetched');
    } catch (error) { next(error); }
  }
```

(import `listAttachableCurricula` from `./curriculum-attachment`; `tutorService` is already imported.)
`curriculum.routes.ts`, **before** `router.get('/:curriculumPublicId', …)`:

```ts
router.get('/attachable', requireRole(Role.TUTOR, Role.PRINCIPAL), curriculumController.listAttachable.bind(curriculumController));
```

- [ ] **Step 8: Run to verify pass**

Run: `npx jest src/tests/modules/materials.attach && npx tsc --noEmit -p .`
Expected: PASS; tsc errors only where callers still pass removed topic arrays (fix those lines by deleting them) — then clean.

- [ ] **Step 9: Commit**

```bash
git add server/src
git commit -m "feat: curriculum attachment fields on materials and attachable curricula endpoint"
```

---

### Task 2: Tutor create requires curriculum + topics

**Files:**
- Modify: `server/src/modules/resources/resource.service.ts`, `resource.routes.ts`, `resource.types.ts`; `assignments/assignment.service.ts`, `assignment.routes.ts`, `assignment.types.ts`; `worksheets/worksheet.service.ts`, `worksheet.routes.ts`, `worksheet.types.ts`
- Test: `server/src/tests/modules/materials.attach.test.ts` (append), `assignment.service.test.ts` (update calls)

**Interfaces:**
- Consumes: `resolveTutorAttachment` (Task 1).
- Produces: `resourceService.create(tutor: TutorAuthor, dto)`, `assignmentService.create(dto, tutor: TutorAuthor)`, `worksheetService.create(tutor: TutorAuthor, dto)` where `type TutorAuthor = { publicId: string; userPublicId: string; subjects: string[]; gradesTaught?: string[] }` (exported from `src/shared/material.types.ts`). DTOs gain `curriculumPublicId?: string; topicPublicIds?: string[]`.

- [ ] **Step 1: Append failing tests**

```ts
// append to materials.attach.test.ts
import { resourceService } from '../../modules/resources/resource.service';
import { assignmentService } from '../../modules/assignments/assignment.service';
import { worksheetService } from '../../modules/worksheets/worksheet.service';

const author = { publicId: 'tp-1', userPublicId: 'tutor-user-1', subjects: ['Mathematics'], gradesTaught: ['Grade 8'] };
const attach = { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'] };

describe('tutor create attaches to a curriculum', () => {
  beforeEach(() => jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(algebra) as never));
  afterEach(() => jest.restoreAllMocks());

  it('resource', async () => {
    const create = jest.spyOn(ResourceModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await resourceService.create(author, { title: 'Notes', mediaPublicId: 'm', fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 1, ...attach });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      tutorPublicId: 'tp-1', curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'TUTOR', authorUserPublicId: 'tutor-user-1',
    }));
  });

  it('assignment', async () => {
    const create = jest.spyOn(AssignmentModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await assignmentService.create({ classPublicId: 'c-1', title: 'HW', description: 'Do it now', dueDate: '2026-10-01T10:00:00Z', ...attach }, author);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ curriculumPublicId: 'cur-1', authorRole: 'TUTOR' }));
  });

  it('worksheet', async () => {
    const create = jest.spyOn(WorksheetModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await worksheetService.create(author, {
      title: 'Quiz', type: 'WORKSHEET',
      questions: [{ questionText: 'Q', options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: '' }],
      ...attach,
    } as never);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ topicPublicIds: ['t-1'], authorRole: 'TUTOR' }));
  });

  it('rejects creation without a curriculum', async () => {
    const create = jest.spyOn(ResourceModel, 'create');
    await expect(resourceService.create(author, { title: 'x', mediaPublicId: 'm', fileName: 'a', mimeType: 'a', sizeBytes: 1 }))
      .rejects.toMatchObject({ statusCode: 422 });
    expect(create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx jest src/tests/modules/materials.attach` → FAIL (type errors: `create` expects a string tutor id).

- [ ] **Step 3: Implement**

`src/shared/material.types.ts` append:

```ts
/** The tutor/principal creating a material — enough to validate and stamp the attachment. */
export interface TutorAuthor {
  publicId: string;
  userPublicId: string;
  subjects: string[];
  gradesTaught?: string[];
}
```

DTO types: add `curriculumPublicId?: string; topicPublicIds?: string[];` to `CreateResourceDto`, `CreateAssignmentDto`, `CreateWorksheetDto`.

`resource.service.ts`:

```ts
  async create(tutor: TutorAuthor, dto: CreateResourceDto): Promise<IResource> {
    const attachment = await resolveTutorAttachment(tutor, dto);
    const resource = await ResourceModel.create({
      publicId: uuidv4(),
      tutorPublicId: tutor.publicId,
      classPublicId: dto.classPublicId,
      title: dto.title,
      description: dto.description,
      mediaPublicId: dto.mediaPublicId,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      ...attachment,
      authorRole: 'TUTOR',
      authorUserPublicId: tutor.userPublicId,
    });
    return resource.toObject();
  }
```

`assignment.service.ts` `create(dto, tutor: TutorAuthor)`: first line `const attachment = await resolveTutorAttachment(tutor, dto);`, use `tutorPublicId: tutor.publicId`, `dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined`, and spread `...attachment, authorRole: 'TUTOR', authorUserPublicId: tutor.userPublicId` into the create object.

`worksheet.service.ts` `create(tutor: TutorAuthor, dto)`: after the two existing guards `const attachment = await resolveTutorAttachment(tutor, dto);`; `tutorPublicId: tutor.publicId`; spread the same three into the create object.

Imports in each service: `import { resolveTutorAttachment } from '../curricula/curriculum-attachment';` and `import type { TutorAuthor } from '../../shared/material.types';`.

Routes (`resource.routes.ts` POST `/`, `assignment.routes.ts` POST `/`, `worksheet.routes.ts` POST `/`): pass the whole tutor profile instead of `tutor.publicId`:

```ts
    const resource = await resourceService.create(tutor, req.body);
    const assignment = await assignmentService.create(req.body, tutor);
    const worksheet = await worksheetService.create(tutor, req.body);
```

(`tutorService.getByUserPublicId` returns `ITutorProfile`, which has `publicId`, `userPublicId`, `subjects`, `gradesTaught` — structurally a `TutorAuthor`.)

Update `src/tests/modules/assignment.service.test.ts` calls of `assignmentService.create(dto, 'tutor-x')` to pass `{ publicId: 'tutor-x', userPublicId: 'u', subjects: ['Mathematics'] }` and add `curriculumPublicId: 'cur-1', topicPublicIds: ['t-1']` to their dto, with `jest.spyOn(CurriculumModel, 'findOne').mockReturnValue({ lean: () => Promise.resolve({ publicId: 'cur-1', subject: 'Mathematics', grade: 'Grade 8', topics: [{ publicId: 't-1' }] }) } as never)` in a `beforeEach`.

- [ ] **Step 4: Verify** — `npx jest --runInBand && npx tsc --noEmit -p .` → all pass, clean.

- [ ] **Step 5: Commit** — `git add server/src && git commit -m "feat: tutor-created materials must attach to a curriculum and topics"`

---

### Task 3: Frontend — topic picker in tutor create forms

**Files:**
- Create: `frontend/src/lib/media-upload.ts`, `frontend/src/lib/excel-questions.ts`, `frontend/src/components/shared/CurriculumTopicPicker.tsx`
- Modify: `services/curricula.service.ts`, `hooks/use-curricula.ts`, `services/resources.service.ts`, `services/assignments.service.ts`, `services/worksheets.service.ts`, `pages/tutor/TutorResourcesPage.tsx`, `pages/tutor/TutorAssignmentsPage.tsx`, `pages/admin/AdminCurriculumPage.tsx`

**Interfaces:**
- Consumes: `GET /curricula/attachable` (Task 1); create endpoints accept `curriculumPublicId`, `topicPublicIds` (Task 2).
- Produces: `interface CurriculumAttachmentValue { curriculumPublicId: string; topicPublicIds: string[] }`, `<CurriculumTopicPicker value onChange />`, `useAttachableCurricula()`, `uploadDocument(file)`, `uploadResourceFile(file, onProgress)`, `parseExcelQuestions(file)`.

- [ ] **Step 1: Move upload/Excel helpers** — cut `uploadFile` from `TutorAssignmentsPage.tsx` into `lib/media-upload.ts` as `export async function uploadDocument(file: File)`, and `uploadFile` (+ `getMediaType`) from `TutorResourcesPage.tsx` as `export async function uploadResourceFile(file: File, onProgress: (pct: number) => void)`; cut `isExcelFile` + `parseExcel` from `TutorAssignmentsPage.tsx` into `lib/excel-questions.ts` as `export function isExcelFile(file: File)` and `export function parseExcelQuestions(file: File): Promise<IQuestion[]>`. Bodies move verbatim; the pages import them. Run `npx tsc --noEmit -p .` → clean.

- [ ] **Step 2: Service + hook**

`services/curricula.service.ts`: delete `resourceIds/assignmentIds/worksheetIds` from `CurriculumTopic`; add

```ts
export interface AttachableCurriculum {
  publicId: string; title: string; subject: string; grade: string; district?: string; state: string;
  topics: { publicId: string; title: string; order: number }[];
}
// in curriculaService:
  listAttachable: (): Promise<AttachableCurriculum[]> => api.get('/curricula/attachable').then((r) => r.data.data),
```

`hooks/use-curricula.ts`: key `attachable: [...curriculumKeys.all, 'attachable'] as const` and

```ts
export function useAttachableCurricula(enabled = true) {
  return useQuery({ queryKey: curriculumKeys.attachable, queryFn: curriculaService.listAttachable, enabled, staleTime: 60_000 });
}
```

`AdminCurriculumPage.tsx`: `addTopic` creates `{ title: '', order: t.length }` (drop the three arrays); `TopicDraft` type stays `Omit<CurriculumTopic, 'publicId'> & { publicId?: string }`.

Resource/assignment/worksheet `Create…Dto` types: add `curriculumPublicId: string; topicPublicIds: string[];`.

- [ ] **Step 3: Picker component**

```tsx
// frontend/src/components/shared/CurriculumTopicPicker.tsx
//
// Required curriculum + topics choice for tutor-created materials (curriculum-materials
// spec §5.2). Lists only curricula the server says this tutor may attach to.
import { Select } from '../ui/Select';
import { useAttachableCurricula } from '../../hooks/use-curricula';

export interface CurriculumAttachmentValue {
  curriculumPublicId: string;
  topicPublicIds: string[];
}

export const EMPTY_ATTACHMENT: CurriculumAttachmentValue = { curriculumPublicId: '', topicPublicIds: [] };

export const isAttachmentComplete = (v: CurriculumAttachmentValue) => !!v.curriculumPublicId && v.topicPublicIds.length > 0;

export function CurriculumTopicPicker({ value, onChange }: {
  value: CurriculumAttachmentValue;
  onChange: (next: CurriculumAttachmentValue) => void;
}) {
  const { data: curricula = [], isLoading } = useAttachableCurricula();
  const current = curricula.find((c) => c.publicId === value.curriculumPublicId);

  if (!isLoading && curricula.length === 0) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
        No curriculum matches your subjects and grades yet — set them in Profile or ask an admin to publish one.
      </p>
    );
  }

  const toggle = (id: string) =>
    onChange({
      ...value,
      topicPublicIds: value.topicPublicIds.includes(id)
        ? value.topicPublicIds.filter((t) => t !== id)
        : [...value.topicPublicIds, id],
    });

  return (
    <div className="space-y-2">
      <Select
        label="Curriculum"
        placeholder={isLoading ? 'Loading curricula…' : 'Select curriculum'}
        options={curricula.map((c) => ({
          value: c.publicId,
          label: `${c.title} · ${c.grade} · ${c.subject}${c.district ? ` · ${c.district}` : ''}`,
        }))}
        value={value.curriculumPublicId}
        onChange={(e) => onChange({ curriculumPublicId: e.target.value, topicPublicIds: [] })}
        disabled={isLoading}
      />
      {current && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Topics</p>
          <div className="flex flex-wrap gap-1.5">
            {current.topics.map((t) => {
              const on = value.topicPublicIds.includes(t.publicId);
              return (
                <button
                  key={t.publicId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t.publicId)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    on ? 'bg-accent text-accent-ink' : 'bg-surface-sunk text-ink-muted hover:text-ink'
                  }`}
                >
                  {t.title}
                </button>
              );
            })}
          </div>
          {value.topicPublicIds.length === 0 && <p className="mt-1 text-xs text-red-500">Pick at least one topic</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire into tutor forms**

`TutorResourcesPage.tsx`: `const [attachment, setAttachment] = useState(EMPTY_ATTACHMENT);`; render `<CurriculumTopicPicker value={attachment} onChange={setAttachment} />` above the file input in the create modal; disable the submit button while `!isAttachmentComplete(attachment)`; spread `...attachment` into the `createResource({...})` payload; reset to `EMPTY_ATTACHMENT` when the modal closes or succeeds.

`TutorAssignmentsPage.tsx`: same state + picker (below the Class select); disable **Create Assignment** / **Create Quiz Assignment** while incomplete; spread `...attachment` into all three `createWorksheet`/`createAssignment` payloads in `onSubmit`; reset alongside `setFileState({ kind: 'none' })`.

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit -p . && npx vite build` → clean.

```bash
git add frontend/src
git commit -m "feat(frontend): tutors attach materials to a curriculum and topics"
```

---

## Phase 2 — Structure + access

### Task 4: `material-access.ts`

**Files:**
- Create: `server/src/modules/courses/material-access.ts`
- Test: `server/src/tests/modules/materials.access.test.ts`

**Interfaces:**
- Produces:
  - `type Viewer = { role: string; userPublicId: string }`
  - `interface MaterialLike extends CurriculumAttachment { tutorPublicId?: string }`
  - `canViewMaterial(viewer: Viewer, m: MaterialLike): Promise<boolean>`
  - `materialFilterForCourse(course: { curriculumPublicId: string; topicPublicIds: string[]; tutorPublicId: string }): Record<string, unknown>` — Mongo filter.
  - `findGraderTutor(studentPublicId: string, m: MaterialLike): Promise<string | undefined>`
  - `ACTIVE_COURSE_STATUSES = ['ACCEPTED', 'COMPLETED']`

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/modules/materials.access.test.ts
import { canViewMaterial, materialFilterForCourse, findGraderTutor } from '../../modules/courses/material-access';
import { CourseModel } from '../../modules/courses/course.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ParentProfileModel } from '../../modules/parents/parent.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const adminItem = { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'ADMIN' as const };
const tutorItem = { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'TUTOR' as const, tutorPublicId: 'tp-A' };

describe('canViewMaterial', () => {
  afterEach(() => jest.restoreAllMocks());

  it('legacy items (no curriculum) are not gated', async () => {
    expect(await canViewMaterial({ role: 'STUDENT', userPublicId: 'u' }, { tutorPublicId: 'tp-A' })).toBe(true);
  });

  it('admins see everything', async () => {
    expect(await canViewMaterial({ role: 'ADMIN', userPublicId: 'u' }, tutorItem)).toBe(true);
    expect(await canViewMaterial({ role: 'SUPER_ADMIN', userPublicId: 'u' }, adminItem)).toBe(true);
  });

  it('a tutor always sees their own item, even without a course on that curriculum', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-A' }) as never);
    const exists = jest.spyOn(CourseModel, 'exists').mockResolvedValue(null as never);
    expect(await canViewMaterial({ role: 'TUTOR', userPublicId: 'tu-A' }, tutorItem)).toBe(true);
    expect(exists).not.toHaveBeenCalled();
  });

  it('another tutor cannot see a tutor item', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-B' }) as never);
    expect(await canViewMaterial({ role: 'TUTOR', userPublicId: 'tu-B' }, tutorItem)).toBe(false);
  });

  it('a tutor sees an admin item only with an active course on that curriculum and topic', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-B' }) as never);
    const exists = jest.spyOn(CourseModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    expect(await canViewMaterial({ role: 'TUTOR', userPublicId: 'tu-B' }, adminItem)).toBe(true);
    expect(exists).toHaveBeenCalledWith({
      tutorPublicId: 'tp-B', curriculumPublicId: 'cur-1', topicPublicIds: { $in: ['t-1'] },
      status: { $in: ['ACCEPTED', 'COMPLETED'] }, isDeleted: false,
    });
  });

  it('a student needs an ACCEPTED/COMPLETED course with the item tutor for tutor items', async () => {
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1' }) as never);
    const exists = jest.spyOn(CourseModel, 'exists').mockResolvedValue(null as never);
    expect(await canViewMaterial({ role: 'STUDENT', userPublicId: 'su-1' }, tutorItem)).toBe(false);
    expect(exists).toHaveBeenCalledWith(expect.objectContaining({
      studentPublicId: { $in: ['sp-1'] }, tutorPublicId: 'tp-A', status: { $in: ['ACCEPTED', 'COMPLETED'] },
    }));
  });

  it('a student with an active course sees admin items regardless of tutor', async () => {
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1' }) as never);
    const exists = jest.spyOn(CourseModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    expect(await canViewMaterial({ role: 'STUDENT', userPublicId: 'su-1' }, adminItem)).toBe(true);
    expect((exists.mock.calls[0] as unknown as [Record<string, unknown>])[0]).not.toHaveProperty('tutorPublicId');
  });

  it('a parent is checked against their children', async () => {
    jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean({ childStudentPublicIds: ['sp-1', 'sp-2'] }) as never);
    const exists = jest.spyOn(CourseModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    expect(await canViewMaterial({ role: 'PARENT', userPublicId: 'pu-1' }, adminItem)).toBe(true);
    expect(exists).toHaveBeenCalledWith(expect.objectContaining({ studentPublicId: { $in: ['sp-1', 'sp-2'] } }));
  });

  it('a parent with no children, or any other role, is denied', async () => {
    jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean({ childStudentPublicIds: [] }) as never);
    expect(await canViewMaterial({ role: 'PARENT', userPublicId: 'pu-1' }, adminItem)).toBe(false);
    expect(await canViewMaterial({ role: 'PRINCIPAL', userPublicId: 'x' }, adminItem)).toBe(false);
  });
});

describe('materialFilterForCourse', () => {
  it('matches curriculum, course topics, and admin-or-own-tutor items', () => {
    expect(materialFilterForCourse({ curriculumPublicId: 'cur-1', topicPublicIds: ['t-1', 't-2'], tutorPublicId: 'tp-A' })).toEqual({
      curriculumPublicId: 'cur-1',
      topicPublicIds: { $in: ['t-1', 't-2'] },
      isDeleted: false,
      $or: [{ authorRole: 'ADMIN' }, { tutorPublicId: 'tp-A' }],
    });
  });
});

describe('findGraderTutor', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns the tutor of the most recently updated active course sharing a topic', async () => {
    const findOne = jest.spyOn(CourseModel, 'findOne').mockReturnValue({
      sort: () => lean({ tutorPublicId: 'tp-B' }),
    } as never);
    expect(await findGraderTutor('sp-1', adminItem)).toBe('tp-B');
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ studentPublicId: 'sp-1', curriculumPublicId: 'cur-1' }));
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx jest src/tests/modules/materials.access` → FAIL, module not found. (If `ParentProfileModel` is exported under another name in `parents/parent.model.ts`, use that name in both test and code.)

- [ ] **Step 3: Implement**

```ts
// server/src/modules/courses/material-access.ts
//
// Who may see / open a curriculum-attached material (curriculum-materials spec §4).
// Legacy items without a curriculum are not gated here — their existing rules apply.
import { CourseModel } from './course.model';
import { CourseStatus } from './course.types';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';
import { ParentProfileModel } from '../parents/parent.model';
import type { CurriculumAttachment } from '../../shared/material.types';

export type Viewer = { role: string; userPublicId: string };
export interface MaterialLike extends CurriculumAttachment { tutorPublicId?: string }

export const ACTIVE_COURSE_STATUSES = [CourseStatus.ACCEPTED, CourseStatus.COMPLETED];

const courseScope = (m: MaterialLike) => ({
  curriculumPublicId: m.curriculumPublicId,
  topicPublicIds: { $in: m.topicPublicIds ?? [] },
  status: { $in: ACTIVE_COURSE_STATUSES },
  isDeleted: false,
});

async function studentIdsFor(viewer: Viewer): Promise<string[]> {
  if (viewer.role === 'STUDENT') {
    const s = await StudentProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
    return s ? [s.publicId] : [];
  }
  if (viewer.role === 'PARENT') {
    const p = await ParentProfileModel.findOne({ userPublicId: viewer.userPublicId }).lean();
    return p?.childStudentPublicIds ?? [];
  }
  return [];
}

export async function canViewMaterial(viewer: Viewer, m: MaterialLike): Promise<boolean> {
  if (!m.curriculumPublicId) return true;
  if (viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN') return true;

  if (viewer.role === 'TUTOR') {
    const tutor = await TutorProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
    if (!tutor) return false;
    if (m.authorRole !== 'ADMIN') return m.tutorPublicId === tutor.publicId;
    return !!(await CourseModel.exists({ tutorPublicId: tutor.publicId, ...courseScope(m) }));
  }

  if (viewer.role === 'STUDENT' || viewer.role === 'PARENT') {
    const studentIds = await studentIdsFor(viewer);
    if (studentIds.length === 0) return false;
    const filter: Record<string, unknown> = { studentPublicId: { $in: studentIds }, ...courseScope(m) };
    if (m.authorRole !== 'ADMIN') filter.tutorPublicId = m.tutorPublicId;
    return !!(await CourseModel.exists(filter));
  }

  return false;
}

/** Mongo filter for the materials a course's structure shows. */
export function materialFilterForCourse(course: { curriculumPublicId: string; topicPublicIds: string[]; tutorPublicId: string }) {
  return {
    curriculumPublicId: course.curriculumPublicId,
    topicPublicIds: { $in: course.topicPublicIds },
    isDeleted: false,
    $or: [{ authorRole: 'ADMIN' }, { tutorPublicId: course.tutorPublicId }],
  };
}

/** Tutor who handles a student's submission for an admin-authored item. */
export async function findGraderTutor(studentPublicId: string, m: MaterialLike): Promise<string | undefined> {
  const course = await CourseModel.findOne({ studentPublicId, ...courseScope(m) }).sort({ updatedAt: -1 }).lean();
  return course?.tutorPublicId;
}
```

- [ ] **Step 4: Verify** — `npx jest src/tests/modules/materials.access && npx tsc --noEmit -p .` → pass, clean.

- [ ] **Step 5: Commit** — `git add server/src && git commit -m "feat: material visibility rules for curriculum-attached items"`

---

### Task 5: Structure endpoints (course, curriculum, parent's children)

**Files:**
- Create: `server/src/modules/courses/course-structure.ts`
- Modify: `courses/course.service.ts` (remove `getProgress`, add `getStructure`, `getForParent`), `course.controller.ts`, `course.routes.ts`; `curricula/curriculum.controller.ts`, `curriculum.routes.ts`
- Test: `server/src/tests/modules/course.structure.test.ts`; update `course-progress.test.ts` progress-route test to the new service name.

**Interfaces:**
- Consumes: `materialFilterForCourse` (Task 4), `computeTopicProgress` (existing).
- Produces:
  - `courseService.getStructure(coursePublicId: string, viewer: Viewer): Promise<CourseStructure>`
  - `courseService.getForParent(parentUserPublicId: string): Promise<EnrichedCourse[]>`
  - `getCurriculumStructure(curriculumPublicId: string): Promise<CurriculumStructure>` (from `course-structure.ts`)
  - Types (exported from `course-structure.ts`): `StructureMaterial = { kind: 'resource' | 'assignment' | 'worksheet'; publicId: string; title: string; authorRole: 'TUTOR' | 'ADMIN'; authorName: string }`; `CourseStructure = { viewerRole: 'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN'; course: {...}; curriculum: {...}; topics: Array<{ publicId; title; order; status?; nextClass?; classes; materials: StructureMaterial[] }>; otherClasses }`; `CurriculumStructure = { curriculum: {...}; topics: Array<{ publicId; title; order; materials: StructureMaterial[] }> }`.
  - Routes: `GET /courses/children` (PARENT), `GET /courses/:coursePublicId/structure` (STUDENT, PARENT, TUTOR, ADMIN, SUPER_ADMIN), `GET /courses/:coursePublicId/progress` (alias, same handler), `GET /curricula/:curriculumPublicId/structure` (ADMIN, SUPER_ADMIN).

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/modules/course.structure.test.ts
import { courseService } from '../../modules/courses/course.service';
import { CourseModel } from '../../modules/courses/course.model';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { ResourceModel } from '../../modules/resources/resource.model';
import { AssignmentModel } from '../../modules/assignments/assignment.model';
import { WorksheetModel } from '../../modules/worksheets/worksheet.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ParentProfileModel } from '../../modules/parents/parent.model';
import { UserModel } from '../../modules/users/user.model';
import { getCurriculumStructure } from '../../modules/courses/course-structure';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const course = {
  publicId: 'c-1', studentPublicId: 'sp-1', tutorPublicId: 'tp-A', curriculumPublicId: 'cur-1',
  topicPublicIds: ['t-1'], status: 'ACCEPTED', classesRequired: 2, classesCompletedCount: 1, isDeleted: false,
};
const curriculum = {
  publicId: 'cur-1', title: 'Algebra I', subject: 'Mathematics', grade: 'Grade 8', district: 'Wake', state: 'NC',
  topics: [{ publicId: 't-1', title: 'Linear', order: 0 }, { publicId: 't-2', title: 'Quadratic', order: 1 }],
};

function mockWorld() {
  jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean(course) as never);
  jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(curriculum) as never);
  jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(lean([
    { publicId: 'k-1', status: 'COMPLETED', startUTC: new Date('2026-09-01'), endUTC: new Date('2026-09-01'), topicPublicId: 't-1' },
  ]) as never);
  const resFind = jest.spyOn(ResourceModel, 'find').mockReturnValue(lean([
    { publicId: 'r-1', title: 'Notes', topicPublicIds: ['t-1'], authorRole: 'ADMIN', authorUserPublicId: 'admin-u' },
    { publicId: 'r-2', title: 'Only t-2', topicPublicIds: ['t-2'], authorRole: 'ADMIN', authorUserPublicId: 'admin-u' },
  ]) as never);
  jest.spyOn(AssignmentModel, 'find').mockReturnValue(lean([]) as never);
  jest.spyOn(WorksheetModel, 'find').mockReturnValue(lean([
    { publicId: 'w-1', title: 'Quiz', topicPublicIds: ['t-1'], authorRole: 'TUTOR', tutorPublicId: 'tp-A' },
  ]) as never);
  jest.spyOn(TutorProfileModel, 'find').mockReturnValue(lean([{ publicId: 'tp-A', userPublicId: 'tu-A' }]) as never);
  jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([{ publicId: 'sp-1', userPublicId: 'su-1' }]) as never);
  jest.spyOn(UserModel, 'find').mockReturnValue(lean([
    { publicId: 'tu-A', firstName: 'Tara', lastName: 'Tutor' },
    { publicId: 'su-1', firstName: 'Sam', lastName: 'Student' },
    { publicId: 'admin-u', firstName: 'Ada', lastName: 'Admin' },
  ]) as never);
  return { resFind };
}

describe('courseService.getStructure', () => {
  afterEach(() => jest.restoreAllMocks());

  it('student sees status and the materials of their course topics only', async () => {
    const { resFind } = mockWorld();
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1' }) as never);

    const s = await courseService.getStructure('c-1', { role: 'STUDENT', userPublicId: 'su-1' });

    expect(s.viewerRole).toBe('STUDENT');
    expect(s.topics.map((t) => t.publicId)).toEqual(['t-1']);
    expect(s.topics[0].status).toBe('COMPLETED');
    expect(s.topics[0].materials).toEqual([
      { kind: 'resource', publicId: 'r-1', title: 'Notes', authorRole: 'ADMIN', authorName: 'Ada Admin' },
      { kind: 'worksheet', publicId: 'w-1', title: 'Quiz', authorRole: 'TUTOR', authorName: 'Tara Tutor' },
    ]);
    expect(resFind).toHaveBeenCalledWith(expect.objectContaining({
      $or: [{ authorRole: 'ADMIN' }, { tutorPublicId: 'tp-A' }],
    }), expect.anything());
  });

  it('tutor of the course sees the tree without status', async () => {
    mockWorld();
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-A' }) as never);
    const s = await courseService.getStructure('c-1', { role: 'TUTOR', userPublicId: 'tu-A' });
    expect(s.viewerRole).toBe('TUTOR');
    expect(s.topics[0]).not.toHaveProperty('status');
    expect(s.topics[0]).not.toHaveProperty('nextClass');
  });

  it('parent of the student sees status; other parents get 404', async () => {
    mockWorld();
    jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean({ childStudentPublicIds: ['sp-1'] }) as never);
    expect((await courseService.getStructure('c-1', { role: 'PARENT', userPublicId: 'pu-1' })).topics[0].status).toBe('COMPLETED');

    jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean({ childStudentPublicIds: ['sp-9'] }) as never);
    await expect(courseService.getStructure('c-1', { role: 'PARENT', userPublicId: 'pu-2' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('another student or tutor gets 404', async () => {
    mockWorld();
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-9' }) as never);
    await expect(courseService.getStructure('c-1', { role: 'STUDENT', userPublicId: 'x' })).rejects.toMatchObject({ statusCode: 404 });
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-Z' }) as never);
    await expect(courseService.getStructure('c-1', { role: 'TUTOR', userPublicId: 'y' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('admin sees it without status', async () => {
    mockWorld();
    const s = await courseService.getStructure('c-1', { role: 'ADMIN', userPublicId: 'a' });
    expect(s.viewerRole).toBe('ADMIN');
    expect(s.topics[0]).not.toHaveProperty('status');
  });
});

describe('getCurriculumStructure', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lists every topic with all materials from any author', async () => {
    mockWorld();
    const s = await getCurriculumStructure('cur-1');
    expect(s.topics.map((t) => [t.publicId, t.materials.map((m) => m.publicId)])).toEqual([
      ['t-1', ['r-1', 'w-1']],
      ['t-2', ['r-2']],
    ]);
  });
});

describe('courseService.getForParent', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns active courses of the parent\'s children', async () => {
    jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean({ childStudentPublicIds: ['sp-1'] }) as never);
    const find = jest.spyOn(CourseModel, 'find').mockReturnValue({ sort: () => lean([]) } as never);
    await courseService.getForParent('pu-1');
    expect(find).toHaveBeenCalledWith({ studentPublicId: { $in: ['sp-1'] }, status: { $in: ['ACCEPTED', 'COMPLETED'] }, isDeleted: false });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx jest src/tests/modules/course.structure` → FAIL (`getStructure` not a function).

- [ ] **Step 3: Implement `course-structure.ts`**

```ts
// server/src/modules/courses/course-structure.ts
import { CurriculumModel } from '../curricula/curriculum.model';
import { ResourceModel } from '../resources/resource.model';
import { AssignmentModel } from '../assignments/assignment.model';
import { WorksheetModel } from '../worksheets/worksheet.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { UserModel } from '../users/user.model';
import { NotFoundError } from '../../utils/error';
import type { ICurriculum } from '../curricula/curriculum.types';

export type MaterialKind = 'resource' | 'assignment' | 'worksheet';
export interface StructureMaterial {
  kind: MaterialKind;
  publicId: string;
  title: string;
  authorRole: 'TUTOR' | 'ADMIN';
  authorName: string;
}

interface RawMaterial {
  publicId: string;
  title: string;
  topicPublicIds?: string[];
  authorRole?: 'TUTOR' | 'ADMIN';
  authorUserPublicId?: string;
  tutorPublicId?: string;
}

const PROJECTION = { publicId: 1, title: 1, topicPublicIds: 1, authorRole: 1, authorUserPublicId: 1, tutorPublicId: 1 };

/** Loads materials matching `filter` from all three collections, with author names, grouped by topic. */
export async function loadMaterialsByTopic(filter: Record<string, unknown>): Promise<Map<string, StructureMaterial[]>> {
  const [resources, assignments, worksheets] = await Promise.all([
    ResourceModel.find(filter, PROJECTION).lean() as Promise<RawMaterial[]>,
    AssignmentModel.find(filter, PROJECTION).lean() as Promise<RawMaterial[]>,
    WorksheetModel.find(filter, PROJECTION).lean() as Promise<RawMaterial[]>,
  ]);
  const all: Array<RawMaterial & { kind: MaterialKind }> = [
    ...resources.map((m) => ({ ...m, kind: 'resource' as const })),
    ...assignments.map((m) => ({ ...m, kind: 'assignment' as const })),
    ...worksheets.map((m) => ({ ...m, kind: 'worksheet' as const })),
  ];

  const tutorIds = [...new Set(all.flatMap((m) => (m.tutorPublicId ? [m.tutorPublicId] : [])))];
  const tutors = tutorIds.length ? await TutorProfileModel.find({ publicId: { $in: tutorIds } }, { publicId: 1, userPublicId: 1 }).lean() : [];
  const userByTutor = new Map(tutors.map((t) => [t.publicId, t.userPublicId]));
  const userIds = [...new Set([
    ...tutors.map((t) => t.userPublicId),
    ...all.flatMap((m) => (m.authorUserPublicId ? [m.authorUserPublicId] : [])),
  ])];
  const users = userIds.length ? await UserModel.find({ publicId: { $in: userIds } }, { publicId: 1, firstName: 1, lastName: 1 }).lean() : [];
  const nameByUser = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));

  const byTopic = new Map<string, StructureMaterial[]>();
  for (const m of all) {
    const authorUser = m.authorUserPublicId ?? (m.tutorPublicId ? userByTutor.get(m.tutorPublicId) : undefined);
    const item: StructureMaterial = {
      kind: m.kind,
      publicId: m.publicId,
      title: m.title,
      authorRole: m.authorRole ?? 'TUTOR',
      authorName: (authorUser && nameByUser.get(authorUser)) || (m.authorRole === 'ADMIN' ? 'Admin' : 'Tutor'),
    };
    for (const t of m.topicPublicIds ?? []) byTopic.set(t, [...(byTopic.get(t) ?? []), item]);
  }
  return byTopic;
}

export const curriculumSummary = (c: ICurriculum) => ({
  publicId: c.publicId,
  title: c.title,
  subject: c.subject,
  grade: c.grade,
  district: c.district,
  state: c.state,
});

export async function getCurriculumStructure(curriculumPublicId: string) {
  const curriculum = await CurriculumModel.findOne({ publicId: curriculumPublicId, isDeleted: false }).lean();
  if (!curriculum) throw new NotFoundError('Curriculum');
  const byTopic = await loadMaterialsByTopic({ curriculumPublicId, isDeleted: false });
  return {
    curriculum: curriculumSummary(curriculum),
    topics: [...curriculum.topics]
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ publicId: t.publicId, title: t.title, order: t.order, materials: byTopic.get(t.publicId) ?? [] })),
  };
}
export type CurriculumStructure = Awaited<ReturnType<typeof getCurriculumStructure>>;
```

(Add `district?: string` to `ICurriculum` if not already typed — it is, from the districts work.)

- [ ] **Step 4: `courseService.getStructure` + `getForParent`** — in `course.service.ts` replace the whole `getProgress` method with:

```ts
  /** Nested structure of one course (curriculum-materials spec §6.1). Status only for student/parent. */
  async getStructure(coursePublicId: string, viewer: Viewer) {
    const course = await CourseModel.findOne({ publicId: coursePublicId, isDeleted: false }).lean();
    if (!course) throw new NotFoundError('Course');
    const viewerRole = await this._structureRole(course, viewer);

    // Deleted curricula included on purpose: the student's history still needs them.
    const [curriculum, classes, [enriched], byTopic] = await Promise.all([
      CurriculumModel.findOne({ publicId: course.curriculumPublicId }).lean(),
      ScheduledClassModel.find(
        { coursePublicId: course.publicId, isDeleted: false },
        { publicId: 1, status: 1, startUTC: 1, endUTC: 1, topicPublicId: 1 },
      ).lean(),
      enrichCourses([course]),
      loadMaterialsByTopic(materialFilterForCourse(course)),
    ]);
    if (!curriculum) throw new NotFoundError('Curriculum');

    const selected = new Set(course.topicPublicIds);
    const topics = curriculum.topics.filter((t) => selected.has(t.publicId));
    const progress = computeTopicProgress(
      topics.map((t) => ({ publicId: t.publicId, title: t.title, order: t.order })),
      classes,
      new Date(),
    );
    const showStatus = viewerRole === 'STUDENT' || viewerRole === 'PARENT';

    return {
      viewerRole,
      course: {
        publicId: course.publicId,
        status: course.status,
        classesRequired: course.classesRequired ?? 0,
        classesCompletedCount: course.classesCompletedCount,
        tutorName: enriched.tutorName,
        studentName: enriched.studentName,
      },
      curriculum: curriculumSummary(curriculum),
      topics: progress.topics.map(({ status, nextClass, ...rest }) => ({
        ...rest,
        ...(showStatus ? { status, ...(nextClass ? { nextClass } : {}) } : {}),
        materials: byTopic.get(rest.publicId) ?? [],
      })),
      otherClasses: progress.otherClasses,
    };
  }

  private async _structureRole(course: ICourse, viewer: Viewer): Promise<'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN'> {
    if (viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN') return 'ADMIN';
    if (viewer.role === 'STUDENT') {
      const s = await StudentProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
      if (s?.publicId === course.studentPublicId) return 'STUDENT';
    }
    if (viewer.role === 'PARENT') {
      const p = await ParentProfileModel.findOne({ userPublicId: viewer.userPublicId }).lean();
      if (p?.childStudentPublicIds?.includes(course.studentPublicId)) return 'PARENT';
    }
    if (viewer.role === 'TUTOR') {
      const t = await TutorProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
      if (t?.publicId === course.tutorPublicId) return 'TUTOR';
    }
    throw new NotFoundError('Course');
  }

  async getForParent(parentUserPublicId: string): Promise<EnrichedCourse[]> {
    const parent = await ParentProfileModel.findOne({ userPublicId: parentUserPublicId }).lean();
    const children = parent?.childStudentPublicIds ?? [];
    if (children.length === 0) return [];
    const courses = await CourseModel.find({
      studentPublicId: { $in: children },
      status: { $in: ACTIVE_COURSE_STATUSES },
      isDeleted: false,
    }).sort({ updatedAt: -1 }).lean();
    return enrichCourses(courses);
  }
```

Imports to add in `course.service.ts`: `ParentProfileModel` from `'../parents/parent.model'`, `{ materialFilterForCourse, ACTIVE_COURSE_STATUSES, type Viewer }` from `'./material-access'`, `{ loadMaterialsByTopic, curriculumSummary }` from `'./course-structure'`. Remove the now-unused `ResourceModel/AssignmentModel/WorksheetModel` imports.

- [ ] **Step 5: Controller + routes**

`course.controller.ts`: replace `getProgress` with

```ts
  async getStructure(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.getStructure(req.params.coursePublicId, { role: req.user!.role, userPublicId: req.user!.publicId });
      sendSuccess(res, result, 'Course structure fetched');
    } catch (error) { next(error); }
  }

  async getForParent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await courseService.getForParent(req.user!.publicId), 'Courses fetched');
    } catch (error) { next(error); }
  }
```

`course.routes.ts`: remove the old `/progress` route line and add (before any `/:coursePublicId/...` POST routes is fine; `/children` must precede nothing conflicting since GET `/:coursePublicId` alone doesn't exist):

```ts
const STRUCTURE_ROLES = [Role.STUDENT, Role.PARENT, Role.TUTOR, Role.ADMIN, Role.SUPER_ADMIN];
router.get('/children', requireRole(Role.PARENT), courseController.getForParent.bind(courseController));
router.get('/:coursePublicId/structure', requireRole(...STRUCTURE_ROLES), courseController.getStructure.bind(courseController));
// Kept for the student progress page until the frontend moves to /structure.
router.get('/:coursePublicId/progress', requireRole(...STRUCTURE_ROLES), courseController.getStructure.bind(courseController));
```

`curriculum.controller.ts`:

```ts
  async getStructure(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await getCurriculumStructure(req.params.curriculumPublicId), 'Curriculum structure fetched');
    } catch (error) { next(error); }
  }
```

`curriculum.routes.ts`: `router.get('/:curriculumPublicId/structure', requireRole(Role.SUPER_ADMIN, Role.ADMIN), curriculumController.getStructure.bind(curriculumController));`

Update `course-progress.test.ts`: the service test for another student's request now calls `courseService.getStructure('cr-1', { role: 'STUDENT', userPublicId: 'user-1' })` and mocks `CourseModel.findOne` → `lean({ ...someCourse, studentPublicId: 'someone-else' })` + `StudentProfileModel.findOne` → `lean({ publicId: 'student-me' })`, expecting 404; the route test spies `courseService.getStructure` and expects it called with `('cr-1', { role: 'STUDENT', userPublicId: 'user-1' })`.

- [ ] **Step 6: Verify + commit**

Run: `npx jest --runInBand && npx tsc --noEmit -p .` → all pass.

```bash
git add server/src
git commit -m "feat: course and curriculum structure endpoints for every role"
```

---

### Task 6: Access checks on item endpoints

**Files:**
- Modify: `server/src/modules/resources/resource.routes.ts`, `assignments/assignment.routes.ts`, `worksheets/worksheet.routes.ts`
- Create: `server/src/modules/courses/assert-material-access.ts`
- Test: `server/src/tests/modules/materials.item-access.test.ts`

**Interfaces:**
- Consumes: `canViewMaterial` (Task 4).
- Produces: `assertCanViewMaterial(user: { role: string; publicId: string }, m: MaterialLike): Promise<void>` (throws `NotFoundError('Material')`).

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/modules/materials.item-access.test.ts
import request from 'supertest';
import app from '../../app';
import * as access from '../../modules/courses/material-access';
import { resourceService } from '../../modules/resources/resource.service';
import { worksheetService } from '../../modules/worksheets/worksheet.service';
import { assignmentService } from '../../modules/assignments/assignment.service';
import { studentService } from '../../modules/students/student.service';

jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'su-1', role: 'STUDENT' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const curriculumItem = { publicId: 'x-1', title: 'T', curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'ADMIN' };

describe('item endpoints gate curriculum materials', () => {
  afterEach(() => jest.restoreAllMocks());

  it('404s a resource, its read URL, a worksheet and an assignment the viewer may not see', async () => {
    jest.spyOn(access, 'canViewMaterial').mockResolvedValue(false);
    jest.spyOn(resourceService, 'getByPublicId').mockResolvedValue(curriculumItem as never);
    jest.spyOn(worksheetService, 'getByPublicId').mockResolvedValue(curriculumItem as never);
    jest.spyOn(assignmentService, 'getByPublicId').mockResolvedValue(curriculumItem as never);
    const readUrl = jest.spyOn(resourceService, 'getReadUrl');

    expect((await request(app).get('/api/v1/resources/x-1')).status).toBe(404);
    expect((await request(app).get('/api/v1/resources/x-1/read-url')).status).toBe(404);
    expect(readUrl).not.toHaveBeenCalled();
    expect((await request(app).get('/api/v1/worksheets/x-1')).status).toBe(404);
    expect((await request(app).get('/api/v1/assignments/x-1')).status).toBe(404);
  });

  it('blocks submitting to a curriculum worksheet/assignment the student may not see', async () => {
    jest.spyOn(access, 'canViewMaterial').mockResolvedValue(false);
    jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'sp-1' } as never);
    jest.spyOn(worksheetService, 'getByPublicId').mockResolvedValue(curriculumItem as never);
    jest.spyOn(assignmentService, 'getByPublicId').mockResolvedValue(curriculumItem as never);
    const wsSubmit = jest.spyOn(worksheetService, 'submitAnswers');
    const asSubmit = jest.spyOn(assignmentService, 'submit');

    expect((await request(app).post('/api/v1/worksheets/x-1/submit').send({ answers: [0] })).status).toBe(404);
    expect((await request(app).post('/api/v1/assignments/x-1/submit').send({ content: 'hi' })).status).toBe(404);
    expect(wsSubmit).not.toHaveBeenCalled();
    expect(asSubmit).not.toHaveBeenCalled();
  });

  it('allows the item when access is granted', async () => {
    jest.spyOn(access, 'canViewMaterial').mockResolvedValue(true);
    jest.spyOn(worksheetService, 'getByPublicId').mockResolvedValue(curriculumItem as never);
    expect((await request(app).get('/api/v1/worksheets/x-1')).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — expected: first tests FAIL with status 200/other instead of 404.

- [ ] **Step 3: Implement**

```ts
// server/src/modules/courses/assert-material-access.ts
import { canViewMaterial, type MaterialLike } from './material-access';
import { NotFoundError } from '../../utils/error';

/** 404 (not 403) so existence isn't revealed. Legacy items pass through canViewMaterial. */
export async function assertCanViewMaterial(user: { role: string; publicId: string }, m: MaterialLike): Promise<void> {
  if (!(await canViewMaterial({ role: user.role, userPublicId: user.publicId }, m))) {
    throw new NotFoundError('Material');
  }
}
```

(`canViewMaterial` must be called through the module object so `jest.spyOn(access, 'canViewMaterial')` takes effect: in `assert-material-access.ts` import as `import * as access from './material-access';` and call `access.canViewMaterial(...)`.)

`resource.routes.ts`:
- `GET /:resourceId/read-url`: before `getReadUrl`, `const resource = await resourceService.getByPublicId(req.params.resourceId); await assertCanViewMaterial(req.user!, resource);`
- `GET /:resourceId`: after fetching, `await assertCanViewMaterial(req.user!, resource);`

`worksheet.routes.ts`:
- `GET /:worksheetId`: after fetching, `await assertCanViewMaterial(req.user!, worksheet);`
- `POST /:worksheetId/submit`: first line in `try`: `await assertCanViewMaterial(req.user!, await worksheetService.getByPublicId(req.params.worksheetId));`

`assignment.routes.ts`:
- `GET /:assignmentId`: after fetching, `await assertCanViewMaterial(req.user!, assignment);`
- `POST /:assignmentId/submit`: first line in `try`: `await assertCanViewMaterial(req.user!, await assignmentService.getByPublicId(req.params.assignmentId));`

- [ ] **Step 4: Verify + commit**

Run: `npx jest --runInBand && npx tsc --noEmit -p .` → pass.

```bash
git add server/src
git commit -m "feat: gate curriculum materials on item and submit endpoints"
```

---

### Task 7: Frontend — shared tree, student page, material opening, assignment detail

**Files:**
- Create: `frontend/src/features/courses/CourseStructureTree.tsx`, `frontend/src/features/courses/useOpenMaterial.ts`, `frontend/src/pages/student/StudentAssignmentDetailPage.tsx`
- Modify: `services/courses.service.ts`, `hooks/use-courses.ts`, `pages/student/StudentCourseProgressPage.tsx`, `routes/index.tsx`

**Interfaces:**
- Consumes: `GET /courses/:id/structure` (Task 5).
- Produces:
  - Types in `courses.service.ts`: `StructureMaterial`, `StructureTopic` (`{ publicId; title; order; status?; nextClass?; classes: ProgressClass[]; materials: StructureMaterial[] }`), `CourseStructure` (`{ viewerRole; course; curriculum; topics: StructureTopic[]; otherClasses }`); `coursesService.getStructure(id)`; hook `useCourseStructure(id)` (replaces `useCourseProgress`).
  - `<CourseStructureTree topics otherClasses showStatus onOpenMaterial renderMaterialExtra? />`.
  - `useOpenMaterial(role: 'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN'): (m: StructureMaterial) => void`.
  - Route `/dashboard/student/assignments/:assignmentId`.

- [ ] **Step 1: Service + hook** — in `courses.service.ts` replace `TopicProgress`/`CourseProgress` with:

```ts
export interface StructureMaterial {
  kind: 'resource' | 'assignment' | 'worksheet';
  publicId: string;
  title: string;
  authorRole: 'TUTOR' | 'ADMIN';
  authorName: string;
}

export interface StructureTopic {
  publicId: string;
  title: string;
  order: number;
  status?: 'COMPLETED' | 'SCHEDULED' | 'NOT_SCHEDULED';
  nextClass?: ProgressClass;
  classes: ProgressClass[];
  materials: StructureMaterial[];
}

export interface CourseStructure {
  viewerRole: 'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN';
  course: { publicId: string; status: Course['status']; classesRequired: number; classesCompletedCount: number; tutorName: string; studentName: string };
  curriculum: { publicId: string; title: string; subject: string; grade: string; district?: string; state?: string };
  topics: StructureTopic[];
  otherClasses: ProgressClass[];
}
```

and `getStructure: (coursePublicId: string): Promise<CourseStructure> => api.get(`/courses/${coursePublicId}/structure`).then((r) => r.data.data),` replacing `getProgress`; `listForParent: (): Promise<Course[]> => api.get('/courses/children').then((r) => r.data.data),`.
`hooks/use-courses.ts`: rename `useCourseProgress` → `useCourseStructure` (key `structure`, calls `getStructure`); add `useChildrenCourses()` (key `children`, `listForParent`).

- [ ] **Step 2: `useOpenMaterial`**

```ts
// frontend/src/features/courses/useOpenMaterial.ts
import { useNavigate } from 'react-router-dom';
import { resourcesService } from '../../services/resources.service';
import { useToast } from '../../components/ui/Toast';
import type { StructureMaterial } from '../../services/courses.service';

type ViewerRole = 'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN';

/** What clicking a material does, per role (curriculum-materials spec §7.3). */
export function useOpenMaterial(role: ViewerRole) {
  const navigate = useNavigate();
  const toast = useToast();

  return async (m: StructureMaterial) => {
    if (m.kind === 'resource') {
      // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
      const tab = window.open('', '_blank');
      try {
        const url = await resourcesService.getReadUrl(m.publicId);
        if (tab) tab.location.href = url; else window.location.href = url;
      } catch (err) {
        tab?.close();
        toast.error('Could not open file', (err as Error).message);
      }
      return;
    }
    if (role === 'ADMIN') return; // admins see titles only
    if (m.kind === 'worksheet') {
      if (role === 'STUDENT') navigate(`/dashboard/student/worksheets/${m.publicId}/test`);
      else if (role === 'TUTOR') navigate(`/dashboard/tutor/worksheets/${m.publicId}/results`);
      else navigate('/dashboard/parent/worksheets');
      return;
    }
    if (role === 'STUDENT') navigate(`/dashboard/student/assignments/${m.publicId}`);
    else if (role === 'TUTOR') navigate('/dashboard/tutor/assignments');
    else navigate('/dashboard/parent/assignments');
  };
}
```

(Check the actual method name on `resourcesService` for the read URL — it is the function returning `r.data.data.url` at `services/resources.service.ts:48-49`; use that name.)

- [ ] **Step 3: `CourseStructureTree`** — move `ClassRow`, `TopicStatus`, `TopicNode`, `formatWhen`, `CLASS_STATUS_LABEL` from `StudentCourseProgressPage.tsx` into `features/courses/CourseStructureTree.tsx`, then:

1. `TopicStatus` returns `null` when `topic.status` is undefined.
2. `TopicNode` props: `{ topic: StructureTopic; index: number; showStatus: boolean; onOpenMaterial: (m: StructureMaterial) => void; renderMaterialExtra?: (m: StructureMaterial) => ReactNode }`. Initial `open` = `!showStatus || topic.status !== 'COMPLETED'`. The strike-through title only when `showStatus && topic.status === 'COMPLETED'`. Render `{showStatus && <TopicStatus topic={topic} />}`.
3. Materials list: each material is a `<button type="button" onClick={() => onOpenMaterial(m)}>` row with icon by `m.kind` (`FileText` resource, `ClipboardList` assignment, `PenSquare` worksheet), the title, `· {kind label}`, a `<Badge variant="purple" tone="soft">Curriculum</Badge>` when `m.authorRole === 'ADMIN'`, then `{renderMaterialExtra?.(m)}`.
4. Export:

```tsx
export function CourseStructureTree({ topics, otherClasses, showStatus, onOpenMaterial, renderMaterialExtra }: {
  topics: StructureTopic[];
  otherClasses: ProgressClass[];
  showStatus: boolean;
  onOpenMaterial: (m: StructureMaterial) => void;
  renderMaterialExtra?: (m: StructureMaterial) => ReactNode;
}) {
  return (
    <>
      <ul className="space-y-2">
        {topics.map((t, i) => (
          <TopicNode key={t.publicId} topic={t} index={i} showStatus={showStatus} onOpenMaterial={onOpenMaterial} renderMaterialExtra={renderMaterialExtra} />
        ))}
      </ul>
      {otherClasses.length > 0 && (
        <div className="mt-5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Other classes</p>
          <p className="mb-2 text-xs text-gray-400">Classes in this course the tutor didn't link to a topic.</p>
          <ul className="space-y-1.5">{otherClasses.map((c) => <ClassRow key={c.publicId} cls={c} />)}</ul>
        </div>
      )}
    </>
  );
}
```

`StudentCourseProgressPage.tsx`: use `useCourseStructure`, render `<CourseStructureTree topics={topics} otherClasses={otherClasses} showStatus onOpenMaterial={useOpenMaterial('STUDENT')} />` in place of the inline list (call the hook at top level: `const openMaterial = useOpenMaterial('STUDENT');`).

- [ ] **Step 4: Student assignment detail page**

```tsx
// frontend/src/pages/student/StudentAssignmentDetailPage.tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Download } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useAssignment, useMySubmission, useSubmitAssignment } from '../../hooks/use-assignments';
import { api } from '../../lib/axios';

export function StudentAssignmentDetailPage() {
  const { assignmentId = '' } = useParams<{ assignmentId: string }>();
  const { data: assignment, isLoading, isError } = useAssignment(assignmentId);
  const { data: submission } = useMySubmission(assignmentId);
  const { mutate: submit, isPending } = useSubmitAssignment();
  const [content, setContent] = useState('');

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (isError || !assignment) {
    return <div className="py-16 text-center text-sm text-gray-500">Assignment not found. <Link to="/dashboard/student/assignments" className="text-brand-600 hover:underline">Back</Link></div>;
  }

  const openAttachment = async () => {
    const { data } = await api.get(`/media/${assignment.filePublicId}/read-url`);
    window.open((data.data as { url: string }).url, '_blank');
  };

  return (
    <div className="animate-fade-in">
      <button type="button" onClick={() => history.back()} className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <PageHeader
        eyebrow="Assignment"
        title={assignment.title}
        description={assignment.dueDate ? `Due ${format(new Date(assignment.dueDate), 'MMM d, yyyy h:mm a')}` : 'No due date'}
        icon={<ClipboardList className="h-5 w-5" />}
      />
      <Card className="mb-4">
        <CardContent className="space-y-3">
          <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{assignment.description}</p>
          {assignment.isFileAttachment && assignment.filePublicId && (
            <Button size="sm" variant="outline" onClick={openAttachment}>
              <Download className="h-3.5 w-3.5" /> {assignment.fileOriginalName ?? 'Attachment'}
            </Button>
          )}
          <p className="text-xs text-gray-500">Max score: {assignment.maxScore}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3">
          {submission && submission.status !== 'NOT_SUBMITTED' ? (
            <>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Your submission</p>
                <Badge variant={submission.status === 'GRADED' ? 'success' : submission.status === 'LATE' ? 'danger' : 'warning'} tone="soft">{submission.status}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{submission.content}</p>
              {submission.status === 'GRADED' && (
                <p className="text-sm">Score: <strong>{submission.score}</strong> / {assignment.maxScore}{submission.feedback ? ` — ${submission.feedback}` : ''}</p>
              )}
            </>
          ) : assignment.status === 'PUBLISHED' ? (
            <>
              <p className="text-sm font-semibold">Your answer</p>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="Write your answer…"
              />
              <Button variant="gradient" loading={isPending} disabled={!content.trim()} onClick={() => submit({ assignmentId, dto: { content: content.trim() } })}>
                Submit
              </Button>
            </>
          ) : (
            <p className="text-sm text-gray-500">This assignment is closed.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

(Match `useSubmitAssignment`'s actual mutation variables and `/media/:id/read-url` path to the existing code in `hooks/use-assignments.ts` and the media routes; adjust the two call sites if their shapes differ.)

Route: `{ path: '/dashboard/student/assignments/:assignmentId', element: <StudentAssignmentDetailPage /> },` next to the student assignments route.

- [ ] **Step 5: Verify + commit** — `npx tsc --noEmit -p . && npx vite build` → clean.

```bash
git add frontend/src
git commit -m "feat(frontend): shared course structure tree, material opening, assignment detail page"
```

---

### Task 8: Frontend — tutor, parent and admin structure pages

**Files:**
- Create: `pages/tutor/TutorCoursePage.tsx`, `pages/parent/ParentCoursesPage.tsx`, `pages/parent/ParentCoursePage.tsx`, `pages/admin/AdminCurriculumStructurePage.tsx`
- Modify: `pages/tutor/TutorCourseRequestsPage.tsx`, `pages/admin/AdminCurriculumPage.tsx`, `services/curricula.service.ts`, `hooks/use-curricula.ts`, `routes/index.tsx`, `components/shared/Sidebar.tsx`

**Interfaces:**
- Consumes: `useCourseStructure`, `useChildrenCourses`, `CourseStructureTree`, `useOpenMaterial` (Task 7); `GET /curricula/:id/structure` (Task 5).
- Produces: `curriculaService.getStructure(id)`, `useCurriculumStructure(id)`, types `CurriculumStructure`, routes listed below.

- [ ] **Step 1: Shared course page body** — both tutor and parent pages render the same layout as the student page. Create it once:

```tsx
// in features/courses/CourseStructureView.tsx
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Loading';
import { useCourseStructure } from '../../hooks/use-courses';
import { CourseStructureTree } from './CourseStructureTree';
import { useOpenMaterial } from './useOpenMaterial';
import type { StructureMaterial } from '../../services/courses.service';

export function CourseStructureView({ coursePublicId, backTo, backLabel, renderMaterialExtra }: {
  coursePublicId?: string;
  backTo: string;
  backLabel: string;
  renderMaterialExtra?: (m: StructureMaterial) => ReactNode;
}) {
  const { data, isLoading, isError } = useCourseStructure(coursePublicId);
  const openMaterial = useOpenMaterial(data?.viewerRole ?? 'STUDENT');
  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (isError || !data) {
    return <div className="py-16 text-center text-sm text-gray-500">Course not found. <Link to={backTo} className="text-brand-600 hover:underline">{backLabel}</Link></div>;
  }
  const { course, curriculum, topics, otherClasses, viewerRole } = data;
  const showStatus = viewerRole === 'STUDENT' || viewerRole === 'PARENT';
  const doneTopics = topics.filter((t) => t.status === 'COMPLETED').length;
  const pct = topics.length ? Math.round((doneTopics / topics.length) * 100) : 0;
  const who = viewerRole === 'TUTOR' ? `for ${course.studentName}` : `with ${course.tutorName}`;

  return (
    <div className="animate-fade-in">
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </Link>
      <PageHeader
        eyebrow="Course"
        title={curriculum.title}
        description={`${curriculum.subject} · ${curriculum.grade}${curriculum.district ? ` · ${curriculum.district}` : ''} · ${who}`}
        icon={<BookOpen className="h-5 w-5" />}
      />
      <Card className="mb-4">
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {showStatus
              ? <span className="font-medium text-gray-900 dark:text-white">{doneTopics}/{topics.length} topics completed</span>
              : <span className="font-medium text-gray-900 dark:text-white">{topics.length} topics</span>}
            <span className="text-xs text-gray-500">{course.classesCompletedCount}/{course.classesRequired} classes completed</span>
          </div>
          {showStatus && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden>
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <CourseStructureTree topics={topics} otherClasses={otherClasses} showStatus={showStatus} onOpenMaterial={openMaterial} renderMaterialExtra={renderMaterialExtra} />
        </CardContent>
      </Card>
    </div>
  );
}
```

`StudentCourseProgressPage.tsx` then becomes: `const { coursePublicId } = useParams(); return <CourseStructureView coursePublicId={coursePublicId} backTo="/dashboard" backLabel="Dashboard" />;` (Task 7's inline tree usage is replaced).

- [ ] **Step 2: Tutor page + inbox link**

```tsx
// pages/tutor/TutorCoursePage.tsx
import { useParams } from 'react-router-dom';
import { CourseStructureView } from '../../features/courses/CourseStructureView';

export function TutorCoursePage() {
  const { coursePublicId } = useParams<{ coursePublicId: string }>();
  return <CourseStructureView coursePublicId={coursePublicId} backTo="/dashboard/tutor/course-requests" backLabel="Course requests" />;
}
```

`TutorCourseRequestsPage.tsx` `RequestCard`: for `request.status === 'ACCEPTED' || request.status === 'COMPLETED'` add
`<Link to={`/dashboard/tutor/course-requests/${request.publicId}`}><Button size="sm" variant="outline"><BookOpen className="h-3.5 w-3.5" /> View course</Button></Link>` next to **Schedule next class**.
Route: `{ path: '/dashboard/tutor/course-requests/:coursePublicId', element: <TutorCoursePage /> }`.

- [ ] **Step 3: Parent list + page**

```tsx
// pages/parent/ParentCoursesPage.tsx
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loading';
import { useChildrenCourses } from '../../hooks/use-courses';

export function ParentCoursesPage() {
  const { data: courses = [], isLoading } = useChildrenCourses();
  const byChild = new Map<string, typeof courses>();
  for (const c of courses) byChild.set(c.studentName ?? 'Child', [...(byChild.get(c.studentName ?? 'Child') ?? []), c]);

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Family" title="Courses" description="Courses your children are taking" icon={<BookOpen className="h-5 w-5" />} />
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : courses.length === 0 ? (
        <Card><CardContent><p className="py-10 text-center text-sm text-gray-500">No courses yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-6">
          {[...byChild.entries()].map(([child, list]) => (
            <section key={child}>
              <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{child}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => {
                  const total = c.classesRequired ?? 0;
                  const pct = total > 0 ? Math.min(100, Math.round((c.classesCompletedCount / total) * 100)) : 0;
                  return (
                    <Link key={c.publicId} to={`/dashboard/parent/courses/${c.publicId}`} className="rounded-xl border border-rule p-4 hover:border-brand-300">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white">{c.curriculumTitle ?? 'Course'}</p>
                        <Badge variant={c.status === 'COMPLETED' ? 'success' : 'info'} tone="soft">{c.status === 'COMPLETED' ? 'Completed' : 'Active'}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">with {c.tutorName ?? 'tutor'}</p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden>
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{c.classesCompletedCount}/{total} classes completed</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
```

```tsx
// pages/parent/ParentCoursePage.tsx
import { useParams } from 'react-router-dom';
import { CourseStructureView } from '../../features/courses/CourseStructureView';

export function ParentCoursePage() {
  const { coursePublicId } = useParams<{ coursePublicId: string }>();
  return <CourseStructureView coursePublicId={coursePublicId} backTo="/dashboard/parent/courses" backLabel="Courses" />;
}
```

Routes: `/dashboard/parent/courses` → `ParentCoursesPage`, `/dashboard/parent/courses/:coursePublicId` → `ParentCoursePage`. Sidebar PARENT: add `{ label: 'Courses', href: '/dashboard/parent/courses', icon: GraduationCap },` after "My Children".

- [ ] **Step 4: Admin curriculum structure (read view)** — `curricula.service.ts`:

```ts
export interface CurriculumStructure {
  curriculum: { publicId: string; title: string; subject: string; grade: string; district?: string; state?: string };
  topics: Array<{ publicId: string; title: string; order: number; materials: StructureMaterial[] }>;
}
  getStructure: (id: string): Promise<CurriculumStructure> => api.get(`/curricula/${id}/structure`).then((r) => r.data.data),
```

(import `StructureMaterial` type from `./courses.service`); hook `useCurriculumStructure(id)` (key `['curricula','structure',id]`).

```tsx
// pages/admin/AdminCurriculumStructurePage.tsx
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Loading';
import { useCurriculumStructure } from '../../hooks/use-curricula';
import { CourseStructureTree } from '../../features/courses/CourseStructureTree';
import { useOpenMaterial } from '../../features/courses/useOpenMaterial';

export function AdminCurriculumStructurePage() {
  const { curriculumPublicId } = useParams<{ curriculumPublicId: string }>();
  const base = useLocation().pathname.startsWith('/dashboard/super-admin') ? '/dashboard/super-admin/curriculum' : '/dashboard/admin/curriculum';
  const { data, isLoading, isError } = useCurriculumStructure(curriculumPublicId ?? '');
  const openMaterial = useOpenMaterial('ADMIN');

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (isError || !data) return <div className="py-16 text-center text-sm text-gray-500">Curriculum not found.</div>;

  return (
    <div className="animate-fade-in">
      <Link to={base} className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Curriculum
      </Link>
      <PageHeader
        eyebrow="Curriculum structure"
        title={data.curriculum.title}
        description={`${data.curriculum.subject} · ${data.curriculum.grade}${data.curriculum.district ? ` · ${data.curriculum.district}` : ''}`}
        icon={<GraduationCap className="h-5 w-5" />}
      />
      <Card>
        <CardContent>
          <CourseStructureTree
            topics={data.topics.map((t) => ({ ...t, classes: [] }))}
            otherClasses={[]}
            showStatus={false}
            onOpenMaterial={openMaterial}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

`CourseStructureTree`'s "Classes" block: hide it when `topic.classes.length === 0 && !showStatus && viewer is admin` — simplest: add optional prop `hideClasses?: boolean` to the tree/`TopicNode`, pass `hideClasses` here, and skip rendering the Classes section when set.

`AdminCurriculumPage.tsx` row buttons: add `<Link to={`${base}/${curriculum.publicId}`}><Button size="sm" variant="outline"><ListTree className="h-3.5 w-3.5" /> Structure</Button></Link>` (compute `base` the same way from `useLocation`).
Routes: `/dashboard/admin/curriculum/:curriculumPublicId` and `/dashboard/super-admin/curriculum/:curriculumPublicId` → `AdminCurriculumStructurePage`.

- [ ] **Step 5: Verify + commit** — `npx tsc --noEmit -p . && npx vite build` → clean.

```bash
git add frontend/src
git commit -m "feat(frontend): course structure pages for tutors, parents and admins"
```

---

## Phase 3 — Admin authoring

### Task 9: Admin create/delete endpoints + exclusion from generic lists

**Files:**
- Modify: `resources/resource.service.ts`, `assignments/assignment.service.ts`, `worksheets/worksheet.service.ts`, `curricula/curriculum.controller.ts`, `curriculum.routes.ts`
- Test: `server/src/tests/modules/materials.admin.test.ts`

**Interfaces:**
- Consumes: `resolveAdminAttachment` (Task 1).
- Produces:
  - `resourceService.createForCurriculum(adminUserPublicId: string, curriculumPublicId: string, dto: CreateResourceDto): Promise<IResource>`
  - `assignmentService.createForCurriculum(adminUserPublicId, curriculumPublicId, dto: CreateAssignmentDto): Promise<IAssignment>`
  - `worksheetService.createForCurriculum(adminUserPublicId, curriculumPublicId, dto: CreateWorksheetDto): Promise<IWorksheet>`
  - `softDeleteCurriculumMaterial(kind: MaterialKind, curriculumPublicId: string, materialPublicId: string): Promise<void>` in `curricula/curriculum-materials.ts`
  - Routes: `POST /curricula/:curriculumPublicId/resources|assignments|worksheets`, `DELETE /curricula/:curriculumPublicId/materials/:kind/:materialPublicId` (ADMIN, SUPER_ADMIN).

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/modules/materials.admin.test.ts
import request from 'supertest';
import app from '../../app';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { ResourceModel } from '../../modules/resources/resource.model';
import { AssignmentModel } from '../../modules/assignments/assignment.model';
import { WorksheetModel } from '../../modules/worksheets/worksheet.model';
import { worksheetService } from '../../modules/worksheets/worksheet.service';

let mockRole = 'ADMIN';
jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'admin-u', role: mockRole };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const curriculum = { publicId: 'cur-1', isDeleted: false, topics: [{ publicId: 't-1' }, { publicId: 't-2' }] };

describe('admin curriculum materials', () => {
  beforeEach(() => jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(curriculum) as never));
  afterEach(() => { jest.restoreAllMocks(); mockRole = 'ADMIN'; });

  it('creates a resource as ADMIN-authored, no tutor', async () => {
    const create = jest.spyOn(ResourceModel, 'create').mockResolvedValue({ toObject: () => ({ publicId: 'r-1' }) } as never);
    const res = await request(app).post('/api/v1/curricula/cur-1/resources').send({
      title: 'Notes', mediaPublicId: 'm', fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 10, topicPublicIds: ['t-1'],
    });
    expect(res.status).toBe(201);
    const arg = (create.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(arg).toEqual(expect.objectContaining({ curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'ADMIN', authorUserPublicId: 'admin-u' }));
    expect(arg.tutorPublicId).toBeUndefined();
  });

  it('creates assignments and worksheets PUBLISHED immediately', async () => {
    const aCreate = jest.spyOn(AssignmentModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    const wCreate = jest.spyOn(WorksheetModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await request(app).post('/api/v1/curricula/cur-1/assignments').send({ title: 'HW', description: 'Solve these', topicPublicIds: ['t-2'] });
    await request(app).post('/api/v1/curricula/cur-1/worksheets').send({
      title: 'Quiz', type: 'WORKSHEET', topicPublicIds: ['t-1'],
      questions: [{ questionText: 'Q', options: ['a', 'b', 'c', 'd'], correctIndex: 1, explanation: '' }],
    });
    expect(aCreate).toHaveBeenCalledWith(expect.objectContaining({ status: 'PUBLISHED', authorRole: 'ADMIN' }));
    expect(wCreate).toHaveBeenCalledWith(expect.objectContaining({ status: 'PUBLISHED', authorRole: 'ADMIN', assignedToStudentPublicIds: [] }));
  });

  it('422s topics outside the curriculum and 403s non-admins', async () => {
    const res = await request(app).post('/api/v1/curricula/cur-1/resources').send({
      title: 'x', mediaPublicId: 'm', fileName: 'a', mimeType: 'a', sizeBytes: 1, topicPublicIds: ['t-9'],
    });
    expect(res.status).toBe(422);
    mockRole = 'TUTOR';
    expect((await request(app).post('/api/v1/curricula/cur-1/resources').send({})).status).toBe(403);
  });

  it('deletes only admin-authored items of that curriculum', async () => {
    const upd = jest.spyOn(WorksheetModel, 'findOneAndUpdate').mockReturnValue(lean({ publicId: 'w-1' }) as never);
    const res = await request(app).delete('/api/v1/curricula/cur-1/materials/worksheet/w-1');
    expect(res.status).toBe(200);
    expect(upd).toHaveBeenCalledWith(
      { publicId: 'w-1', curriculumPublicId: 'cur-1', authorRole: 'ADMIN', isDeleted: false },
      { $set: { isDeleted: true } },
    );
  });
});

describe('admin worksheets stay out of generic student lists', () => {
  afterEach(() => jest.restoreAllMocks());

  it('getForStudent excludes ADMIN-authored worksheets', async () => {
    const find = jest.spyOn(WorksheetModel, 'find').mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => lean([]) }) }) } as never);
    jest.spyOn(WorksheetModel, 'countDocuments').mockResolvedValue(0 as never);
    await worksheetService.getForStudent('sp-1', {});
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ authorRole: { $ne: 'ADMIN' } }));
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx jest src/tests/modules/materials.admin` → FAIL (404 routes / missing filter).

- [ ] **Step 3: Implement services**

`resource.service.ts`:

```ts
  async createForCurriculum(adminUserPublicId: string, curriculumPublicId: string, dto: CreateResourceDto): Promise<IResource> {
    const attachment = await resolveAdminAttachment(curriculumPublicId, dto.topicPublicIds);
    const resource = await ResourceModel.create({
      publicId: uuidv4(),
      title: dto.title,
      description: dto.description,
      mediaPublicId: dto.mediaPublicId,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      ...attachment,
      authorRole: 'ADMIN',
      authorUserPublicId: adminUserPublicId,
    });
    return resource.toObject();
  }
```

`assignment.service.ts`:

```ts
  async createForCurriculum(adminUserPublicId: string, curriculumPublicId: string, dto: CreateAssignmentDto): Promise<IAssignment> {
    const attachment = await resolveAdminAttachment(curriculumPublicId, dto.topicPublicIds);
    if (!dto.title?.trim() || !dto.description?.trim()) throw new ValidationError({ title: ['Title and description are required'] });
    const assignment = await AssignmentModel.create({
      publicId: uuidv4(),
      title: dto.title,
      description: dto.description,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      maxScore: dto.maxScore ?? 100,
      attachmentPublicIds: dto.attachmentPublicIds ?? [],
      isFileAttachment: dto.isFileAttachment ?? false,
      filePublicId: dto.filePublicId,
      fileMimeType: dto.fileMimeType,
      fileOriginalName: dto.fileOriginalName,
      status: AssignmentStatus.PUBLISHED,
      isDeleted: false,
      ...attachment,
      authorRole: 'ADMIN',
      authorUserPublicId: adminUserPublicId,
    });
    return assignment.toObject();
  }
```

`worksheet.service.ts`:

```ts
  async createForCurriculum(adminUserPublicId: string, curriculumPublicId: string, dto: CreateWorksheetDto): Promise<IWorksheet> {
    if (!dto.isFileAttachment && (!dto.questions || dto.questions.length === 0)) {
      throw new AppError('Worksheet must have at least one question', 400);
    }
    const attachment = await resolveAdminAttachment(curriculumPublicId, dto.topicPublicIds);
    const worksheet = await WorksheetModel.create({
      publicId: uuidv4(),
      title: dto.title,
      subject: dto.subject,
      type: dto.type,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      questions: dto.isFileAttachment ? [] : (dto.questions ?? []),
      isFileAttachment: dto.isFileAttachment ?? false,
      filePublicId: dto.filePublicId,
      fileMimeType: dto.fileMimeType,
      fileOriginalName: dto.fileOriginalName,
      assignedToStudentPublicIds: [],
      status: WorksheetStatus.PUBLISHED,
      ...attachment,
      authorRole: 'ADMIN',
      authorUserPublicId: adminUserPublicId,
    });
    return worksheet.toObject();
  }
```

and in `getForStudent` add `authorRole: { $ne: 'ADMIN' },` to `filter` with the comment `// Curriculum (admin) worksheets are reached through the course structure only.`

```ts
// server/src/modules/curricula/curriculum-materials.ts
import { ResourceModel } from '../resources/resource.model';
import { AssignmentModel } from '../assignments/assignment.model';
import { WorksheetModel } from '../worksheets/worksheet.model';
import { NotFoundError, ValidationError } from '../../utils/error';
import type { MaterialKind } from '../courses/course-structure';

const MODELS = { resource: ResourceModel, assignment: AssignmentModel, worksheet: WorksheetModel } as const;

/** Soft-deletes an admin-authored item of this curriculum. Tutor items are the tutor's to delete. */
export async function softDeleteCurriculumMaterial(kind: string, curriculumPublicId: string, materialPublicId: string): Promise<void> {
  if (!(kind in MODELS)) throw new ValidationError({ kind: ['kind must be resource, assignment or worksheet'] });
  const Model = MODELS[kind as MaterialKind] as typeof ResourceModel;
  const done = await Model.findOneAndUpdate(
    { publicId: materialPublicId, curriculumPublicId, authorRole: 'ADMIN', isDeleted: false },
    { $set: { isDeleted: true } },
  ).lean();
  if (!done) throw new NotFoundError('Material');
}
```

- [ ] **Step 4: Controller + routes** — `curriculum.controller.ts`:

```ts
  async createResource(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { sendCreated(res, await resourceService.createForCurriculum(req.user!.publicId, req.params.curriculumPublicId, req.body), 'Resource added'); }
    catch (error) { next(error); }
  }
  async createAssignment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { sendCreated(res, await assignmentService.createForCurriculum(req.user!.publicId, req.params.curriculumPublicId, req.body), 'Assignment added'); }
    catch (error) { next(error); }
  }
  async createWorksheet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { sendCreated(res, await worksheetService.createForCurriculum(req.user!.publicId, req.params.curriculumPublicId, req.body), 'Worksheet added'); }
    catch (error) { next(error); }
  }
  async deleteMaterial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await softDeleteCurriculumMaterial(req.params.kind, req.params.curriculumPublicId, req.params.materialPublicId);
      sendSuccess(res, null, 'Material deleted');
    } catch (error) { next(error); }
  }
```

`curriculum.routes.ts`:

```ts
const ADMINS = requireRole(Role.SUPER_ADMIN, Role.ADMIN);
router.post('/:curriculumPublicId/resources', ADMINS, curriculumController.createResource.bind(curriculumController));
router.post('/:curriculumPublicId/assignments', ADMINS, curriculumController.createAssignment.bind(curriculumController));
router.post('/:curriculumPublicId/worksheets', ADMINS, curriculumController.createWorksheet.bind(curriculumController));
router.delete('/:curriculumPublicId/materials/:kind/:materialPublicId', ADMINS, curriculumController.deleteMaterial.bind(curriculumController));
```

- [ ] **Step 5: Verify + commit** — `npx jest --runInBand && npx tsc --noEmit -p .` → pass.

```bash
git add server/src
git commit -m "feat: admins add and remove curriculum resources, assignments and worksheets"
```

---

### Task 10: Frontend — admin authoring on the structure page

**Files:**
- Create: `frontend/src/features/courses/AdminMaterialForms.tsx`
- Modify: `services/curricula.service.ts`, `hooks/use-curricula.ts`, `features/courses/CourseStructureTree.tsx`, `pages/admin/AdminCurriculumStructurePage.tsx`

**Interfaces:**
- Consumes: Task 9 routes; `uploadResourceFile`, `uploadDocument`, `parseExcelQuestions`, `isExcelFile` (Task 3).
- Produces: `curriculaService.addResource/addAssignment/addWorksheet/deleteMaterial`, hooks `useAddCurriculumMaterial()`, `useDeleteCurriculumMaterial()`; `<AddMaterialModal curriculumPublicId topics initialTopicId kind onClose />`; tree prop `renderTopicActions?: (topic) => ReactNode`.

- [ ] **Step 1: Service + hooks**

```ts
// curricula.service.ts additions
export type MaterialKind = 'resource' | 'assignment' | 'worksheet';
  addMaterial: (curriculumPublicId: string, kind: MaterialKind, body: Record<string, unknown>) =>
    api.post(`/curricula/${curriculumPublicId}/${kind}s`, body).then((r) => r.data.data),
  deleteMaterial: (curriculumPublicId: string, kind: MaterialKind, materialPublicId: string) =>
    api.delete(`/curricula/${curriculumPublicId}/materials/${kind}/${materialPublicId}`).then(() => undefined),
```

```ts
// use-curricula.ts additions
export function useAddCurriculumMaterial() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ curriculumPublicId, kind, body }: { curriculumPublicId: string; kind: MaterialKind; body: Record<string, unknown> }) =>
      curriculaService.addMaterial(curriculumPublicId, kind, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: curriculumKeys.all }); toast.success('Material added'); },
    onError: (err: Error) => toast.error('Could not add material', err.message),
  });
}

export function useDeleteCurriculumMaterial() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ curriculumPublicId, kind, materialPublicId }: { curriculumPublicId: string; kind: MaterialKind; materialPublicId: string }) =>
      curriculaService.deleteMaterial(curriculumPublicId, kind, materialPublicId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: curriculumKeys.all }); toast.success('Material deleted'); },
    onError: (err: Error) => toast.error('Could not delete material', err.message),
  });
}
```

- [ ] **Step 2: Modal**

```tsx
// frontend/src/features/courses/AdminMaterialForms.tsx
import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAddCurriculumMaterial } from '../../hooks/use-curricula';
import { uploadResourceFile, uploadDocument } from '../../lib/media-upload';
import { isExcelFile, parseExcelQuestions } from '../../lib/excel-questions';
import type { MaterialKind } from '../../services/curricula.service';

const TITLES: Record<MaterialKind, string> = { resource: 'Add resource', assignment: 'Add assignment', worksheet: 'Add worksheet' };

export function AddMaterialModal({ curriculumPublicId, topics, initialTopicId, kind, onClose }: {
  curriculumPublicId: string;
  topics: { publicId: string; title: string }[];
  initialTopicId: string;
  kind: MaterialKind;
  onClose: () => void;
}) {
  const { mutate: add, isPending } = useAddCurriculumMaterial();
  const [topicIds, setTopicIds] = useState<string[]>([initialTopicId]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState(100);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsFile = kind !== 'assignment';
  const ready = !!title.trim() && topicIds.length > 0 && (!needsFile || !!file) && (kind !== 'assignment' || !!description.trim());

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { title: title.trim(), topicPublicIds: topicIds };
      if (kind === 'resource' && file) {
        Object.assign(body, { description: description.trim() || undefined, ...(await uploadResourceFile(file, () => undefined)) });
      } else if (kind === 'assignment') {
        Object.assign(body, { description: description.trim(), maxScore, dueDate: dueDate ? new Date(dueDate).toISOString() : undefined });
        if (file) Object.assign(body, { isFileAttachment: true, ...(await uploadDocument(file)) });
      } else if (kind === 'worksheet' && file) {
        if (isExcelFile(file)) Object.assign(body, { type: 'WORKSHEET', questions: await parseExcelQuestions(file) });
        else Object.assign(body, { type: 'WORKSHEET', isFileAttachment: true, ...(await uploadDocument(file)) });
      }
      add({ curriculumPublicId, kind, body }, { onSuccess: onClose });
    } catch (err) {
      setError((err as Error).message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => setTopicIds((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  return (
    <Modal
      open
      onClose={onClose}
      title={TITLES[kind]}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" loading={busy || isPending} disabled={!ready} onClick={save}>Save</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        {kind !== 'worksheet' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description{kind === 'resource' ? ' (optional)' : ''}
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
          </div>
        )}
        {kind === 'assignment' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Due date (optional)" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <Input label="Max score" type="number" value={String(maxScore)} onChange={(e) => setMaxScore(Number(e.target.value) || 100)} />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {kind === 'worksheet' ? 'Excel questions or a file' : kind === 'assignment' ? 'Attachment (optional)' : 'File'}
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-brand-400">
            <Upload className="h-4 w-4" /> {file ? file.name : 'Choose file'}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              accept={kind === 'worksheet' ? '.xlsx,.xls,.pdf,.doc,.docx' : undefined} />
          </label>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Topics</p>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <button key={t.publicId} type="button" aria-pressed={topicIds.includes(t.publicId)} onClick={() => toggle(t.publicId)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${topicIds.includes(t.publicId) ? 'bg-accent text-accent-ink' : 'bg-surface-sunk text-ink-muted hover:text-ink'}`}>
                {t.title}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}
```

(`uploadDocument` returns `{ filePublicId, fileMimeType, fileOriginalName }`; `uploadResourceFile` returns `{ mediaPublicId, fileName, mimeType, sizeBytes }` — both spread straight into the body.)

- [ ] **Step 3: Topic actions + delete on the structure page**

`CourseStructureTree` / `TopicNode`: optional prop `renderTopicActions?: (topic: StructureTopic) => ReactNode`, rendered at the top of the expanded panel.

`AdminCurriculumStructurePage.tsx`: state `const [adding, setAdding] = useState<{ kind: MaterialKind; topicId: string } | null>(null);`, `const { mutate: remove } = useDeleteCurriculumMaterial();` and pass

```tsx
renderTopicActions={(topic) => (
  <div className="flex flex-wrap gap-2">
    {(['resource', 'assignment', 'worksheet'] as const).map((kind) => (
      <Button key={kind} size="sm" variant="outline" onClick={() => setAdding({ kind, topicId: topic.publicId })}>
        <Plus className="h-3.5 w-3.5" /> Add {kind}
      </Button>
    ))}
  </div>
)}
renderMaterialExtra={(m) => m.authorRole === 'ADMIN' && (
  <button type="button" aria-label={`Delete ${m.title}`} className="ml-auto text-gray-400 hover:text-red-500"
    onClick={(e) => { e.stopPropagation(); remove({ curriculumPublicId: data.curriculum.publicId, kind: m.kind, materialPublicId: m.publicId }); }}>
    <Trash2 className="h-3.5 w-3.5" />
  </button>
)}
```

and render `{adding && <AddMaterialModal curriculumPublicId={data.curriculum.publicId} topics={data.topics} initialTopicId={adding.topicId} kind={adding.kind} onClose={() => setAdding(null)} />}`.

(Because `renderMaterialExtra` sits inside the material `<button>`, render material rows as `<div role="button" tabIndex={0}>` with `onClick`/`onKeyDown(Enter)` in the tree instead of a nested `<button>`, to keep valid HTML.)

- [ ] **Step 4: Verify + commit** — `npx tsc --noEmit -p . && npx vite build` → clean.

```bash
git add frontend/src
git commit -m "feat(frontend): admins author materials on the curriculum structure page"
```

---

## Phase 4 — Admin-item submissions

### Task 11: Grader stamp, grading authorisation, tutor submissions endpoint

**Files:**
- Modify: `assignments/assignment.model.ts`, `assignment.types.ts`, `assignment.service.ts`; `worksheets/worksheet.model.ts`, `worksheet.types.ts`, `worksheet.service.ts`; `courses/course.service.ts`, `course.controller.ts`, `course.routes.ts`
- Test: `server/src/tests/modules/materials.grading.test.ts`

**Interfaces:**
- Consumes: `findGraderTutor` (Task 4).
- Produces: `graderTutorPublicId?: string` on `ISubmission` and `IWorksheetSubmission`; `courseService.getMaterialSubmissions(coursePublicId, tutorUserPublicId, kind, materialPublicId)`; route `GET /courses/:coursePublicId/materials/:kind/:materialPublicId/submissions` (TUTOR).

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/modules/materials.grading.test.ts
import { assignmentService } from '../../modules/assignments/assignment.service';
import { worksheetService } from '../../modules/worksheets/worksheet.service';
import { courseService } from '../../modules/courses/course.service';
import { AssignmentModel, SubmissionModel } from '../../modules/assignments/assignment.model';
import { WorksheetModel, WorksheetSubmissionModel } from '../../modules/worksheets/worksheet.model';
import { CourseModel } from '../../modules/courses/course.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import * as access from '../../modules/courses/material-access';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const adminAssignment = {
  publicId: 'a-1', status: 'PUBLISHED', maxScore: 10, curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'ADMIN',
};

describe('admin-item submissions', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stamps the student\'s course tutor on an admin assignment submission', async () => {
    jest.spyOn(AssignmentModel, 'findOne').mockResolvedValue(adminAssignment as never);
    jest.spyOn(SubmissionModel, 'findOne').mockResolvedValue(null as never);
    jest.spyOn(access, 'findGraderTutor').mockResolvedValue('tp-B');
    const create = jest.spyOn(SubmissionModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await assignmentService.submit('a-1', 'sp-1', { content: 'answer' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ graderTutorPublicId: 'tp-B' }));
  });

  it('does not stamp tutor-authored assignments', async () => {
    jest.spyOn(AssignmentModel, 'findOne').mockResolvedValue({ ...adminAssignment, authorRole: 'TUTOR', tutorPublicId: 'tp-A' } as never);
    jest.spyOn(SubmissionModel, 'findOne').mockResolvedValue(null as never);
    const grader = jest.spyOn(access, 'findGraderTutor');
    const create = jest.spyOn(SubmissionModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await assignmentService.submit('a-1', 'sp-1', { content: 'answer' });
    expect(grader).not.toHaveBeenCalled();
    expect((create.mock.calls[0] as unknown as [Record<string, unknown>])[0].graderTutorPublicId).toBeUndefined();
  });

  it('lets the stamped tutor grade and 403s any other tutor', async () => {
    jest.spyOn(SubmissionModel, 'findOne').mockResolvedValue({ publicId: 's-1', assignmentPublicId: 'a-1', graderTutorPublicId: 'tp-B' } as never);
    jest.spyOn(AssignmentModel, 'findOne').mockResolvedValue(adminAssignment as never);
    jest.spyOn(SubmissionModel, 'findOneAndUpdate').mockReturnValue(lean({ status: 'GRADED' }) as never);
    await expect(assignmentService.gradeSubmission('s-1', 'tp-B', { score: 8 })).resolves.toMatchObject({ status: 'GRADED' });
    await expect(assignmentService.gradeSubmission('s-1', 'tp-C', { score: 8 })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('stamps the grader on admin worksheet submissions', async () => {
    jest.spyOn(WorksheetModel, 'findOne').mockReturnValue(lean({
      publicId: 'w-1', status: 'PUBLISHED', authorRole: 'ADMIN', curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'],
      questions: [{ correctIndex: 1 }],
    }) as never);
    jest.spyOn(WorksheetSubmissionModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(access, 'findGraderTutor').mockResolvedValue('tp-B');
    const create = jest.spyOn(WorksheetSubmissionModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await worksheetService.submitAnswers('w-1', 'sp-1', { answers: [1] });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ graderTutorPublicId: 'tp-B', score: 100 }));
  });

  it('lists a course\'s submissions for one item to that course\'s tutor only', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-B' }) as never);
    jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean({ publicId: 'c-1', tutorPublicId: 'tp-B', studentPublicId: 'sp-1' }) as never);
    const find = jest.spyOn(SubmissionModel, 'find').mockReturnValue({ sort: () => lean([]) } as never);
    await courseService.getMaterialSubmissions('c-1', 'tu-B', 'assignment', 'a-1');
    expect(find).toHaveBeenCalledWith({ assignmentPublicId: 'a-1', studentPublicId: 'sp-1', isDeleted: false });

    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-Z' }) as never);
    await expect(courseService.getMaterialSubmissions('c-1', 'tu-Z', 'assignment', 'a-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx jest src/tests/modules/materials.grading` → FAIL.

- [ ] **Step 3: Implement**

Models: add `graderTutorPublicId: { type: String, index: true },` to both submission schemas; types: `graderTutorPublicId?: string;` on `ISubmission` and `IWorksheetSubmission`. Material models must also expose `authorRole` etc. on the TS interfaces (done in Task 1).

`assignment.service.ts` `submit`: after the status check,

```ts
    // Admin (curriculum) items are graded by the tutor of the student's course.
    const graderTutorPublicId = assignment.authorRole === 'ADMIN'
      ? await access.findGraderTutor(studentPublicId, assignment)
      : undefined;
```

include `...(graderTutorPublicId ? { graderTutorPublicId } : {})` in both the `$set` of the resubmission update and the `create` object. Import `import * as access from '../courses/material-access';` (namespace import so tests can spy).

`gradeSubmission` authorisation:

```ts
    const assignment = await AssignmentModel.findOne({ publicId: submission.assignmentPublicId });
    const allowed = !!assignment && (
      assignment.tutorPublicId === tutorPublicId ||
      (assignment.authorRole === 'ADMIN' && submission.graderTutorPublicId === tutorPublicId)
    );
    if (!assignment || !allowed) throw new AppError('Not authorized to grade this submission', 403);
```

`worksheet.service.ts` `submitAnswers`: before `create`, `const graderTutorPublicId = worksheet.authorRole === 'ADMIN' ? await access.findGraderTutor(studentPublicId, worksheet) : undefined;` and add `...(graderTutorPublicId ? { graderTutorPublicId } : {})` to the create object.

`course.service.ts`:

```ts
  /** One item's submissions from this course's student, for the course's tutor (admin items panel). */
  async getMaterialSubmissions(coursePublicId: string, tutorUserPublicId: string, kind: string, materialPublicId: string) {
    const tutor = await TutorProfileModel.findOne({ userPublicId: tutorUserPublicId, isDeleted: false }).lean();
    const course = await CourseModel.findOne({ publicId: coursePublicId, isDeleted: false }).lean();
    if (!tutor || !course || course.tutorPublicId !== tutor.publicId) throw new NotFoundError('Course');
    if (kind === 'assignment') {
      return SubmissionModel.find({ assignmentPublicId: materialPublicId, studentPublicId: course.studentPublicId, isDeleted: false })
        .sort({ submittedAt: -1 }).lean();
    }
    if (kind === 'worksheet') {
      return WorksheetSubmissionModel.find({ worksheetPublicId: materialPublicId, studentPublicId: course.studentPublicId, isDeleted: false })
        .sort({ submittedAt: -1 }).lean();
    }
    throw new ValidationError({ kind: ['kind must be assignment or worksheet'] });
  }
```

(imports: `SubmissionModel` from `'../assignments/assignment.model'`, `WorksheetSubmissionModel` from `'../worksheets/worksheet.model'`, `ValidationError` from utils/error.)

Controller + route:

```ts
  async getMaterialSubmissions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { coursePublicId, kind, materialPublicId } = req.params;
      sendSuccess(res, await courseService.getMaterialSubmissions(coursePublicId, req.user!.publicId, kind, materialPublicId), 'Submissions fetched');
    } catch (error) { next(error); }
  }
```

`router.get('/:coursePublicId/materials/:kind/:materialPublicId/submissions', requireRole(Role.TUTOR), courseController.getMaterialSubmissions.bind(courseController));`

- [ ] **Step 4: Verify + commit** — `npx jest --runInBand && npx tsc --noEmit -p .` → pass.

```bash
git add server/src
git commit -m "feat: student's course tutor handles admin-item submissions"
```

---

### Task 12: Frontend — tutor submissions panel on the course page

**Files:**
- Modify: `services/courses.service.ts`, `hooks/use-courses.ts`, `pages/tutor/TutorCoursePage.tsx`

**Interfaces:**
- Consumes: Task 11 route; existing `useGradeSubmission` (hooks/use-assignments.ts).
- Produces: `coursesService.getMaterialSubmissions(courseId, kind, materialId)`, `useMaterialSubmissions(...)`.

- [ ] **Step 1: Service + hook**

```ts
  getMaterialSubmissions: (coursePublicId: string, kind: 'assignment' | 'worksheet', materialPublicId: string) =>
    api.get(`/courses/${coursePublicId}/materials/${kind}/${materialPublicId}/submissions`)
      .then((r) => r.data.data as Array<{ publicId: string; status?: string; score?: number; content?: string; submittedAt?: string; feedback?: string }>),
```

```ts
export function useMaterialSubmissions(coursePublicId: string, kind: 'assignment' | 'worksheet', materialPublicId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...courseKeys.all, 'material-submissions', coursePublicId, kind, materialPublicId],
    queryFn: () => coursesService.getMaterialSubmissions(coursePublicId, kind, materialPublicId),
    enabled,
  });
}
```

- [ ] **Step 2: Panel** — in `TutorCoursePage.tsx`:

```tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CourseStructureView } from '../../features/courses/CourseStructureView';
import { useMaterialSubmissions } from '../../hooks/use-courses';
import { useGradeSubmission } from '../../hooks/use-assignments';
import type { StructureMaterial } from '../../services/courses.service';

function SubmissionsModal({ coursePublicId, material, onClose }: { coursePublicId: string; material: StructureMaterial; onClose: () => void }) {
  const kind = material.kind as 'assignment' | 'worksheet';
  const { data: subs = [], isLoading } = useMaterialSubmissions(coursePublicId, kind, material.publicId, true);
  const { mutateAsync: grade, isPending } = useGradeSubmission();
  const [scores, setScores] = useState<Record<string, string>>({});

  return (
    <Modal open onClose={onClose} title={`Submissions — ${material.title}`}>
      {isLoading ? <p className="text-sm text-gray-500">Loading…</p> : subs.length === 0 ? (
        <p className="text-sm text-gray-500">No submission yet.</p>
      ) : (
        <ul className="space-y-3">
          {subs.map((s) => (
            <li key={s.publicId} className="rounded-lg border border-rule p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                {s.status && <Badge tone="soft" variant={s.status === 'GRADED' ? 'success' : 'warning'}>{s.status}</Badge>}
                {s.score !== undefined && <span>Score: {s.score}</span>}
              </div>
              {s.content && <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{s.content}</p>}
              {kind === 'assignment' && s.status !== 'GRADED' && (
                <div className="mt-2 flex items-center gap-2">
                  <input type="number" min={0} value={scores[s.publicId] ?? ''} onChange={(e) => setScores({ ...scores, [s.publicId]: e.target.value })}
                    className="w-20 rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1 text-sm bg-white dark:bg-gray-900" />
                  <Button size="sm" loading={isPending} disabled={!scores[s.publicId]}
                    onClick={() => grade({ submissionId: s.publicId, assignmentId: material.publicId, dto: { score: Number(scores[s.publicId]) } })}>
                    Grade
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function TutorCoursePage() {
  const { coursePublicId = '' } = useParams<{ coursePublicId: string }>();
  const [open, setOpen] = useState<StructureMaterial | null>(null);
  return (
    <>
      <CourseStructureView
        coursePublicId={coursePublicId}
        backTo="/dashboard/tutor/course-requests"
        backLabel="Course requests"
        renderMaterialExtra={(m) => m.authorRole === 'ADMIN' && m.kind !== 'resource' && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={(e) => { e.stopPropagation(); setOpen(m); }}>
            Submissions
          </Button>
        )}
      />
      {open && <SubmissionsModal coursePublicId={coursePublicId} material={open} onClose={() => setOpen(null)} />}
    </>
  );
}
```

(Match `useGradeSubmission`'s variable shape to `hooks/use-assignments.ts` — it is called with `{ submissionId, assignmentId, dto }` in `TutorAssignmentsPage`.) The spec's "Submissions (N)" count is shown inside the modal rather than on the button, to avoid one request per material on page load — ledger this as a ruling.

- [ ] **Step 3: Verify + commit** — `npx tsc --noEmit -p . && npx vite build` → clean.

```bash
git add frontend/src
git commit -m "feat(frontend): tutors review and grade admin-item submissions from the course page"
```

---

### Task 13: Final verification

- [ ] `cd server && npx jest --runInBand` → all pass; `npx tsc --noEmit -p .` → clean.
- [ ] `cd frontend && npx tsc --noEmit -p . && npx vite build` → clean.
- [ ] `grep -rn "resourceIds\|assignmentIds\|worksheetIds" server/src frontend/src` → no output.
- [ ] Report: manual smoke per role not run without a non-production DB; known gaps (spec §11) remain.
