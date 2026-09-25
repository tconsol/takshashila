# Skill Programs (1:1) — Design Spec

Date: 2026-09-25
Status: Draft — awaiting review
Sub-project 1 of 3 for Skill Programs. Later: (2) group format — fixed session
dates, seat limit, shared live room; (3) program materials attached to modules.

## 1. Goal

Tutors create **Skill Programs**: extracurricular offerings outside the school
curriculum (arts, music, chess and games, coding, AI, languages, life skills…).
Students browse a public catalog, **enroll and pay up front**, and take the
program 1:1 with the tutor, who schedules each session inside the student's
availability. Students and parents track progress per module.

Terminology (distinct from existing concepts):

| Term | Who creates it | What it is |
|---|---|---|
| Curriculum | Admin | District + grade + subject topics (school syllabus) |
| Course | Student | A bundle of curriculum topics sent to one tutor |
| **Skill Program** | **Tutor** | A self-contained extracurricular offering with its own modules and price |

UI name: sidebar **Skill Programs** (tutor, admin), **Skills** (student catalog);
a single item is a "program".

## 2. Decisions (from brainstorming)

- Independent of curricula and courses: no curriculum, district or grade link.
- 1:1 format only in this sub-project. Group format is sub-project 2.
- Tutors publish directly (no admin approval); admins can unpublish.
- Any student may browse and enroll.
- **Fixed total price** set by the tutor, charged from the wallet on enroll.
- Student gives an availability window on enroll; the tutor books each session
  inside it and must tag the **module** the session covers.
- Optional **max enrollees** per program; enroll is refused when full.
- Refunds: when the student or tutor cancels an enrollment, every session not yet
  completed is refunded to the student's wallet.

## 3. Data model — new module `server/src/modules/programs/`

### 3.1 `Program` (collection `programs`)

| Field | Type | Notes |
|---|---|---|
| `publicId` | string | uuid |
| `tutorPublicId` | string, indexed | creator (tutor profile) |
| `title` | string ≤ 120 | required |
| `category` | enum | `ARTS`, `MUSIC`, `GAMES`, `CODING`, `AI_DATA`, `LANGUAGES`, `LIFE_SKILLS`, `OTHER` |
| `description` | string ≤ 4000 | |
| `level` | enum | `BEGINNER`, `INTERMEDIATE`, `ADVANCED` |
| `ageMin`, `ageMax` | number, optional | 3–99, `ageMin ≤ ageMax` |
| `sessionCount` | int 1–100 | |
| `sessionMinutes` | int 15–240 | default 60 |
| `priceCents` | int ≥ 0 | fixed total |
| `maxEnrollees` | int ≥ 1, optional | absent = unlimited |
| `activeEnrollmentCount` | int ≥ 0 | maintained atomically (§5.1) |
| `modules` | `[{ publicId, title ≤ 200, description ≤ 1000, order }]` | ≥ 1 module |
| `status` | enum | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `isDeleted` | bool | soft delete |

Indexes: `{ status: 1, category: 1, level: 1 }`, `{ tutorPublicId: 1, createdAt: -1 }`.

Editing rules:
- Title, description, category, level, age range and module titles/descriptions
  are always editable.
- `sessionCount`, `priceCents` and removing modules are editable only while the
  program has **no enrollments at all** (changing them would break paid
  enrollments). Adding modules is always allowed.
- `maxEnrollees` may be raised any time; lowered only to ≥ `activeEnrollmentCount`.

### 3.2 `ProgramEnrollment` (collection `programenrollments`)

