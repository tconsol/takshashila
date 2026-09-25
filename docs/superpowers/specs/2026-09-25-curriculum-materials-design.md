# Curriculum Materials + Course Structure for Every Role — Design Spec

Date: 2026-09-25
Status: Draft — awaiting review
Sub-project 2 of 2. Builds on the rename (sub-project 1,
`2026-09-25-curriculum-course-rename-design.md`): **Curriculum** = admin-authored
topics for a district + grade + subject; **Course** = a student's bundle of
curriculum topics sent to one tutor.

## 1. Goal

1. Every new resource, assignment and worksheet is attached to a **curriculum**
   and one or more of its **topics**.
2. Admins/SuperAdmins can author resources, assignments and worksheets directly
   on a curriculum's topics.
3. Students, parents, tutors and admins can all see a course's nested structure
   (Course › Topic › classes + materials); only students and parents see
   progress status.
4. Clicking a material opens the item itself, per role.

## 2. Decisions (from brainstorming — not open questions)

- Attachment target is the shared **curriculum** (not the student's course).
- Picking a curriculum + at least one topic is **required** when a tutor creates
  a material. Consequence: a tutor with no matching published curriculum cannot
  create materials; the form says so.
- A tutor can attach only to **published curricula whose subject the tutor
  teaches** (and grade, if the tutor set grades taught — empty = all grades).
- **Visibility inside a course's structure:**
  - Admin-authored items: visible to everyone involved with any course built on
    that curriculum (the student, their linked parents, their tutor) and admins.
  - Tutor-authored items: visible only to that tutor's own students (and their
    parents), that tutor, and admins. Other tutors' students get **no access**
    (not listed, cannot open).
- Admin-authored assignments/worksheets are submitted by students and handled by
  **the student's own course tutor** (assignments graded by them; worksheets
  auto-score as today).
- Roles that author curriculum materials: **Admin + SuperAdmin**.
- Status (completed / scheduled / next class) is shown to **students and their
  parents** only.
- Clicking a material opens **the item itself** (see §7).

## 3. Data model

### 3.1 New fields on Resource, Assignment, Worksheet

| Field | Type | Notes |
|---|---|---|
| `curriculumPublicId` | string, indexed | Required for new items (validator); absent on legacy items. |
| `topicPublicIds` | string[] | ≥1 for new items; each must be a topic of the curriculum. |
| `authorRole` | `'TUTOR' \| 'ADMIN'` | Default `'TUTOR'` (so legacy items read as tutor items). |
| `authorUserPublicId` | string | User who created it. Backfilled lazily: absent on legacy items. |

`tutorPublicId` becomes **optional** on all three models (absent when
`authorRole = 'ADMIN'`). Assignment's `classPublicId` becomes optional too
(admin assignments have no class); tutor assignments still require it in the
tutor create validator.

Compound index on each: `{ curriculumPublicId: 1, topicPublicIds: 1, isDeleted: 1 }`.

### 3.2 Removed

`ICurriculumTopic.resourceIds / assignmentIds / worksheetIds` and their schema
fields are removed. The admin form only ever sent them as empty arrays (no UI
populates them), so no data is lost; the progress endpoint switches to querying
materials by curriculum, and the admin form stops sending them.
Curriculum update validators stop accepting them (unknown keys are stripped).

### 3.3 Grader stamp on submissions

- `Submission` (assignments) and `WorksheetSubmission` gain optional
  `graderTutorPublicId`.
- Set on submit **only for admin-authored items**: the `tutorPublicId` of the
  student's ACCEPTED/COMPLETED course on that curriculum whose `topicPublicIds`
  intersect the item's topics (most recently accepted if several).

## 4. Access rules (server, one helper)

New `server/src/modules/courses/material-access.ts`:

```ts
canViewMaterial(viewer, material): Promise<boolean>
```

`viewer` = `{ role, userPublicId }`. Resolution:

- **ADMIN / SUPER_ADMIN**: always.
- **TUTOR**: author (`material.tutorPublicId === viewer's tutor profile`), or
  `authorRole = 'ADMIN'` and the tutor has an ACCEPTED/COMPLETED course on that
  curriculum sharing a topic with the material.
- **STUDENT**: has an ACCEPTED/COMPLETED course on that curriculum sharing a
  topic with the material, **and** (`authorRole = 'ADMIN'` or
  `material.tutorPublicId === course.tutorPublicId`).
- **PARENT**: same as STUDENT for any child in `childStudentPublicIds`.
- Legacy items (no `curriculumPublicId`): unchanged behaviour — this helper
  isn't consulted for them.

