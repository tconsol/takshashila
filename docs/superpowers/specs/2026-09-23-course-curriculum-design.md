# Course / Curriculum Concept — Design Spec

Date: 2026-09-23
Status: Approved for implementation planning

## 1. Problem / Goal

Every US county defines a different curriculum per grade. Today the platform only
has `ScheduledClass` — a single 1:1 (Tutor, Student) booked session with no notion
of a structured, ordered syllabus, and no way to pre-approve and pre-pay for a
multi-class series covering a topic set.

Goal: let Admin/SuperAdmin author a curriculum ("Course") scoped to
County + Grade, made of ordered Topics, each with attached Resources /
Assignments / Worksheets. Students browse the curriculum for their own
county+grade, pick topics they want covered, and request a continuous
series of classes from a specific Tutor. The Tutor reviews the request,
accepts it, decides how many classes (`classesRequired`) are needed to
cover the selected topics, and the platform charges the Student's wallet
for that many classes and lets the Tutor schedule them.

## 2. Scope decisions (from brainstorming)

These were explicitly decided during design and are NOT open questions:

- Course = curriculum/content container only. It is never a live session itself.
- Only Admin/SuperAdmin author Courses. Tutors and Principals have no authoring
  role. (Matches: platform-level catalog, not per-org.)
- Students self-discover and self-enroll by browsing a catalog filtered to
  their own county + grade. No push-assignment.
- A Student picks a specific Tutor to send the request to (no broadcast/matching
  queue, unlike Demo Requests).
- Course requests are strictly 1 Student : 1 Tutor. No batching/group classes.
  The existing `ScheduledClass` model (single `studentPublicId`, single
  `tutorPublicId`) is preserved unchanged.
- Scheduling cadence is flexible: Student states an availability window
  (days of week + local start/end time); Tutor books each of the N classes at
  any time inside that window — no fixed daily/weekly recurrence rule is
  enforced by the system.
- Within the series, course content assignment to a specific class is manual:
  the Tutor picks which Resource/Assignment/Worksheet from the Course to use
  for a given class, per class, as they go. No auto-sequencing of Topic
  order to class number.
- Wallet credits for the whole series are charged in full at the moment the
  Tutor accepts and sets `classesRequired`. Cancelling an individual class
  later refunds that class's share via the existing per-class refund path —
  it does not touch the other classes in the series.

## 3. Data model

All new collections follow existing Mongoose conventions in
`server/src/modules/*` (public UUID + Mongo `_id`, `timestamps: true`,
soft `isDeleted`).

### 3.1 `Course` (new — `server/src/modules/courses/course.model.ts`)

```
publicId            string (uuid, unique, indexed)
county              string (indexed)
grade               string (indexed)
subject             string
title               string
description         string?
topics              CourseTopic[]   (embedded)
createdByAdminPublicId string
isPublished         boolean (default false)
isDeleted           boolean (default false)
timestamps
```

Index: `{ county: 1, grade: 1, isPublished: 1 }` — this is the query the
Student catalog page runs.

### 3.2 `CourseTopic` (embedded subdocument, not its own collection)

```
publicId       string (uuid)
title          string
order          number
resourceIds    string[]    // existing Resource.publicId
assignmentIds  string[]    // existing Assignment.publicId
worksheetIds   string[]    // existing Worksheet.publicId
```

Embedded (not a separate collection) because topics only ever exist inside
one Course, are always read/written together with it, and there's no
independent query pattern against topics alone — matches how
`schedule.model.ts` already embeds availability rules rather than
normalizing them.

### 3.3 `CourseRequest` (new — `server/src/modules/course-requests/course-request.model.ts`)

Mirrors the existing `DemoRequestModel` pattern
(`server/src/modules/demo-requests/demo-request.model.ts`) exactly, extended
for the multi-class case:

