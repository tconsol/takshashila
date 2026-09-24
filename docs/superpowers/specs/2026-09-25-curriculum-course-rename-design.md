# Curriculum / Course Rename — Design Spec

Date: 2026-09-25
Status: Draft — awaiting review
Sub-project 1 of 2. Sub-project 2 (materials attached to curriculum topics +
course-structure views for every role) is designed separately and builds on the
names defined here.

## 1. Goal

Make the code, API, database and UI use the product's terminology:

| Term | Meaning |
|---|---|
| **Curriculum** | Authored by an Admin/SuperAdmin for one school district + grade + subject: an ordered list of topics. |
| **Course** | Created by a Student from one curriculum: the topics the student picked, bundled by their requirement, plus an availability window. Creating a course sends it to a chosen tutor as a request. The tutor accepts (deciding how many classes, which prepays them) or rejects it; classes are then scheduled from the tutor's decision. |

Today the code calls the curriculum a `Course` and the student's course a
`CourseRequest`. This is a **pure rename**: no behaviour changes.

## 2. Decisions (from brainstorming)

- Full rename in code, API routes, DB collections and fields, frontend types and
  URLs — not labels only.
- The mobile app has no course/curriculum code (verified by search), so no mobile
  client breaks.
- **Persisted financial strings do not change** (see 3.5): wallet
  `referenceType` values and idempotency-key formats are stored in
  `wallettransactions` and used for dedupe. Renaming them would split history and
  could let a retried charge/refund slip past its idempotency guard.
- Course statuses keep their values (`PENDING` = sent to tutor, `ACCEPTED`,
  `REJECTED`, `CANCELLED`, `COMPLETED`). Billing mode `COURSE_PREPAID` keeps its
  name — it is already about the student's course.

## 3. Rename map

### 3.1 Server modules

| Before | After |
|---|---|
| `modules/courses/` (`course.model/types/validators/service/controller/routes.ts`) | `modules/curricula/` (`curriculum.*.ts`) |
| `modules/course-requests/` (`course-request.*.ts`, `course-progress.ts`) | `modules/courses/` (`course.*.ts`, `course-progress.ts`) |
| `CourseModel` / `ICourse` / `ICourseTopic` / `courseService` / `courseController` | `CurriculumModel` / `ICurriculum` / `ICurriculumTopic` / `curriculumService` / `curriculumController` |
| `CourseRequestModel` / `ICourseRequest` / `CourseRequestStatus` / `courseRequestService` / `courseRequestController` / `EnrichedCourseRequest` | `CourseModel` / `ICourse` / `CourseStatus` / `courseService` / `courseController` / `EnrichedCourse` |
| DTO/schema names (`createCourseSchema`, `createCourseRequestSchema`, `scheduleCourseClassSchema`, `studentCatalogQuerySchema`, …) | `createCurriculumSchema`, `createCourseSchema`, `scheduleCourseClassSchema` (unchanged), `curriculumCatalogQuerySchema`, … — every name follows the table above |
| Test files `course.*.test.ts`, `course-request.*.test.ts`, `course-progress.test.ts`, `course.tutors.test.ts`, `course.delete.test.ts`, `resolve-course-district.test.ts` | `curriculum.*.test.ts`, `course.*.test.ts`, `course-progress.test.ts`, `curriculum.tutors.test.ts`, `curriculum.delete.test.ts`, `resolve-curriculum-district.test.ts` |
| Scripts `migrate-course-districts.ts`, `resolve-course-district.ts` | `migrate-curriculum-districts.ts`, `resolve-curriculum-district.ts` |

Because `modules/courses/` is reused for the *new* meaning, the move is done in
two steps in one commit series: `courses → curricula` first, then
`course-requests → courses`.

### 3.2 Mongoose models and collections

| Before | After |
|---|---|
| model `'Course'` → collection `courses` | model `'Curriculum'` → collection `curricula` (set explicitly: `mongoose.model('Curriculum', schema, 'curricula')`) |
| model `'CourseRequest'` → collection `courserequests` | model `'Course'` → collection `courses` |

### 3.3 Fields

Curriculum (formerly Course): no field changes (topics keep `publicId`, `title`,
`order`, `resourceIds`, `assignmentIds`, `worksheetIds`).

Course (formerly CourseRequest):

| Before | After |
|---|---|
| `coursePublicId` (the curriculum) | `curriculumPublicId` |
| `selectedTopicPublicIds` | `topicPublicIds` |
| everything else | unchanged |