| Field | Type | Notes |
|---|---|---|
| `publicId` | string | |
| `programPublicId` | string, indexed | |
| `tutorPublicId` | string, indexed | copied from program |
| `studentPublicId` | string, indexed | |
| `availabilityWindow` | same shape as Course (`daysOfWeek`, `startLocalTime`, `endLocalTime`, `ianaTimezone`) | |
| `sessionCount` | int | copied from program at enroll (frozen) |
| `priceCentsPaid` | int | frozen |
| `sessionsScheduledCount` | int, default 0 | |
| `sessionsCompletedCount` | int, default 0 | |
| `status` | enum | `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `cancelledBy` | string, optional | user publicId |
| `isDeleted` | bool | |

Unique partial index: one `ACTIVE` enrollment per `(programPublicId, studentPublicId)`.

### 3.3 ScheduledClass additions

- New `BillingMode.PROGRAM_PREPAID`.
- New fields `programEnrollmentPublicId` (indexed), `programPublicId`,
  `programModulePublicId`.

## 4. Billing (reusing course-prepaid logic)

Program sessions behave exactly like `COURSE_PREPAID` classes in
`class.service.ts` (completion, cancellation, dispute/auto-resolution refunds).
Implementation: a helper `isPrepaid(mode)` returning true for both modes replaces
the three `=== BillingMode.COURSE_PREPAID` checks; the progress update after
completion dispatches on `coursePublicId` (existing) vs
`programEnrollmentPublicId` (new: `$inc sessionsCompletedCount`, flip to
`COMPLETED` when it reaches `sessionCount`, emit `PROGRAM_ENROLLMENT_COMPLETED`).

Per-session `costCents` (set when the tutor books a session):
`share = floor(priceCentsPaid / sessionCount)`; sessions 1…n−1 cost `share`,
the n-th costs `priceCentsPaid − share × (n − 1)` so the sum is exact.
On completion the tutor earns `costCents − PLATFORM_FEE_CENTS` (existing rule).

Wallet strings (persisted; new, never renamed later):
- enroll debit: `referenceType: 'PROGRAM_ENROLL'`, idempotency `program-enroll-${enrollmentPublicId}`
- cancel refund of never-booked sessions: `referenceType: 'PROGRAM_CANCEL'`, idempotency `program-cancel-${enrollmentPublicId}`
- per-class cancel refund reuses the class path with idempotency
  `program-class-cancel-refund-${classPublicId}`.

## 5. Flows

### 5.1 Enroll (student)

`POST /programs/:programPublicId/enroll` body `{ availabilityWindow }`.
1. Program must be `PUBLISHED`, not deleted; the caller must not already hold an
   `ACTIVE` enrollment in it (409).
2. **Seat reservation, atomic:** `findOneAndUpdate({ publicId, status: PUBLISHED,
   $or: [{ maxEnrollees: { $exists: false } }, { $expr: { $lt: ['$activeEnrollmentCount', '$maxEnrollees'] } }] },
   { $inc: { activeEnrollmentCount: 1 } })` — null → 409 "Program is full".
3. Debit the wallet `priceCents` (insufficient funds → release the seat with
   `$inc: -1`, rethrow 402).
4. Create the enrollment (`ACTIVE`). If creation fails, refund and release.
5. Emit `PROGRAM_ENROLLED` (tutor notification).

### 5.2 Schedule a session (tutor)

`POST /programs/enrollments/:enrollmentPublicId/sessions` body
`{ startUTC, endUTC, title, programModulePublicId }`.
- Caller must be the enrollment's tutor; enrollment `ACTIVE`;
  `sessionsScheduledCount < sessionCount`; module must belong to the program;
  times inside the availability window (same check as courses);
  `endUTC − startUTC` ≤ `sessionMinutes` + 15 min tolerance.
- Creates a `ScheduledClass` (`PROGRAM_PREPAID`, 1:1, cost per §4), atomically
  increments `sessionsScheduledCount` guarded by `< sessionCount`.

### 5.3 Cancel an enrollment (student or tutor)

`POST /programs/enrollments/:enrollmentPublicId/cancel`.
- Cancels every future `SCHEDULED` session through `classService.cancelClass`
  (each refunds its own `costCents`).
- Refunds the never-booked remainder:
  `priceCentsPaid − Σ costCents of sessions ever booked` (course-cancel rule).
- Sets `CANCELLED`, `$inc activeEnrollmentCount: -1` on the program.

### 5.4 Program lifecycle (tutor)

`DRAFT → PUBLISHED → ARCHIVED` (and `ARCHIVED → PUBLISHED`). Archived programs
leave the catalog; existing enrollments continue. Delete (soft) only when the
program has no enrollments.

### 5.5 Admin

`GET /programs/admin` (all programs, filter by status/category/tutor);
`POST /programs/:id/unpublish` (ADMIN, SUPER_ADMIN) → `ARCHIVED`.

## 6. API summary

| Method + path | Roles |
|---|---|
| `GET /programs` (catalog: published; `?category&level&age&q&page`) | any authenticated |
| `GET /programs/:id` | any (drafts: owner + admins only) |
| `GET /programs/mine` | TUTOR, PRINCIPAL |
| `POST /programs`, `PUT /programs/:id`, `POST /programs/:id/publish`, `/archive`, `DELETE /programs/:id` | TUTOR, PRINCIPAL (owner) |
| `GET /programs/:id/enrollments` | owner tutor |
| `POST /programs/:id/enroll` | STUDENT |
| `GET /programs/enrollments/mine` | STUDENT |
| `GET /programs/enrollments/children` | PARENT |
| `GET /programs/enrollments/:id/structure` | enrollment's student, their parents, the tutor, admins (status only for student/parent) |
| `POST /programs/enrollments/:id/sessions` | enrollment's tutor |
| `POST /programs/enrollments/:id/cancel` | enrollment's student or tutor |
| `GET /programs/admin`, `POST /programs/:id/unpublish` | ADMIN, SUPER_ADMIN |

All bodies validated with zod (422 on bad input). Access failures → 404.

## 7. Frontend

- **Tutor** — sidebar **Skill Programs**: list (status tabs), **New program**
  form (title, category, level, age range, sessions, minutes, price, max
  enrollees, modules editor), edit, Publish / Archive, program page with
  enrollees and **Schedule next session** (datetime + required **Module**
  select), **View enrollee** (structure tree).
- **Student** — sidebar **Skills**: catalog with category/level/age filters,
  cards (title, tutor, price, sessions, level, "Full" badge); program page
  (outline, tutor, price, **Enroll** → availability form → confirm charge);
  dashboard **My skill programs** section next to My courses; enrollment page
  (Program › Module › sessions, with status).
- **Parent** — **Courses** page gains a **Skill programs** section per child.
- **Admin** — **Skill Programs** page: list + Unpublish.
- The shared `CourseStructureTree` is reused for the enrollment view (modules as
  topics, no materials until sub-project 3).

## 8. Testing

Server (Jest):
- Program validation (age range, modules ≥ 1, edit locks after enrollment).
- Enroll: charges price; duplicate active enrollment 409; cap enforced by the
  atomic seat reservation (second enroll on the last seat → 409); insufficient
  funds releases the seat; draft/archived not enrollable.
- Session scheduling: tutor-only, inside availability, module required and from
  the program, count cap, per-session cost split sums to the price.
- Completion: tutor earns `costCents − fee`, student not charged,
  `sessionsCompletedCount` increments and completes the enrollment.
- Cancel: future sessions cancelled + refunded, never-booked remainder refunded,
  seat released.
- Catalog filters and draft visibility; structure access per role.

Frontend: `tsc --noEmit`, `vite build`.

## 9. Out of scope

Group format (sub-project 2), program materials (sub-project 3), reviews/ratings
of programs, discounts/coupons, admin approval queue.