```
publicId                 string (uuid, unique, indexed)
studentPublicId           string (indexed)
tutorPublicId              string (indexed)
coursePublicId              string (indexed)
selectedTopicPublicIds        string[]
availabilityWindow:
  daysOfWeek                number[]      // 0-6
  startLocalTime               string      // "16:00"
  endLocalTime                  string      // "19:00"
  ianaTimezone                    string
status                          'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED'
classesRequired               number?       // set by Tutor on accept
classesScheduledCount         number  (default 0)
classesCompletedCount         number  (default 0)
costCentsPerClass             number?       // snapshot of tutor's rate at accept time
totalCostCentsCharged        number?
walletTransactionPublicId      string?      // the debitWallet() transaction this created
rejectionReason               string?
isDeleted                    boolean (default false)
timestamps
```

Indexes: `{ studentPublicId: 1, status: 1 }`, `{ tutorPublicId: 1, status: 1 }`.

### 3.4 `ScheduledClass` extension (existing —
`server/src/modules/schedules/schedule.model.ts`)

Add three optional, indexed fields. Nullable, so existing 1:1 bookings are
completely unaffected:

```
courseRequestPublicId    string?  (indexed)
coursePublicId              string?
courseTopicPublicId          string?
```

### 3.5 `Student` extension (existing —
`server/src/modules/students/student.model.ts`)

Add `county: string?` alongside the existing `grade?: string` field
(`student.types.ts` currently has `grade` but no `county` anywhere in the
codebase — confirmed by repo search). Required for the catalog filter in
3.1. Surfaced in Student profile/settings so they can set it (same place
`grade` is currently set).

## 4. Server API

New module `server/src/modules/courses/` (Admin authoring + public catalog read):

- `POST   /api/courses` — Admin/SuperAdmin only (`requireRole`). Create Course + topics.
- `PUT    /api/courses/:coursePublicId` — Admin/SuperAdmin. Edit, add/reorder/remove topics.
- `POST   /api/courses/:coursePublicId/publish` / `/unpublish` — Admin/SuperAdmin.
- `GET    /api/courses` — any authenticated role; Student calls default to
  `?county=<own>&grade=<own>&isPublished=true`; Admin can query unpublished/all.
- `GET    /api/courses/:coursePublicId` — full detail incl. topics + attached content.

New module `server/src/modules/course-requests/` (mirrors `demo-requests/` routing shape):

- `POST   /course-requests` — `requireRole(Role.STUDENT)`. Body:
  `{ coursePublicId, selectedTopicPublicIds, tutorPublicId, availabilityWindow }`.
- `GET    /course-requests/mine` — Student: their own requests.
- `GET    /course-requests/incoming` — Tutor: requests sent to them, filterable by status.
- `POST   /course-requests/:id/accept` — `requireRole(Role.TUTOR)`. Body: `{ classesRequired }`.
  On accept: snapshot `costCentsPerClass` from Tutor's rate, call
  `walletService.debitWallet()` for `classesRequired * costCentsPerClass`,
  store the resulting `walletTransactionPublicId`, set status `ACCEPTED`.
- `POST   /course-requests/:id/reject` — `requireRole(Role.TUTOR)`. Body: `{ rejectionReason }`.
- `POST   /course-requests/:id/cancel` — Student or Tutor. Refunds unscheduled
  remainder via `walletService.refundWallet()` (see §5), sets status `CANCELLED`.

Scheduling itself does **not** get a new endpoint. Once `ACCEPTED`, the
Tutor books each class through the existing
`POST /classes/tutor/create` endpoint
(`class.controller.tutorCreateClass`, `server/src/modules/classes/class.routes.ts:21`),
passing the three new optional fields
(`courseRequestPublicId`, `coursePublicId`, `courseTopicPublicId`) alongside
the existing payload. `class.service.ts`'s create path increments
`CourseRequest.classesScheduledCount` when those fields are present. This is
the reuse decision from the brainstorming approval (Approach A) — no
duplicate slot-booking logic.

## 5. Credits / refund semantics

- **Charge**: full `classesRequired × costCentsPerClass` debited at Accept
  time (§4), before any class is scheduled. This matches "system charges
  the student credits" from the original ask — the Student is committing to
  the whole series up front, not paying per class.