ScheduledClass:

| Before | After |
|---|---|
| `courseRequestPublicId` (index) | `coursePublicId` (index) |
| `coursePublicId` (the curriculum) | `curriculumPublicId` |
| `courseTopicPublicId` | `topicPublicId` |

Enriched list fields returned by the API: `courseTitle` → `curriculumTitle`,
`topicTitles` unchanged, `studentName`/`tutorName` unchanged. Progress response:
`course` (curriculum info) → `curriculum`, `request` → `course`.

### 3.4 API routes

| Before | After |
|---|---|
| `GET/POST /courses`, `GET/PUT/DELETE /courses/:coursePublicId`, `POST /courses/:id/publish|unpublish`, `GET /courses/:id/tutors` | `/curricula`, `/curricula/:curriculumPublicId`, `/curricula/:id/publish|unpublish`, `/curricula/:id/tutors` |
| `POST /course-requests`, `GET /course-requests/mine`, `GET /course-requests/incoming`, `POST /course-requests/:requestPublicId/accept|reject|schedule-class|cancel`, `GET /course-requests/:id/progress` | `POST /courses`, `GET /courses/mine`, `GET /courses/incoming`, `POST /courses/:coursePublicId/accept|reject|schedule-class|cancel`, `GET /courses/:coursePublicId/progress` |

Request/response bodies follow the field renames in 3.3
(`curriculumPublicId`, `topicPublicIds`, `topicPublicId` in schedule-class).

No compatibility aliases for the old routes: the only client is this repo's web
frontend, which ships in the same deploy.

### 3.5 Domain events and persisted strings

| Before | After |
|---|---|
| `DomainEvent.COURSE_REQUEST_CREATED/ACCEPTED/REJECTED/CANCELLED/COMPLETED` | `DomainEvent.COURSE_CREATED/ACCEPTED/REJECTED/CANCELLED/COMPLETED` |
| `DomainEvent.COURSE_CLASS_SCHEDULED` | unchanged |
| Event payload key `requestPublicId` | `coursePublicId` |

Events are in-process only (no subscriber persists their names — verified), so
renaming them needs no data migration.

**Unchanged on purpose (persisted):**
- Wallet `referenceType` values `'COURSE_REQUEST_ACCEPT'`, `'COURSE_REQUEST_CANCEL'`.
- Idempotency keys `course-request-accept-${id}`, `course-request-cancel-${id}`,
  `course-class-${id}-${uuid}`, `course-class-cancel-refund-${classId}`.

Each keeps a comment: `// Persisted in wallettransactions — do not rename (see rename spec §3.5).`

### 3.6 Frontend

| Before | After |
|---|---|
| `services/courses.service.ts` (`Course`, `CourseTopic`, `CreateCourseDto`, `CourseTutor`, `coursesService`) | `services/curricula.service.ts` (`Curriculum`, `CurriculumTopic`, `CreateCurriculumDto`, `CurriculumTutor`, `curriculaService`) |
| `services/course-requests.service.ts` (`CourseRequest`, `CreateCourseRequestDto`, `CourseProgress`, `courseRequestsService`) | `services/courses.service.ts` (`Course`, `CreateCourseDto`, `CourseProgress`, `coursesService`) |
| `hooks/use-courses.ts` (`useCourseCatalog`, `useAdminCourses`, `useCourse`, `useCreateCourse`, `useUpdateCourse`, `useDeleteCourse`, `usePublishCourse`, `useCourseTutors`) | `hooks/use-curricula.ts` (`useCurriculumCatalog`, `useAdminCurricula`, `useCurriculum`, `useCreateCurriculum`, `useUpdateCurriculum`, `useDeleteCurriculum`, `usePublishCurriculum`, `useCurriculumTutors`) |
| `hooks/use-course-requests.ts` (`useCourseRequestsAsStudent/AsTutor`, `useCreateCourseRequest`, `useAccept/Reject/CancelCourseRequest`, `useScheduleCourseClass`, `useCourseProgress`) | `hooks/use-courses.ts` (`useMyCourses`, `useIncomingCourses`, `useCreateCourse`, `useAccept/Reject/CancelCourse`, `useScheduleCourseClass`, `useCourseProgress`) |
| Pages `StudentCoursesPage` (curriculum browse), `StudentCourseDetailPage` (build a course), `StudentCourseRequestsPage`, `StudentCourseProgressPage`, `TutorCourseRequestsPage`, `AdminCurriculumPage` | `StudentCurriculumPage`, `StudentCreateCoursePage`, `StudentMyCoursesPage`, `StudentCourseProgressPage`, `TutorCourseRequestsPage` (name kept: a new course *is* a request to the tutor), `AdminCurriculumPage` |
| `features/courses/MyCoursesSection.tsx` | unchanged path/name (already correct) |