Applied at:
- `GET /resources/:id/read-url` and `GET /resources/:id` — for curriculum items.
- `GET /worksheets/:id`, `POST /worksheets/:id/submit` — for curriculum items.
- `GET /assignments/:id`, `POST /assignments/:id/submit` — for curriculum items.
- Structure endpoints (§6) filter materials through the same rules (batched, not
  per-item queries).

Failure → 404 (don't reveal existence).

## 5. Creating materials

### 5.1 Attachable curricula (tutors)

`GET /curricula/attachable` (TUTOR, PRINCIPAL): published curricula where
`subject` matches one of the tutor's subjects (case-insensitive, both normalised)
and `grade ∈ gradesTaught` (or any grade if empty). Returns
`{ publicId, title, subject, grade, district, topics: [{ publicId, title, order }] }`.

### 5.2 Tutor create (existing endpoints)

`POST /resources`, `POST /assignments`, `POST /worksheets` validators gain
required `curriculumPublicId` + `topicPublicIds` (min 1). Service checks the
curriculum is in the tutor's attachable set and every topic belongs to it
(422 otherwise). Sets `authorRole: 'TUTOR'`, `authorUserPublicId`.

Frontend: `TutorResourcesPage`, `TutorAssignmentsPage`, `TutorWorksheetsPage`
create forms get a **Curriculum** select (from 5.1) and a **Topics** multi-select
(that curriculum's topics). Empty attachable list → form replaced by
"No curriculum matches your subjects and grades yet — set them in Profile or ask
an admin to publish one."

### 5.3 Admin create (new endpoints)

Under the curriculum module, ADMIN + SUPER_ADMIN:

- `POST /curricula/:curriculumPublicId/resources` — body as tutor resource
  (title, description, mediaPublicId, fileName, mimeType, sizeBytes) + `topicPublicIds`.
- `POST /curricula/:curriculumPublicId/assignments` — title, description,
  dueDate (optional for curriculum content; `dueDate` becomes optional on the
  model — submit's late check treats a missing due date as never late), maxScore, attachments/file fields + `topicPublicIds`.
- `POST /curricula/:curriculumPublicId/worksheets` — title, type, questions or
  file fields + `topicPublicIds`.
- `DELETE /curricula/:curriculumPublicId/materials/:kind/:materialPublicId` —
  soft delete an admin-authored item.

Created with `authorRole: 'ADMIN'`, no `tutorPublicId`, status **PUBLISHED**
immediately (assignments and worksheets), `assignedToStudentPublicIds: []`.

Admin items are **excluded** from generic student/tutor lists
(`/worksheets/student/me`, `/resources/student/me`, tutor `/my` lists) — they
appear only in structure views. Concretely, `WorksheetService.getForStudent`
adds `authorRole: { $ne: 'ADMIN' }`; resource/assignment student lists already
scope by tutor/class, so they exclude admin items naturally.

## 6. Structure endpoints

### 6.1 Course structure

`GET /courses/:coursePublicId/structure` (replaces `/progress`; `/progress`
remains as an alias for one release). Allowed: owning student, their linked
parents, the course's tutor, ADMIN/SUPER_ADMIN; anyone else → 404.

Response:

```ts
{
  course: { publicId, status, classesRequired, classesCompletedCount, tutorName, studentName },
  curriculum: { publicId, title, subject, grade, district, state },
  topics: Array<{
    publicId, title, order,
    status?: 'COMPLETED' | 'SCHEDULED' | 'NOT_SCHEDULED',   // student/parent only
    nextClass?: ProgressClass,                               // student/parent only
    classes: ProgressClass[],
    materials: Array<{ kind: 'resource' | 'assignment' | 'worksheet'; publicId; title; authorRole; authorName }>,
  }>,
  otherClasses: ProgressClass[],
  viewerRole: 'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN',
}
```

Materials: `curriculumPublicId = course.curriculumPublicId`, topic ∈
`course.topicPublicIds`, and (`authorRole = 'ADMIN'` or
`tutorPublicId = course.tutorPublicId`), not deleted.

### 6.2 Curriculum structure (admins)

`GET /curricula/:curriculumPublicId/structure` (ADMIN, SUPER_ADMIN): all topics
with **all** attached materials (any author), each with `authorRole` and
`authorName`. No classes, no status.

### 6.3 Parent's children's courses

`GET /courses/children` (PARENT): courses (ACCEPTED/COMPLETED) of every child in
`childStudentPublicIds`, enriched like `/courses/mine` plus `studentName`.

## 7. Frontend

### 7.1 Shared component

`features/courses/CourseStructureTree.tsx` extracted from
`StudentCourseProgressPage`: props `{ topics, otherClasses, showStatus, onOpenMaterial }`.
Material rows show a type icon, title, and "Curriculum" badge for admin items.

### 7.2 Pages

| Role | Entry point | Page |
|---|---|---|
| Student | Dashboard **My courses** card | `/dashboard/student/courses/:id` (existing, uses tree, status on) |
| Parent | New sidebar item **Courses** | `/dashboard/parent/courses` (list, grouped by child) → `/dashboard/parent/courses/:id` (tree, status on) |
| Tutor | **Course Requests** inbox → **View course** on accepted/completed rows | `/dashboard/tutor/course-requests/:id` (tree, status off; admin items show **Submissions (N)**) |
| Admin / SuperAdmin | **Curriculum** page → **Structure** on a curriculum row | `/dashboard/admin/curriculum/:id` and `/dashboard/super-admin/curriculum/:id` (topics + all materials, per-topic **Add resource / Add assignment / Add worksheet**, delete own admin items) |

### 7.3 Opening a material

| Kind | Student | Parent | Tutor | Admin |
|---|---|---|---|---|
| Resource | open signed file URL (new tab) | same | same | same |
| Worksheet | `/dashboard/student/worksheets/:id/test` | worksheets list | `/dashboard/tutor/worksheets/:id/results` | title only |
| Assignment | new `/dashboard/student/assignments/:id` detail page (brief, attachment, due date, submit / view own submission) | assignments list | own item: existing submissions view; admin item: **Submissions (N)** panel on the course page | title only |

### 7.4 Admin authoring forms

Modal forms per kind, reusing the tutor form field components where they exist
(file upload via existing media upload flow; worksheet question editor from
`TutorWorksheetsPage`). Topic pre-selected from the row clicked; extra topics
selectable.

## 8. Admin-item submissions & grading

- Assignment submit (admin item): access check (§4), stamp
  `graderTutorPublicId`, emit `ASSIGNMENT_SUBMITTED` with it.
- `gradeSubmission` authorised if grader is the item's tutor **or**
  `submission.graderTutorPublicId === grader`.
- `GET /courses/:id/materials/:kind/:materialId/submissions` (TUTOR of that
  course): submissions for that item from that course's student only.
- Worksheet submit (admin item): access check, stamp grader; results for a
  tutor are filtered to `graderTutorPublicId = tutor` for admin items.

## 9. Phasing (plan will follow this order; each phase ships alone)

1. **Data + tutor attach:** model fields, removed topic arrays, attachable
   curricula endpoint, tutor create validation + forms, progress endpoint reads
   materials by curriculum.
2. **Structure + access:** `material-access.ts`, course/curriculum structure
   endpoints, children courses endpoint, shared tree, tutor/parent/admin pages,
   material opening incl. student assignment detail page, access checks on item
   endpoints.
3. **Admin authoring:** admin create/delete endpoints, admin forms on the
   structure page, exclusion from generic lists.
4. **Admin-item submissions:** grader stamp, grading authorisation, tutor
   submissions panel.

## 10. Testing

Server (Jest):
- Attach validation: curriculum not attachable → 422; topic not in curriculum → 422;
  missing curriculum → 422; fields persisted with `authorRole: 'TUTOR'`.
- `canViewMaterial` matrix: each role × {admin item, own-tutor item,
  other-tutor item, no matching course, topic not in course}.
- Course structure: role gating (404 for strangers), status present only for
  student/parent, material filtering by author/tutor/topic.
- Curriculum structure: admin only; includes all authors.
- Admin create: publishes immediately, no tutorPublicId, topics validated;
  excluded from `/worksheets/student/me`.
- Grader stamp + grading authorisation (own tutor ok, other tutor 403).
- Attachable curricula: subject/grade matching, unpublished excluded.

Frontend: `tsc --noEmit`, `vite build`; manual pass per role.

## 11. Known gaps (follow-ups, not in scope)

Existing behaviour for **legacy / tutor-only flows** that this spec does not change:
- Worksheets with an empty `assignedToStudentPublicIds` are listed to every
  student platform-wide (`getForStudent` has no tutor scope).
- `GET /resources/:id/read-url` has no access check for non-curriculum items.
- Assignment submit doesn't verify the student belongs to the class.