- **Per-class cancellation**: unchanged — goes through the existing
  `POST /classes/:classId/cancel` → `class.controller.refundClass`
  (`class.routes.ts:49`) path. That refund is for a single scheduled class,
  same as today.
- **Series cancellation** (`POST /course-requests/:id/cancel`, before all N
  classes are scheduled/completed): refund
  `(classesRequired - classesCompletedCount - classesScheduledCount-in-flight) × costCentsPerClass`
  via `walletService.refundWallet()`. Classes already completed are not
  refunded. Classes already scheduled-but-not-yet-run are cancelled (reusing
  `refundClass` per class) as part of this action, so their credits flow back
  through the existing single-class path and are not double-refunded here —
  the CourseRequest-level refund only covers the *never-scheduled* remainder.

## 6. UI flow per role

### Admin / SuperAdmin
- New sidebar item **Curriculum** (`/dashboard/admin/curriculum`,
  `/dashboard/super-admin/curriculum`).
- Course list (filter by county/grade/subject, published/unpublished) →
  Course editor: title/description/county/grade/subject, ordered Topic
  builder (add/reorder/delete topic; per-topic attach existing
  Resources/Assignments/Worksheets via existing pickers) → Publish/Unpublish toggle.

### Student
- New sidebar item **Courses** (`/dashboard/student/courses`): catalog
  auto-filtered to the Student's own county+grade (set via profile; prompt
  to set it if missing). Course card → detail page showing ordered topics
  and their attached content previews → multi-select topics → "Request
  Course" CTA → pick a Tutor (reuses existing Tutor browse/profile flow) →
  set availability window (days + local time range) → submit.
- New page **My Course Requests** (`/dashboard/student/course-requests`):
  list with status (Pending/Accepted/Rejected/Cancelled/Completed), and once
  Accepted, progress `classesCompletedCount / classesRequired`.

### Tutor
- New sidebar item **Course Requests**, parallel to existing Demo Requests
  (`/dashboard/tutor/course-requests`), same list/detail/badge pattern as
  `TutorPage` Demo Requests nav item.
- Request detail: Student, Course + selected topics, availability window →
  Accept (enter `classesRequired`) or Reject (reason).
- After Accept: request detail becomes a scheduling workspace — shows
  `classesScheduledCount / classesRequired`, "Schedule next class" button
  opens the existing `TutorCreateClassPage` flow pre-filled with
  `studentPublicId`, `courseRequestPublicId`, and a Topic picker limited to
  `selectedTopicPublicIds`, constrained to the Student's stated availability
  window.

### Principal
No new UI. Principal's existing `/teach/*` routes reuse Tutor pages
(`routes/index.tsx:228` comment: "Principal teaching reuses tutor pages") —
Course Requests appears there automatically once Tutor pages are extended,
with no separate work.

## 7. Non-goals (explicitly out of scope per brainstorming answers)

- No Tutor- or Principal-authored courses.
- No group/batch classes — one CourseRequest is always exactly one
  Student + one Tutor.
- No fixed recurrence engine (no "every Tue/Thu at 5pm" auto-generation) —
  each of the N classes is booked individually by the Tutor.
- No auto-sequencing of Topics to class number — content-per-class stays a
  manual Tutor choice.

## 8. Testing plan

- Unit: `course.service.ts` CRUD + publish gating; `course-request.service.ts`
  accept/reject/cancel state transitions and wallet debit/refund amounts.
- Integration (mirrors existing `server/src/tests/modules/class.money.test.ts`
  pattern): full flow — Student submits request → Tutor accepts with
  `classesRequired=4` → assert wallet debited `4 × rate` → Tutor schedules 2
  of 4 → Student cancels series → assert refund equals `2 × rate` (the
  2 never-scheduled classes only).
- Frontend: catalog filter by county/grade, topic multi-select, availability
  window form validation, Tutor accept form (classesRequired input),
  progress indicator math.