Student URLs:

| Before | After |
|---|---|
| `/dashboard/student/courses` (curriculum browse) | `/dashboard/student/curriculum` |
| `/dashboard/student/courses/:coursePublicId` (pick topics + tutor) | `/dashboard/student/curriculum/:curriculumPublicId` |
| `/dashboard/student/course-requests` | `/dashboard/student/courses` |
| `/dashboard/student/my-courses/:requestPublicId` | `/dashboard/student/courses/:coursePublicId` |

Tutor `/dashboard/tutor/course-requests` and admin `/dashboard/admin/curriculum`
are unchanged. Sidebar: student "Courses" (browse) → "Curriculum"; add/rename
"My course requests" → "My courses".

UI copy follows the glossary everywhere: e.g. the build page's submit button
"Send course to tutor"; toasts "Course sent to tutor", "Curriculum created",
"Curriculum deleted"; admin page stays "Curriculum"; tutor inbox "Course
requests"; student dashboard section stays "My courses".

## 4. Data migration

Script: `server/src/scripts/migrate-curriculum-course-rename.ts`, same
conventions as the existing migrations (dry run by default, `--apply` to write,
raw collection access, prints per-step counts, exit 1 on error).

Steps, in this order (collection names collide, so order matters):

1. **Guard:** abort if collection `curricula` already exists and is non-empty
   (migration already ran), or if `courserequests` is missing while `courses`
   documents already have `curriculumPublicId` (partially ran) — print what was
   found and exit without changes.
2. `db.courses.renameCollection('curricula')`.
3. `db.courserequests.renameCollection('courses')`.
4. `db.courses.updateMany({}, { $rename: { coursePublicId: 'curriculumPublicId', selectedTopicPublicIds: 'topicPublicIds' } })`.
5. `db.scheduledclasses.updateMany({ $or: [{ courseRequestPublicId: { $exists: true } }, { coursePublicId: { $exists: true } }, { courseTopicPublicId: { $exists: true } }] }, …)`
   — `$rename` cannot swap names, so do it in two passes:
   `coursePublicId → curriculumPublicId` and `courseTopicPublicId → topicPublicId` first,
   then `courseRequestPublicId → coursePublicId`.
6. Rebuild indexes: drop the old `courseRequestPublicId_1` index on
   `scheduledclasses`, then `syncIndexes()` for `Curriculum`, `Course` and
   `ScheduledClass` so the renamed fields are indexed.

Dry run prints the document counts each step would touch.

## 5. Deployment order

Old code cannot read the new names and vice versa, so:

1. Stop the API and worker (brief maintenance window).
2. Run `migrate-county-to-fips.ts` and `migrate-course-districts.ts` if not
   already applied (they target the **old** names — run them first).
3. Run `migrate-curriculum-course-rename.ts --apply`.
4. Deploy the new server + frontend together; start API and worker.

`migrate-course-districts.ts` is renamed to `migrate-curriculum-districts.ts`
and updated to the new collection name, for any run *after* the rename.

## 6. Testing / verification

- Existing tests renamed and updated; the full server suite must pass with the
  same test count as before the rename (213) plus migration tests.
- Migration: a pure planning function (`planRenameSteps(existingCollections, sampleDocs)`)
  unit-tested for: fresh DB, already-migrated DB (guard aborts), partially
  migrated DB (guard aborts).
- `tsc --noEmit` for server and frontend; `vite build`.
- Leftover-name check (must print nothing):
  `grep -rnE "CourseRequest|courseRequest|course-request|selectedTopicPublicIds|courseTopicPublicId" server/src frontend/src`
  excluding the migration script, the persisted strings in §3.5, and
  `TutorCourseRequestsPage` (intentional name).
- Manual smoke (non-production DB): admin creates a curriculum; student builds a
  course and sends it; tutor accepts and schedules a class; student sees it on
  the dashboard and progress page.

## 7. Out of scope

- Sub-project 2 (materials attached to curriculum topics, structure views for
  every role).
- Renaming historical docs (`docs/superpowers/specs|plans/2026-09-2*`); they stay
  as a record of what was built under the old names.
- Compatibility aliases for old API routes.
