# Skill Programs (1:1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tutors publish extracurricular Skill Programs; students enroll and pay up front; tutors schedule 1:1 sessions per module; students, parents, tutors and admins follow progress.

**Architecture:** New `programs` module (`Program`, `ProgramEnrollment`). Sessions are ordinary `ScheduledClass` records with a new `PROGRAM_PREPAID` billing mode, handled by the existing prepaid-course branches in `class.service.ts` via an `isPrepaid()` helper. The course availability-window check is extracted to a shared helper. The frontend adds tutor, student, parent and admin pages and reuses `CourseStructureTree` for the enrollment view.

**Tech Stack:** Express + Mongoose + Zod + Jest/supertest; React + TanStack Query + Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-25-skill-programs-design.md`

## Global Constraints

- Categories: `ARTS, MUSIC, GAMES, CODING, AI_DATA, LANGUAGES, LIFE_SKILLS, OTHER`; levels `BEGINNER, INTERMEDIATE, ADVANCED`; program status `DRAFT, PUBLISHED, ARCHIVED`; enrollment status `ACTIVE, COMPLETED, CANCELLED`.
- Limits: title ≤ 120, description ≤ 4000, module title ≤ 200, module description ≤ 1000, ages 3–99 with `ageMin ≤ ageMax`, `sessionCount` 1–100, `sessionMinutes` 15–240 (default 60), `priceCents ≥ 0`, `maxEnrollees ≥ 1` optional, ≥ 1 module.
- After any enrollment exists: `sessionCount`, `priceCents` and module removal are locked (409); `maxEnrollees` may not drop below `activeEnrollmentCount`.
- Enroll: atomic seat reservation on `activeEnrollmentCount`; one `ACTIVE` enrollment per student per program; full price debited on enroll.
- Per-session cost: `share = floor(price / n)`; session n costs `price − share × (n − 1)`.
- Session length ≤ `sessionMinutes + 15`; inside the student's availability window; module required and from the program.
- Cancel: future sessions cancelled (each refunds its cost); never-booked remainder `price − Σ booked costCents` refunded; seat released. Completion of the last session → `COMPLETED`, seat released.
- Persisted wallet strings: `referenceType 'PROGRAM_ENROLL'` / idempotency `program-enroll-${enrollmentPublicId}`; `referenceType 'PROGRAM_CANCEL'` / `program-cancel-${enrollmentPublicId}`.
- Access failures → 404; bad bodies → 422 (zod `validate`).
- UI names: tutor/admin sidebar **Skill Programs**, student sidebar **Skills**.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Two students enrolling on the last seat at once: exactly one succeeds; the other gets 409 and is not charged. — Task 3 test.
2. A student with insufficient credit: enroll fails with 402 and the seat is released. — Task 3 test.
3. Two sessions booked concurrently: the per-session costs still sum to the price and never exceed `sessionCount`. — Task 3 test (cost taken from the post-increment count).
4. A tutor editing price after students paid: rejected, so paid enrollments keep their terms. — Task 2 test.
5. Completing the last session frees the seat so a full program re-opens. — Task 1 test.

---

## File Structure

Server:
- Create `src/shared/availability.ts` — availability-window check (moved from course.service).
- Create `src/modules/programs/program.types.ts`, `program.model.ts`, `program.validators.ts`, `program.service.ts`, `program-enrollment.service.ts`, `program.controller.ts`, `program.routes.ts`.
- Modify `src/modules/schedules/schedule.types.ts`, `schedule.model.ts` (billing mode + fields), `src/modules/classes/class.service.ts` (`isPrepaid`, program progress), `src/modules/courses/course.service.ts` (use shared helper), `src/constants/events.ts`, `src/app.ts`, `src/modules/notifications/notification.service.ts`.
- Tests: `src/tests/modules/availability.test.ts`, `program.billing.test.ts`, `program.service.test.ts`, `program.enrollment.test.ts`, `program.routes.test.ts`.

Frontend:
- Create `src/constants/programs.ts`, `src/services/programs.service.ts`, `src/hooks/use-programs.ts`, `src/features/programs/ProgramForm.tsx`, `ProgramCard.tsx`, `ProgramEnrollmentView.tsx`, `MyProgramsSection.tsx`, pages `tutor/TutorProgramsPage.tsx`, `tutor/TutorProgramPage.tsx`, `tutor/TutorProgramEnrollmentPage.tsx`, `student/StudentSkillsPage.tsx`, `student/StudentProgramPage.tsx`, `student/StudentProgramEnrollmentPage.tsx`, `parent/ParentProgramEnrollmentPage.tsx`, `admin/AdminProgramsPage.tsx`.
- Modify `features/courses/CourseStructureTree.tsx` (`hideMaterials`), `pages/dashboards/StudentDashboard.tsx`, `pages/parent/ParentCoursesPage.tsx`, `routes/index.tsx`, `components/shared/Sidebar.tsx`.

---

### Task 1: Shared availability check + `PROGRAM_PREPAID` billing

**Files:**
- Create: `server/src/shared/availability.ts`
- Modify: `server/src/modules/courses/course.service.ts`, `server/src/modules/schedules/schedule.types.ts`, `schedule.model.ts`, `server/src/modules/classes/class.service.ts`, `server/src/constants/events.ts`
- Create (model only, service in Task 3): `server/src/modules/programs/program.types.ts`, `program.model.ts`
- Test: `server/src/tests/modules/availability.test.ts`, `server/src/tests/modules/program.billing.test.ts`

**Interfaces:**
- Produces:
  - `isWithinAvailability(window: { daysOfWeek: number[]; startLocalTime: string; endLocalTime: string; ianaTimezone: string }, start: Date, end: Date): boolean`
  - `BillingMode.PROGRAM_PREPAID`; `isPrepaid(mode: BillingMode): boolean` exported from `schedule.types.ts`
  - ScheduledClass fields `programEnrollmentPublicId?`, `programPublicId?`, `programModulePublicId?`
  - Types/models: `ProgramModel`, `ProgramEnrollmentModel`, `IProgram`, `IProgramModule`, `IProgramEnrollment`, consts `ProgramCategory`, `ProgramLevel`, `ProgramStatus`, `EnrollmentStatus`
  - Events `PROGRAM_ENROLLED`, `PROGRAM_SESSION_SCHEDULED`, `PROGRAM_ENROLLMENT_CANCELLED`, `PROGRAM_ENROLLMENT_COMPLETED`

- [ ] **Step 1: Write the failing tests**

```ts
// server/src/tests/modules/availability.test.ts
import { isWithinAvailability } from '../../shared/availability';

const window = { daysOfWeek: [1, 2, 3], startLocalTime: '16:00', endLocalTime: '19:00', ianaTimezone: 'UTC' };

describe('isWithinAvailability', () => {
  it('accepts a slot inside the window on an allowed day', () => {
    // 2026-09-28 is a Monday
    expect(isWithinAvailability(window, new Date('2026-09-28T16:30:00Z'), new Date('2026-09-28T17:30:00Z'))).toBe(true);
  });

  it('rejects a disallowed day, an early start, and an end past the window', () => {
    expect(isWithinAvailability(window, new Date('2026-09-27T16:30:00Z'), new Date('2026-09-27T17:00:00Z'))).toBe(false); // Sunday
    expect(isWithinAvailability(window, new Date('2026-09-28T15:30:00Z'), new Date('2026-09-28T16:30:00Z'))).toBe(false);
    expect(isWithinAvailability(window, new Date('2026-09-28T18:30:00Z'), new Date('2026-09-28T19:30:00Z'))).toBe(false);
  });

  it('evaluates in the window\'s timezone', () => {
    const ny = { ...window, ianaTimezone: 'America/New_York' };
    // 20:30Z = 16:30 in New York (EDT)
    expect(isWithinAvailability(ny, new Date('2026-09-28T20:30:00Z'), new Date('2026-09-28T21:30:00Z'))).toBe(true);
  });
});
```

```ts
// server/src/tests/modules/program.billing.test.ts
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ProgramEnrollmentModel, ProgramModel } from '../../modules/programs/program.model';
import { walletService } from '../../modules/wallets/wallet.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { domainEvents } from '../../events/event-emitter';
import { isPrepaid, BillingMode } from '../../modules/schedules/schedule.types';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('PROGRAM_PREPAID billing', () => {
  afterEach(() => jest.restoreAllMocks());

  it('isPrepaid covers course and program modes only', () => {
    expect(isPrepaid(BillingMode.COURSE_PREPAID)).toBe(true);
    expect(isPrepaid(BillingMode.PROGRAM_PREPAID)).toBe(true);
    expect(isPrepaid(BillingMode.STUDENT_REQUESTED)).toBe(false);
  });

  it('refunds a cancelled program session\'s cost to the student', async () => {
    const cls = {
      publicId: 'k-1', tutorPublicId: 'tp-1', studentPublicId: 'sp-1', status: 'SCHEDULED', title: 'Chess 1',
      costCents: 1500, billingMode: 'PROGRAM_PREPAID', programEnrollmentPublicId: 'e-1', startUTC: new Date(Date.now() + 86400000),
    };
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...cls, status: 'CANCELLED' }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1', userPublicId: 'su-1' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-1', userPublicId: 'tu-1' }) as never);
    jest.spyOn(tutorService, 'recordClassCancelled').mockResolvedValue(undefined as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    const refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
    const fee = jest.spyOn(walletService, 'debitWallet');

    await classService.cancelClass('k-1', 'tu-1', { reason: 'x' }).catch(() => undefined);

    expect(refund).toHaveBeenCalledWith(expect.objectContaining({ ownerPublicId: 'su-1', amountCents: 1500 }));
    expect(fee).not.toHaveBeenCalled(); // prepaid modes skip the cancellation fee
  });

  it('completing the last session completes the enrollment and frees the seat', async () => {
    const incEnrollment = jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate')
      .mockReturnValueOnce(lean({ publicId: 'e-1', programPublicId: 'p-1', status: 'ACTIVE', sessionCount: 2, sessionsCompletedCount: 2 }) as never)
      .mockReturnValueOnce(lean({ publicId: 'e-1', status: 'COMPLETED' }) as never);
    const seat = jest.spyOn(ProgramModel, 'updateOne').mockResolvedValue({} as never);
    const emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

    await classService.recordProgramSessionCompleted('e-1');

    expect(incEnrollment).toHaveBeenNthCalledWith(1, { publicId: 'e-1' }, { $inc: { sessionsCompletedCount: 1 } }, { new: true });
    expect(incEnrollment).toHaveBeenNthCalledWith(2, { publicId: 'e-1', status: 'ACTIVE' }, { $set: { status: 'COMPLETED' } }, { new: true });
    expect(seat).toHaveBeenCalledWith({ publicId: 'p-1' }, { $inc: { activeEnrollmentCount: -1 } });
    expect(emit).toHaveBeenCalledWith('PROGRAM_ENROLLMENT_COMPLETED', { enrollmentPublicId: 'e-1' });
  });
});
```

(The cancel test exercises `cancelClass`'s prepaid refund branch; if `cancelClass` needs more mocks in its happy path — e.g. an actor profile lookup — add them following `class.cancellation.test.ts`, which already cancels a `COURSE_PREPAID` class.)

- [ ] **Step 2: Run to verify failure** — `npx jest src/tests/modules/availability src/tests/modules/program.billing` → FAIL (modules missing).

- [ ] **Step 3: Shared availability helper**

```ts
// server/src/shared/availability.ts
export interface AvailabilityWindow {
  daysOfWeek: number[]; // 0 (Sun) – 6 (Sat)
  startLocalTime: string; // "16:00"
  endLocalTime: string; // "19:00"
  ianaTimezone: string;
}

/** Minutes since local midnight and weekday of `at` in `ianaTimezone`. */
function localMinutesOfDay(at: Date, ianaTimezone: string): { minutes: number; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { minutes: hour * 60 + minute, dayOfWeek: dayMap[weekday] ?? 0 };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** True when [start, end] falls on an allowed weekday inside the window, in its timezone. */
export function isWithinAvailability(window: AvailabilityWindow, start: Date, end: Date): boolean {
  const { minutes: startMinutes, dayOfWeek } = localMinutesOfDay(start, window.ianaTimezone);
  const { minutes: endMinutes } = localMinutesOfDay(end, window.ianaTimezone);
  const windowStart = toMinutes(window.startLocalTime);
  const windowEnd = toMinutes(window.endLocalTime);
  return window.daysOfWeek.includes(dayOfWeek) && startMinutes >= windowStart && startMinutes <= windowEnd && endMinutes <= windowEnd;
}
```

In `course.service.ts`: delete `localMinutesOfDay` and `timeStringToMinutes`; in `scheduleClass` replace the block from `const { minutes: startMinutes, dayOfWeek } = …` through `const inWindow = …;` with `const inWindow = isWithinAvailability(request.availabilityWindow, start, end);` and import it from `'../../shared/availability'`.

- [ ] **Step 4: Billing mode, class fields, events**

`schedule.types.ts`: add `PROGRAM_PREPAID: 'PROGRAM_PREPAID',` to `BillingMode` (extend the doc comment: "PROGRAM_PREPAID: student paid a Skill Program up front — same rules as COURSE_PREPAID."), and after it:

```ts
/** Paid up front in bulk (course or skill program): no per-class charge; cancelled classes are refunded. */
export const isPrepaid = (mode: BillingMode | string): boolean =>
  mode === BillingMode.COURSE_PREPAID || mode === BillingMode.PROGRAM_PREPAID;
```

Add to `IScheduledClass`: `programEnrollmentPublicId?: string; programPublicId?: string; programModulePublicId?: string;` and to the schema after `topicPublicId`:

```ts
    programEnrollmentPublicId: { type: String, index: true },
    programPublicId: { type: String },
    programModulePublicId: { type: String },
```

`constants/events.ts` (after `COURSE_CLASS_SCHEDULED`):

```ts
  // ─── Skill Programs ─────────────────────────────────────────
  PROGRAM_ENROLLED: 'PROGRAM_ENROLLED',
  PROGRAM_SESSION_SCHEDULED: 'PROGRAM_SESSION_SCHEDULED',
  PROGRAM_ENROLLMENT_CANCELLED: 'PROGRAM_ENROLLMENT_CANCELLED',
  PROGRAM_ENROLLMENT_COMPLETED: 'PROGRAM_ENROLLMENT_COMPLETED',
```

- [ ] **Step 5: Program types + models**

```ts
// server/src/modules/programs/program.types.ts
import type { AvailabilityWindow } from '../../shared/availability';

export const ProgramCategory = {
  ARTS: 'ARTS', MUSIC: 'MUSIC', GAMES: 'GAMES', CODING: 'CODING',
  AI_DATA: 'AI_DATA', LANGUAGES: 'LANGUAGES', LIFE_SKILLS: 'LIFE_SKILLS', OTHER: 'OTHER',
} as const;
export type ProgramCategory = (typeof ProgramCategory)[keyof typeof ProgramCategory];

export const ProgramLevel = { BEGINNER: 'BEGINNER', INTERMEDIATE: 'INTERMEDIATE', ADVANCED: 'ADVANCED' } as const;
export type ProgramLevel = (typeof ProgramLevel)[keyof typeof ProgramLevel];

export const ProgramStatus = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' } as const;
export type ProgramStatus = (typeof ProgramStatus)[keyof typeof ProgramStatus];

export const EnrollmentStatus = { ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' } as const;
export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

export interface IProgramModule {
  publicId: string;
  title: string;
  description?: string;
  order: number;
}

export interface IProgram {
  _id: string;
  publicId: string;
  tutorPublicId: string;
  title: string;
  category: ProgramCategory;
  description?: string;
  level: ProgramLevel;
  ageMin?: number;
  ageMax?: number;
  sessionCount: number;
  sessionMinutes: number;
  priceCents: number;
  maxEnrollees?: number;
  activeEnrollmentCount: number;
  modules: IProgramModule[];
  status: ProgramStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProgramEnrollment {
  _id: string;
  publicId: string;
  programPublicId: string;
  tutorPublicId: string;
  studentPublicId: string;
  availabilityWindow: AvailabilityWindow;
  sessionCount: number;
  priceCentsPaid: number;
  sessionsScheduledCount: number;
  sessionsCompletedCount: number;
  status: EnrollmentStatus;
  cancelledBy?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

```ts
// server/src/modules/programs/program.model.ts
import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ProgramCategory, ProgramLevel, ProgramStatus, EnrollmentStatus } from './program.types';
import type { IProgram, IProgramModule, IProgramEnrollment } from './program.types';

const moduleSchema = new Schema<IProgramModule>(
  {
    publicId: { type: String, default: uuidv4 },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    order: { type: Number, required: true },
  },
  { _id: false },
);

const programSchema = new Schema<IProgram>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    category: { type: String, enum: Object.values(ProgramCategory), required: true },
    description: { type: String, maxlength: 4000 },
    level: { type: String, enum: Object.values(ProgramLevel), required: true },
    ageMin: { type: Number, min: 3, max: 99 },
    ageMax: { type: Number, min: 3, max: 99 },
    sessionCount: { type: Number, required: true, min: 1, max: 100 },
    sessionMinutes: { type: Number, required: true, min: 15, max: 240, default: 60 },
    priceCents: { type: Number, required: true, min: 0 },
    maxEnrollees: { type: Number, min: 1 },
    activeEnrollmentCount: { type: Number, default: 0, min: 0 },
    modules: { type: [moduleSchema], default: [] },
    status: { type: String, enum: Object.values(ProgramStatus), default: ProgramStatus.DRAFT, index: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);
programSchema.index({ status: 1, category: 1, level: 1 });
programSchema.index({ tutorPublicId: 1, createdAt: -1 });

const availabilitySchema = new Schema(
  {
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    startLocalTime: { type: String, required: true },
    endLocalTime: { type: String, required: true },
    ianaTimezone: { type: String, required: true },
  },
  { _id: false },
);

const enrollmentSchema = new Schema<IProgramEnrollment>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    programPublicId: { type: String, required: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    studentPublicId: { type: String, required: true, index: true },
    availabilityWindow: { type: availabilitySchema, required: true },
    sessionCount: { type: Number, required: true, min: 1 },
    priceCentsPaid: { type: Number, required: true, min: 0 },
    sessionsScheduledCount: { type: Number, default: 0, min: 0 },
    sessionsCompletedCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: Object.values(EnrollmentStatus), default: EnrollmentStatus.ACTIVE, index: true },
    cancelledBy: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);
// One ACTIVE enrollment per student per program.
enrollmentSchema.index(
  { programPublicId: 1, studentPublicId: 1 },
  { unique: true, partialFilterExpression: { status: EnrollmentStatus.ACTIVE } },
);

export const ProgramModel = mongoose.model<IProgram>('Program', programSchema);
export const ProgramEnrollmentModel = mongoose.model<IProgramEnrollment>('ProgramEnrollment', enrollmentSchema);
```

- [ ] **Step 6: `class.service.ts`** — import `isPrepaid` from `'../schedules/schedule.types'`; replace:
  - `} else if (scheduled.billingMode === BillingMode.COURSE_PREPAID) {` (completeClass) → `} else if (isPrepaid(scheduled.billingMode)) {`
  - `if (scheduled.billingMode === BillingMode.COURSE_PREPAID && scheduled.costCents > 0) {` (cancelClass refund) → `if (isPrepaid(scheduled.billingMode) && scheduled.costCents > 0) {`
  - `if (scheduled.billingMode !== BillingMode.COURSE_PREPAID) {` (cancellation fee) → `if (!isPrepaid(scheduled.billingMode)) {`
  - `} else if (scheduled.billingMode === BillingMode.COURSE_PREPAID && scheduled.costCents > 0 && studentAttended) {` (auto-resolution refund) → `} else if (isPrepaid(scheduled.billingMode) && scheduled.costCents > 0 && studentAttended) {`

  Inside the completeClass prepaid branch, after the existing `if (scheduled.coursePublicId) { … }` block add:

```ts
      if (scheduled.programEnrollmentPublicId) {
        try {
          await this.recordProgramSessionCompleted(scheduled.programEnrollmentPublicId);
        } catch (error) {
          logger.warn('Could not update program enrollment progress', {
            classPublicId,
            enrollmentPublicId: scheduled.programEnrollmentPublicId,
            error: (error as Error).message,
          });
        }
      }
```

  and add the method on `ClassService`:

```ts
  /** One more program session done; completes the enrollment (and frees its seat) on the last one. */
  async recordProgramSessionCompleted(enrollmentPublicId: string): Promise<void> {
    // Dynamic import avoids a static cycle: programs/ imports class.service for cancellations.
    const { ProgramEnrollmentModel, ProgramModel } = await import('../programs/program.model');
    const updated = await ProgramEnrollmentModel.findOneAndUpdate(
      { publicId: enrollmentPublicId },
      { $inc: { sessionsCompletedCount: 1 } },
      { new: true },
    ).lean();
    if (!updated || updated.status !== 'ACTIVE' || updated.sessionsCompletedCount < updated.sessionCount) return;
    const completed = await ProgramEnrollmentModel.findOneAndUpdate(
      { publicId: enrollmentPublicId, status: 'ACTIVE' },
      { $set: { status: 'COMPLETED' } },
      { new: true },
    ).lean();
    if (!completed) return; // someone else completed/cancelled it first
    await ProgramModel.updateOne({ publicId: updated.programPublicId }, { $inc: { activeEnrollmentCount: -1 } });
    domainEvents.emit(DomainEvent.PROGRAM_ENROLLMENT_COMPLETED, { enrollmentPublicId });
  }
```

  Also change the prepaid cancel refund description from ``Refund (course class cancelled): ${scheduled.title}`` to ``Refund (prepaid class cancelled): ${scheduled.title}`` — the idempotency key and referenceType stay unchanged (persisted).

- [ ] **Step 7: Verify** — `npx jest src/tests/modules/availability src/tests/modules/program.billing src/tests/modules/course src/tests/modules/class --runInBand && npx tsc --noEmit -p .` → pass, clean.

- [ ] **Step 8: Commit** — `git add server/src && git commit -m "feat: program models, shared availability check, PROGRAM_PREPAID billing"`

---

### Task 2: Program CRUD, catalog, admin

**Files:**
- Create: `server/src/modules/programs/program.validators.ts`, `program.service.ts`
- Test: `server/src/tests/modules/program.service.test.ts`

**Interfaces:**
- Consumes: Task 1 models/types.
- Produces:
  - validators: `createProgramSchema`, `updateProgramSchema`, `programCatalogQuerySchema`, `enrollSchema`, `scheduleSessionSchema`; DTO types `CreateProgramDto`, `UpdateProgramDto`, `ProgramCatalogQuery`, `EnrollDto`, `ScheduleSessionDto`.
  - `programService`: `create(tutorPublicId: string, dto: CreateProgramDto): Promise<IProgram>`, `update(tutorPublicId, programPublicId, dto: UpdateProgramDto)`, `setStatus(tutorPublicId, programPublicId, status: 'PUBLISHED' | 'ARCHIVED')`, `remove(tutorPublicId, programPublicId)`, `listMine(tutorPublicId)`, `getForViewer(programPublicId, viewer: { role: string; tutorPublicId?: string }): Promise<ProgramView>`, `catalog(query): Promise<PaginatedResult<ProgramView>>`, `adminList(query)`, `unpublish(programPublicId)`; `ProgramView = IProgram & { tutorName: string; isFull: boolean }`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/modules/program.service.test.ts
import { programService } from '../../modules/programs/program.service';
import { ProgramModel, ProgramEnrollmentModel } from '../../modules/programs/program.model';
import { createProgramSchema, programCatalogQuerySchema } from '../../modules/programs/program.validators';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { UserModel } from '../../modules/users/user.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const base = {
  title: 'Chess for Beginners', category: 'GAMES', level: 'BEGINNER', sessionCount: 8, priceCents: 12000,
  modules: [{ title: 'Openings' }, { title: 'Tactics' }],
};
const existing = {
  publicId: 'p-1', tutorPublicId: 'tp-1', status: 'PUBLISHED', sessionCount: 8, priceCents: 12000, activeEnrollmentCount: 2,
  modules: [{ publicId: 'm-1', title: 'Openings', order: 0 }, { publicId: 'm-2', title: 'Tactics', order: 1 }], isDeleted: false,
};

describe('program validators', () => {
  it('require at least one module and a sane age range', () => {
    expect(createProgramSchema.safeParse(base).success).toBe(true);
    expect(createProgramSchema.safeParse({ ...base, modules: [] }).success).toBe(false);
    expect(createProgramSchema.safeParse({ ...base, ageMin: 12, ageMax: 8 }).success).toBe(false);
    expect(createProgramSchema.safeParse({ ...base, category: 'MATHS' }).success).toBe(false);
  });

  it('catalog query coerces age and page', () => {
    expect(programCatalogQuerySchema.parse({ age: '10', page: '2' })).toEqual(expect.objectContaining({ age: 10, page: 2 }));
  });
});

describe('programService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('create stores a draft with ordered modules and no enrollments', async () => {
    const create = jest.spyOn(ProgramModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await programService.create('tp-1', createProgramSchema.parse(base));
    const arg = (create.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(arg).toEqual(expect.objectContaining({ tutorPublicId: 'tp-1', status: 'DRAFT', activeEnrollmentCount: 0, sessionMinutes: 60 }));
    expect((arg.modules as Array<{ order: number; publicId: string }>).map((m) => m.order)).toEqual([0, 1]);
    expect((arg.modules as Array<{ publicId: string }>)[0].publicId).toEqual(expect.any(String));
  });

  it('locks price, session count and module removal once anyone has enrolled', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(existing) as never);
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    await expect(programService.update('tp-1', 'p-1', { priceCents: 9000 })).rejects.toMatchObject({ statusCode: 409 });
    await expect(programService.update('tp-1', 'p-1', { sessionCount: 10 })).rejects.toMatchObject({ statusCode: 409 });
    await expect(programService.update('tp-1', 'p-1', { modules: [{ publicId: 'm-1', title: 'Openings' }] })).rejects.toMatchObject({ statusCode: 409 });
    await expect(programService.update('tp-1', 'p-1', { maxEnrollees: 1 })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows title edits and adding modules after enrollments, keeping module ids', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(existing) as never);
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    const upd = jest.spyOn(ProgramModel, 'findOneAndUpdate').mockReturnValue(lean(existing) as never);
    await programService.update('tp-1', 'p-1', {
      title: 'Chess 101',
      modules: [{ publicId: 'm-1', title: 'Openings' }, { publicId: 'm-2', title: 'Tactics' }, { title: 'Endgames' }],
    });
    const set = ((upd.mock.calls[0] as unknown as [unknown, { $set: Record<string, unknown> }])[1]).$set;
    expect(set.title).toBe('Chess 101');
    expect((set.modules as Array<{ publicId: string; order: number }>).map((m) => [m.publicId === 'm-1' || m.publicId === 'm-2' ? m.publicId : 'new', m.order]))
      .toEqual([['m-1', 0], ['m-2', 1], ['new', 2]]);
  });

  it('another tutor cannot edit (404)', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(programService.update('tp-9', 'p-1', { title: 'x' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('delete is refused once anyone has enrolled', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(existing) as never);
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    await expect(programService.remove('tp-1', 'p-1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('catalog lists only published programs and applies filters', async () => {
    const find = jest.spyOn(ProgramModel, 'find').mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => lean([]) }) }) } as never);
    jest.spyOn(ProgramModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(TutorProfileModel, 'find').mockReturnValue(lean([]) as never);
    jest.spyOn(UserModel, 'find').mockReturnValue(lean([]) as never);
    await programService.catalog({ category: 'GAMES', level: 'BEGINNER', age: 10, q: 'che(ss' });
    const filter = (find.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(filter).toEqual(expect.objectContaining({ status: 'PUBLISHED', isDeleted: false, category: 'GAMES', level: 'BEGINNER' }));
    expect(filter.$and).toEqual([
      { $or: [{ ageMin: { $exists: false } }, { ageMin: { $lte: 10 } }] },
      { $or: [{ ageMax: { $exists: false } }, { ageMax: { $gte: 10 } }] },
    ]);
    expect((filter.title as RegExp).test('Chess (Beginners) che(ss')).toBe(true);
  });

  it('drafts are visible only to their tutor and admins', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean({ ...existing, status: 'DRAFT' }) as never);
    jest.spyOn(TutorProfileModel, 'find').mockReturnValue(lean([]) as never);
    jest.spyOn(UserModel, 'find').mockReturnValue(lean([]) as never);
    await expect(programService.getForViewer('p-1', { role: 'STUDENT' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(programService.getForViewer('p-1', { role: 'TUTOR', tutorPublicId: 'tp-1' })).resolves.toMatchObject({ publicId: 'p-1' });
    await expect(programService.getForViewer('p-1', { role: 'ADMIN' })).resolves.toMatchObject({ publicId: 'p-1' });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/tests/modules/program.service` → FAIL (modules missing).

- [ ] **Step 3: Validators**

```ts
// server/src/modules/programs/program.validators.ts
import { z } from 'zod';
import { ProgramCategory, ProgramLevel } from './program.types';

const moduleInput = z.object({
  publicId: z.string().min(1).optional(), // present when editing an existing module
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

const programFields = {
  title: z.string().min(1).max(120),
  category: z.enum(Object.values(ProgramCategory) as [string, ...string[]]),
  description: z.string().max(4000).optional(),
  level: z.enum(Object.values(ProgramLevel) as [string, ...string[]]),
  ageMin: z.number().int().min(3).max(99).optional(),
  ageMax: z.number().int().min(3).max(99).optional(),
  sessionCount: z.number().int().min(1).max(100),
  sessionMinutes: z.number().int().min(15).max(240).default(60),
  priceCents: z.number().int().min(0),
  maxEnrollees: z.number().int().min(1).optional(),
  modules: z.array(moduleInput).min(1, 'Add at least one module'),
};

const ageOrder = (d: { ageMin?: number; ageMax?: number }) => d.ageMin === undefined || d.ageMax === undefined || d.ageMin <= d.ageMax;
const AGE_MSG = { message: 'Minimum age must not exceed maximum age', path: ['ageMax'] };

export const createProgramSchema = z.object(programFields).refine(ageOrder, AGE_MSG);
export const updateProgramSchema = z
  .object({ ...programFields, sessionMinutes: z.number().int().min(15).max(240) })
  .partial()
  .refine(ageOrder, AGE_MSG);

export const programCatalogQuerySchema = z.object({
  category: z.enum(Object.values(ProgramCategory) as [string, ...string[]]).optional(),
  level: z.enum(Object.values(ProgramLevel) as [string, ...string[]]).optional(),
  age: z.coerce.number().int().min(3).max(99).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const enrollSchema = z.object({
  availabilityWindow: z.object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    startLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
    endLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
    ianaTimezone: z.string().min(1),
  }),
});

export const scheduleSessionSchema = z.object({
  startUTC: z.string().datetime(),
  endUTC: z.string().datetime(),
  title: z.string().min(1).max(200),
  programModulePublicId: z.string().min(1, 'Select the module this session covers'),
});

export type CreateProgramDto = z.infer<typeof createProgramSchema>;
export type UpdateProgramDto = z.infer<typeof updateProgramSchema>;
export type ProgramCatalogQuery = z.infer<typeof programCatalogQuerySchema>;
export type EnrollDto = z.infer<typeof enrollSchema>;
export type ScheduleSessionDto = z.infer<typeof scheduleSessionSchema>;
```

- [ ] **Step 4: Service**

```ts
// server/src/modules/programs/program.service.ts
import { v4 as uuidv4 } from 'uuid';
import { ProgramModel, ProgramEnrollmentModel } from './program.model';
import { ProgramStatus } from './program.types';
import type { IProgram, IProgramModule } from './program.types';
import type { CreateProgramDto, UpdateProgramDto, ProgramCatalogQuery } from './program.validators';
import { TutorProfileModel } from '../tutors/tutor.model';
import { UserModel } from '../users/user.model';
import { ConflictError, NotFoundError } from '../../utils/error';
import type { PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export type ProgramView = IProgram & { tutorName: string; isFull: boolean };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toModules = (input: Array<{ publicId?: string; title: string; description?: string }>): IProgramModule[] =>
  input.map((m, i) => ({ publicId: m.publicId ?? uuidv4(), title: m.title, description: m.description, order: i }));

async function withTutorNames(programs: IProgram[]): Promise<ProgramView[]> {
  const tutorIds = [...new Set(programs.map((p) => p.tutorPublicId))];
  const tutors = tutorIds.length ? await TutorProfileModel.find({ publicId: { $in: tutorIds } }, { publicId: 1, userPublicId: 1 }).lean() : [];
  const users = tutors.length
    ? await UserModel.find({ publicId: { $in: tutors.map((t) => t.userPublicId) } }, { publicId: 1, firstName: 1, lastName: 1 }).lean()
    : [];
  const nameByUser = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));
  const nameByTutor = new Map(tutors.map((t) => [t.publicId, nameByUser.get(t.userPublicId) ?? 'Tutor']));
  return programs.map((p) => ({
    ...p,
    tutorName: nameByTutor.get(p.tutorPublicId) ?? 'Tutor',
    isFull: p.maxEnrollees !== undefined && p.activeEnrollmentCount >= p.maxEnrollees,
  }));
}

export class ProgramService {
  async create(tutorPublicId: string, dto: CreateProgramDto): Promise<IProgram> {
    const created = await ProgramModel.create({
      publicId: uuidv4(),
      tutorPublicId,
      title: dto.title,
      category: dto.category,
      description: dto.description,
      level: dto.level,
      ageMin: dto.ageMin,
      ageMax: dto.ageMax,
      sessionCount: dto.sessionCount,
      sessionMinutes: dto.sessionMinutes,
      priceCents: dto.priceCents,
      maxEnrollees: dto.maxEnrollees,
      activeEnrollmentCount: 0,
      modules: toModules(dto.modules),
      status: ProgramStatus.DRAFT,
      isDeleted: false,
    });
    return created.toObject();
  }

  private async _owned(tutorPublicId: string, programPublicId: string): Promise<IProgram> {
    const program = await ProgramModel.findOne({ publicId: programPublicId, tutorPublicId, isDeleted: false }).lean();
    if (!program) throw new NotFoundError('Program');
    return program;
  }

  async update(tutorPublicId: string, programPublicId: string, dto: UpdateProgramDto): Promise<IProgram> {
    const program = await this._owned(tutorPublicId, programPublicId);
    const hasEnrollments = !!(await ProgramEnrollmentModel.exists({ programPublicId }));

    if (hasEnrollments) {
      // Students have paid for these terms.
      if (dto.priceCents !== undefined && dto.priceCents !== program.priceCents) throw new ConflictError('Price is locked once students have enrolled');
      if (dto.sessionCount !== undefined && dto.sessionCount !== program.sessionCount) throw new ConflictError('Session count is locked once students have enrolled');
      if (dto.modules) {
        const kept = new Set(dto.modules.flatMap((m) => (m.publicId ? [m.publicId] : [])));
        if (program.modules.some((m) => !kept.has(m.publicId))) throw new ConflictError('Modules can only be added once students have enrolled');
      }
    }
    if (dto.maxEnrollees !== undefined && dto.maxEnrollees < program.activeEnrollmentCount) {
      throw new ConflictError(`Max enrollees cannot be below the ${program.activeEnrollmentCount} active students`);
    }

    const { modules, ...rest } = dto;
    const $set: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    if (modules) $set.modules = toModules(modules);
    const updated = await ProgramModel.findOneAndUpdate({ publicId: programPublicId, tutorPublicId, isDeleted: false }, { $set }, { new: true }).lean();
    if (!updated) throw new NotFoundError('Program');
    return updated;
  }

  async setStatus(tutorPublicId: string, programPublicId: string, status: 'PUBLISHED' | 'ARCHIVED'): Promise<IProgram> {
    await this._owned(tutorPublicId, programPublicId);
    const updated = await ProgramModel.findOneAndUpdate({ publicId: programPublicId, tutorPublicId }, { $set: { status } }, { new: true }).lean();
    return updated!;
  }

  async remove(tutorPublicId: string, programPublicId: string): Promise<void> {
    await this._owned(tutorPublicId, programPublicId);
    if (await ProgramEnrollmentModel.exists({ programPublicId })) {
      throw new ConflictError('A program with enrollments cannot be deleted — archive it instead');
    }
    await ProgramModel.updateOne({ publicId: programPublicId, tutorPublicId }, { $set: { isDeleted: true } });
  }

  async listMine(tutorPublicId: string): Promise<ProgramView[]> {
    const programs = await ProgramModel.find({ tutorPublicId, isDeleted: false }).sort({ createdAt: -1 }).lean();
    return withTutorNames(programs);
  }

  /** Drafts are visible to their tutor and admins only. */
  async getForViewer(programPublicId: string, viewer: { role: string; tutorPublicId?: string }): Promise<ProgramView> {
    const program = await ProgramModel.findOne({ publicId: programPublicId, isDeleted: false }).lean();
    const isAdmin = viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN';
    if (!program || (program.status === ProgramStatus.DRAFT && !isAdmin && program.tutorPublicId !== viewer.tutorPublicId)) {
      throw new NotFoundError('Program');
    }
    const [view] = await withTutorNames([program]);
    return view;
  }

  private _filter(query: ProgramCatalogQuery, base: Record<string, unknown>): Record<string, unknown> {
    const filter: Record<string, unknown> = { ...base, isDeleted: false };
    if (query.category) filter.category = query.category;
    if (query.level) filter.level = query.level;
    if (query.age !== undefined) {
      filter.$and = [
        { $or: [{ ageMin: { $exists: false } }, { ageMin: { $lte: query.age } }] },
        { $or: [{ ageMax: { $exists: false } }, { ageMax: { $gte: query.age } }] },
      ];
    }
    if (query.q?.trim()) filter.title = new RegExp(escape(query.q.trim()), 'i');
    return filter;
  }

  async catalog(query: ProgramCatalogQuery): Promise<PaginatedResult<ProgramView>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = this._filter(query, { status: ProgramStatus.PUBLISHED });
    const [items, total] = await Promise.all([
      ProgramModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ProgramModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(await withTutorNames(items), total, page, limit);
  }

  async adminList(query: ProgramCatalogQuery & { status?: string }): Promise<PaginatedResult<ProgramView>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = this._filter(query, query.status ? { status: query.status } : {});
    const [items, total] = await Promise.all([
      ProgramModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ProgramModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(await withTutorNames(items), total, page, limit);
  }

  async unpublish(programPublicId: string): Promise<IProgram> {
    const updated = await ProgramModel.findOneAndUpdate(
      { publicId: programPublicId, isDeleted: false },
      { $set: { status: ProgramStatus.ARCHIVED } },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Program');
    return updated;
  }
}

export const programService = new ProgramService();
```

(If `parsePaginationQuery` requires string inputs, pass `{ page: String(query.page ?? 1), limit: String(query.limit ?? 20) }`; match its signature in `utils/pagination.ts`.)

- [ ] **Step 5: Verify** — `npx jest src/tests/modules/program.service && npx tsc --noEmit -p .` → pass.

- [ ] **Step 6: Commit** — `git add server/src && git commit -m "feat: skill program CRUD, catalog and admin listing"`

---

### Task 3: Enrollment — enroll, schedule sessions, cancel, lists, structure

**Files:**
- Create: `server/src/modules/programs/program-enrollment.service.ts`
- Test: `server/src/tests/modules/program.enrollment.test.ts`

**Interfaces:**
- Consumes: Task 1 (`isWithinAvailability`, models, `BillingMode.PROGRAM_PREPAID`), Task 2 validators, `computeTopicProgress` (`courses/course-progress.ts`), `classService.cancelClass`, `walletService.debitWallet/refundWallet`, `studentService.getByUserPublicId/getByPublicId`, `tutorService.getByUserPublicId`.
- Produces `programEnrollmentService`:
  - `enroll(studentUserPublicId: string, programPublicId: string, dto: EnrollDto): Promise<IProgramEnrollment>`
  - `scheduleSession(enrollmentPublicId: string, tutorUserPublicId: string, dto: ScheduleSessionDto): Promise<IScheduledClass>`
  - `cancel(enrollmentPublicId: string, actorUserPublicId: string): Promise<IProgramEnrollment>`
  - `listMine(studentUserPublicId)`, `listForParent(parentUserPublicId)`, `listForProgram(tutorUserPublicId, programPublicId)` → `EnrichedEnrollment[]` (`IProgramEnrollment & { programTitle; programCategory; tutorName; studentName }`)
  - `getStructure(enrollmentPublicId: string, viewer: { role: string; userPublicId: string })` → `{ viewerRole, enrollment: {...}, program: { publicId, title, category, level }, topics: StructureTopic-like (materials: []), otherClasses }`
  - `sessionCost(priceCents: number, sessionCount: number, sessionNumber: number): number` (exported pure helper)

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/modules/program.enrollment.test.ts
import { programEnrollmentService, sessionCost } from '../../modules/programs/program-enrollment.service';
import { ProgramModel, ProgramEnrollmentModel } from '../../modules/programs/program.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { studentService } from '../../modules/students/student.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { classService } from '../../modules/classes/class.service';
import { domainEvents } from '../../events/event-emitter';
import { AppError } from '../../utils/error';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const window = { daysOfWeek: [1, 2, 3, 4, 5], startLocalTime: '16:00', endLocalTime: '19:00', ianaTimezone: 'UTC' };
const program = {
  publicId: 'p-1', tutorPublicId: 'tp-1', status: 'PUBLISHED', sessionCount: 3, sessionMinutes: 60, priceCents: 1000,
  maxEnrollees: 5, activeEnrollmentCount: 1, modules: [{ publicId: 'm-1', title: 'Openings', order: 0 }], isDeleted: false,
};
const enrollment = {
  publicId: 'e-1', programPublicId: 'p-1', tutorPublicId: 'tp-1', studentPublicId: 'sp-1', availabilityWindow: window,
  sessionCount: 3, priceCentsPaid: 1000, sessionsScheduledCount: 0, sessionsCompletedCount: 0, status: 'ACTIVE',
};

describe('sessionCost', () => {
  it('splits the price so the sessions sum exactly to it', () => {
    const costs = [1, 2, 3].map((n) => sessionCost(1000, 3, n));
    expect(costs).toEqual([333, 333, 334]);
    expect(costs.reduce((a, b) => a + b, 0)).toBe(1000);
  });
});

describe('enroll', () => {
  beforeEach(() => {
    jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'sp-1', userPublicId: 'su-1' } as never);
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(program) as never);
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue(null as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('reserves a seat atomically, charges the price and creates the enrollment', async () => {
    const seat = jest.spyOn(ProgramModel, 'findOneAndUpdate').mockReturnValue(lean(program) as never);
    const debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
    const create = jest.spyOn(ProgramEnrollmentModel, 'create').mockResolvedValue({ toObject: () => enrollment } as never);

    await programEnrollmentService.enroll('su-1', 'p-1', { availabilityWindow: window });

    expect(seat).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: 'p-1', status: 'PUBLISHED', isDeleted: false }),
      { $inc: { activeEnrollmentCount: 1 } },
      { new: true },
    );
    expect(debit).toHaveBeenCalledWith(expect.objectContaining({
      ownerPublicId: 'su-1', amountCents: 1000, referenceType: 'PROGRAM_ENROLL', idempotencyKey: expect.stringMatching(/^program-enroll-/),
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ sessionCount: 3, priceCentsPaid: 1000, status: 'ACTIVE' }));
  });

  it('409s when full, without charging', async () => {
    jest.spyOn(ProgramModel, 'findOneAndUpdate').mockReturnValue(lean(null) as never);
    const debit = jest.spyOn(walletService, 'debitWallet');
    await expect(programEnrollmentService.enroll('su-1', 'p-1', { availabilityWindow: window })).rejects.toMatchObject({ statusCode: 409 });
    expect(debit).not.toHaveBeenCalled();
  });

  it('409s a second active enrollment', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    await expect(programEnrollmentService.enroll('su-1', 'p-1', { availabilityWindow: window })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('releases the seat when the wallet has too little credit', async () => {
    jest.spyOn(ProgramModel, 'findOneAndUpdate').mockReturnValue(lean(program) as never);
    jest.spyOn(walletService, 'debitWallet').mockRejectedValue(new AppError('Insufficient credits', 402));
    const release = jest.spyOn(ProgramModel, 'updateOne').mockResolvedValue({} as never);
    await expect(programEnrollmentService.enroll('su-1', 'p-1', { availabilityWindow: window })).rejects.toMatchObject({ statusCode: 402 });
    expect(release).toHaveBeenCalledWith({ publicId: 'p-1' }, { $inc: { activeEnrollmentCount: -1 } });
  });

  it('404s a draft program', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(programEnrollmentService.enroll('su-1', 'p-1', { availabilityWindow: window })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('scheduleSession', () => {
  const dto = { startUTC: '2026-09-28T16:00:00.000Z', endUTC: '2026-09-28T17:00:00.000Z', title: 'Session', programModulePublicId: 'm-1' };
  beforeEach(() => {
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-1' } as never);
    jest.spyOn(ProgramEnrollmentModel, 'findOne').mockReturnValue(lean(enrollment) as never);
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(program) as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('books a PROGRAM_PREPAID class priced from the post-increment session number', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate').mockReturnValue(lean({ ...enrollment, sessionsScheduledCount: 3 }) as never);
    const create = jest.spyOn(ScheduledClassModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await programEnrollmentService.scheduleSession('e-1', 'tu-1', dto);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      billingMode: 'PROGRAM_PREPAID', costCents: 334, programEnrollmentPublicId: 'e-1', programModulePublicId: 'm-1', studentPublicId: 'sp-1',
    }));
  });

  it('rejects another tutor, a foreign module, a slot outside availability, and an over-long session', async () => {
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-9' } as never);
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-9', dto)).rejects.toMatchObject({ statusCode: 404 });
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-1' } as never);
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', { ...dto, programModulePublicId: 'm-9' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', { ...dto, startUTC: '2026-09-27T16:00:00.000Z', endUTC: '2026-09-27T17:00:00.000Z' }))
      .rejects.toMatchObject({ statusCode: 400 }); // Sunday
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', { ...dto, endUTC: '2026-09-28T18:30:00.000Z' }))
      .rejects.toMatchObject({ statusCode: 400 }); // 150 min > 60 + 15
  });

  it('409s once every session is booked (guarded increment)', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate').mockReturnValue(lean(null) as never);
    const create = jest.spyOn(ScheduledClassModel, 'create');
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', dto)).rejects.toMatchObject({ statusCode: 409 });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('cancel', () => {
  afterEach(() => jest.restoreAllMocks());

  it('cancels future sessions, refunds the never-booked remainder and frees the seat', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'findOne').mockReturnValue(lean({ ...enrollment, sessionsScheduledCount: 2 }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1', userPublicId: 'su-1' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(ScheduledClassModel, 'find')
      .mockReturnValueOnce(lean([{ publicId: 'k-2' }]) as never) // still scheduled
      .mockReturnValueOnce(lean([{ costCents: 333 }, { costCents: 333 }]) as never); // ever booked
    const cancelClass = jest.spyOn(classService, 'cancelClass').mockResolvedValue({} as never);
    const refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
    jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate').mockReturnValue(lean({ ...enrollment, status: 'CANCELLED' }) as never);
    const seat = jest.spyOn(ProgramModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

    await programEnrollmentService.cancel('e-1', 'su-1');

    expect(cancelClass).toHaveBeenCalledWith('k-2', 'su-1', { reason: 'Program enrollment cancelled' });
    expect(refund).toHaveBeenCalledWith(expect.objectContaining({
      ownerPublicId: 'su-1', amountCents: 334, referenceType: 'PROGRAM_CANCEL', idempotencyKey: 'program-cancel-e-1',
    }));
    expect(seat).toHaveBeenCalledWith({ publicId: 'p-1' }, { $inc: { activeEnrollmentCount: -1 } });
  });

  it('404s someone who is neither the student nor the tutor', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'findOne').mockReturnValue(lean(enrollment) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-9' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(programEnrollmentService.cancel('e-1', 'x')).rejects.toMatchObject({ statusCode: 404 });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/tests/modules/program.enrollment` → FAIL.

- [ ] **Step 3: Implement**

```ts
// server/src/modules/programs/program-enrollment.service.ts
import { v4 as uuidv4 } from 'uuid';
import { ProgramModel, ProgramEnrollmentModel } from './program.model';
import { EnrollmentStatus, ProgramStatus } from './program.types';
import type { IProgramEnrollment } from './program.types';
import type { EnrollDto, ScheduleSessionDto } from './program.validators';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { BillingMode, ClassStatus, ClassType } from '../schedules/schedule.types';
import type { IScheduledClass } from '../schedules/schedule.types';
import { StudentProfileModel } from '../students/student.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { ParentProfileModel } from '../parents/parent.model';
import { UserModel } from '../users/user.model';
import { studentService } from '../students/student.service';
import { tutorService } from '../tutors/tutor.service';
import { walletService } from '../wallets/wallet.service';
import { classService } from '../classes/class.service';
import { computeTopicProgress } from '../courses/course-progress';
import { isWithinAvailability } from '../../shared/availability';
import { AppError, ConflictError, NotFoundError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';

/** Price split per session; the last session carries the rounding remainder. */
export function sessionCost(priceCents: number, sessionCount: number, sessionNumber: number): number {
  const share = Math.floor(priceCents / sessionCount);
  return sessionNumber === sessionCount ? priceCents - share * (sessionCount - 1) : share;
}

const SESSION_LENGTH_TOLERANCE_MIN = 15;

export type EnrichedEnrollment = IProgramEnrollment & {
  programTitle: string;
  programCategory: string;
  tutorName: string;
  studentName: string;
};

async function enrich(items: IProgramEnrollment[]): Promise<EnrichedEnrollment[]> {
  if (items.length === 0) return [];
  const [programs, tutors, students] = await Promise.all([
    ProgramModel.find({ publicId: { $in: [...new Set(items.map((e) => e.programPublicId))] } }, { publicId: 1, title: 1, category: 1 }).lean(),
    TutorProfileModel.find({ publicId: { $in: [...new Set(items.map((e) => e.tutorPublicId))] } }, { publicId: 1, userPublicId: 1 }).lean(),
    StudentProfileModel.find({ publicId: { $in: [...new Set(items.map((e) => e.studentPublicId))] } }, { publicId: 1, userPublicId: 1 }).lean(),
  ]);
  const users = await UserModel.find(
    { publicId: { $in: [...tutors, ...students].map((p) => p.userPublicId) } },
    { publicId: 1, firstName: 1, lastName: 1 },
  ).lean();
  const nameByUser = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));
  const programById = new Map(programs.map((p) => [p.publicId, p]));
  const tutorName = new Map(tutors.map((t) => [t.publicId, nameByUser.get(t.userPublicId) ?? 'Tutor']));
  const studentName = new Map(students.map((s) => [s.publicId, nameByUser.get(s.userPublicId) ?? 'Student']));
  return items.map((e) => ({
    ...e,
    programTitle: programById.get(e.programPublicId)?.title ?? 'Program',
    programCategory: programById.get(e.programPublicId)?.category ?? 'OTHER',
    tutorName: tutorName.get(e.tutorPublicId) ?? 'Tutor',
    studentName: studentName.get(e.studentPublicId) ?? 'Student',
  }));
}

export class ProgramEnrollmentService {
  async enroll(studentUserPublicId: string, programPublicId: string, dto: EnrollDto): Promise<IProgramEnrollment> {
    const student = await studentService.getByUserPublicId(studentUserPublicId);
    const program = await ProgramModel.findOne({ publicId: programPublicId, status: ProgramStatus.PUBLISHED, isDeleted: false }).lean();
    if (!program) throw new NotFoundError('Program');
    if (await ProgramEnrollmentModel.exists({ programPublicId, studentPublicId: student.publicId, status: EnrollmentStatus.ACTIVE })) {
      throw new ConflictError('You are already enrolled in this program');
    }

    // Reserve a seat atomically so two students can't take the last one.
    const reserved = await ProgramModel.findOneAndUpdate(
      {
        publicId: programPublicId,
        status: ProgramStatus.PUBLISHED,
        isDeleted: false,
        $or: [{ maxEnrollees: { $exists: false } }, { $expr: { $lt: ['$activeEnrollmentCount', '$maxEnrollees'] } }],
      },
      { $inc: { activeEnrollmentCount: 1 } },
      { new: true },
    ).lean();
    if (!reserved) throw new ConflictError('Program is full');
    const releaseSeat = () => ProgramModel.updateOne({ publicId: programPublicId }, { $inc: { activeEnrollmentCount: -1 } });

    const enrollmentPublicId = uuidv4();
    if (program.priceCents > 0) {
      try {
        await walletService.debitWallet({
          ownerPublicId: studentUserPublicId,
          amountCents: program.priceCents,
          description: `Skill program: ${program.title}`,
          // Persisted in wallettransactions — do not rename.
          idempotencyKey: `program-enroll-${enrollmentPublicId}`,
          referenceId: enrollmentPublicId,
          referenceType: 'PROGRAM_ENROLL',
        });
      } catch (error) {
        await releaseSeat();
        throw error;
      }
    }

    try {
      const created = await ProgramEnrollmentModel.create({
        publicId: enrollmentPublicId,
        programPublicId,
        tutorPublicId: program.tutorPublicId,
        studentPublicId: student.publicId,
        availabilityWindow: dto.availabilityWindow,
        sessionCount: program.sessionCount,
        priceCentsPaid: program.priceCents,
        sessionsScheduledCount: 0,
        sessionsCompletedCount: 0,
        status: EnrollmentStatus.ACTIVE,
        isDeleted: false,
      });
      domainEvents.emit(DomainEvent.PROGRAM_ENROLLED, {
        enrollmentPublicId,
        programPublicId,
        tutorPublicId: program.tutorPublicId,
        studentUserPublicId,
      });
      return created.toObject();
    } catch (error) {
      // e.g. the unique ACTIVE index lost a race — undo the charge and the seat.
      if (program.priceCents > 0) {
        await walletService.refundWallet({
          ownerPublicId: studentUserPublicId,
          amountCents: program.priceCents,
          description: `Refund: ${program.title} (enrollment failed)`,
          idempotencyKey: `program-enroll-undo-${enrollmentPublicId}`,
          referenceId: enrollmentPublicId,
          referenceType: 'PROGRAM_CANCEL',
        }).catch(() => undefined);
      }
      await releaseSeat();
      throw error;
    }
  }

  async scheduleSession(enrollmentPublicId: string, tutorUserPublicId: string, dto: ScheduleSessionDto): Promise<IScheduledClass> {
    const tutor = await tutorService.getByUserPublicId(tutorUserPublicId);
    const enrollment = await ProgramEnrollmentModel.findOne({ publicId: enrollmentPublicId, isDeleted: false }).lean();
    if (!enrollment || enrollment.tutorPublicId !== tutor.publicId) throw new NotFoundError('Enrollment');
    if (enrollment.status !== EnrollmentStatus.ACTIVE) throw new ConflictError('Enrollment is not active');
    const program = await ProgramModel.findOne({ publicId: enrollment.programPublicId }).lean();
    if (!program) throw new NotFoundError('Program');
    if (!program.modules.some((m) => m.publicId === dto.programModulePublicId)) {
      throw new AppError('Module is not part of this program', 400);
    }

    const start = new Date(dto.startUTC);
    const end = new Date(dto.endUTC);
    if (end <= start) throw new AppError('endUTC must be after startUTC', 400);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (durationMinutes > program.sessionMinutes + SESSION_LENGTH_TOLERANCE_MIN) {
      throw new AppError(`Sessions are ${program.sessionMinutes} minutes long`, 400);
    }
    if (!isWithinAvailability(enrollment.availabilityWindow, start, end)) {
      throw new AppError('Requested time is outside the student\'s stated availability window', 400);
    }

    // Claim the next session number first; its value prices this session.
    const claimed = await ProgramEnrollmentModel.findOneAndUpdate(
      { publicId: enrollmentPublicId, status: EnrollmentStatus.ACTIVE, sessionsScheduledCount: { $lt: enrollment.sessionCount } },
      { $inc: { sessionsScheduledCount: 1 } },
      { new: true },
    ).lean();
    if (!claimed) throw new ConflictError('All sessions for this enrollment are already scheduled');

    try {
      const created = await ScheduledClassModel.create({
        publicId: uuidv4(),
        tutorPublicId: tutor.publicId,
        studentPublicId: enrollment.studentPublicId,
        classType: ClassType.RECURRING,
        status: ClassStatus.SCHEDULED,
        startUTC: start,
        endUTC: end,
        ianaTimezone: enrollment.availabilityWindow.ianaTimezone,
        durationMinutes,
        title: dto.title,
        costCents: sessionCost(enrollment.priceCentsPaid, enrollment.sessionCount, claimed.sessionsScheduledCount),
        billingMode: BillingMode.PROGRAM_PREPAID,
        idempotencyKey: `program-class-${enrollmentPublicId}-${claimed.sessionsScheduledCount}`,
        programEnrollmentPublicId: enrollmentPublicId,
        programPublicId: enrollment.programPublicId,
        programModulePublicId: dto.programModulePublicId,
        isDeleted: false,
      });
      domainEvents.emit(DomainEvent.PROGRAM_SESSION_SCHEDULED, {
        enrollmentPublicId,
        classPublicId: created.publicId,
        tutorUserPublicId,
      });
      return created.toObject();
    } catch (error) {
      await ProgramEnrollmentModel.updateOne({ publicId: enrollmentPublicId }, { $inc: { sessionsScheduledCount: -1 } });
      throw error;
    }
  }

  async cancel(enrollmentPublicId: string, actorUserPublicId: string): Promise<IProgramEnrollment> {
    const enrollment = await ProgramEnrollmentModel.findOne({ publicId: enrollmentPublicId, isDeleted: false }).lean();
    if (!enrollment) throw new NotFoundError('Enrollment');
    const [student, tutor] = await Promise.all([
      StudentProfileModel.findOne({ userPublicId: actorUserPublicId, isDeleted: false }).lean(),
      TutorProfileModel.findOne({ userPublicId: actorUserPublicId, isDeleted: false }).lean(),
    ]);
    const isParty = student?.publicId === enrollment.studentPublicId || tutor?.publicId === enrollment.tutorPublicId;
    if (!isParty) throw new NotFoundError('Enrollment');
    if (enrollment.status !== EnrollmentStatus.ACTIVE) throw new ConflictError(`Enrollment already ${enrollment.status.toLowerCase()}`);

    const upcoming = await ScheduledClassModel.find(
      { programEnrollmentPublicId: enrollmentPublicId, status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] }, isDeleted: false },
      { publicId: 1 },
    ).lean();
    for (const cls of upcoming) {
      // cancelClass refunds each prepaid session's own cost.
      await classService.cancelClass(cls.publicId, actorUserPublicId, { reason: 'Program enrollment cancelled' });
    }

    const booked = await ScheduledClassModel.find({ programEnrollmentPublicId: enrollmentPublicId, isDeleted: false }, { costCents: 1 }).lean();
    const neverBooked = enrollment.priceCentsPaid - booked.reduce((sum, c) => sum + (c.costCents ?? 0), 0);
    if (neverBooked > 0) {
      const studentProfile = await StudentProfileModel.findOne({ publicId: enrollment.studentPublicId }, { userPublicId: 1 }).lean();
      if (!studentProfile) throw new NotFoundError('Student profile');
      await walletService.refundWallet({
        ownerPublicId: studentProfile.userPublicId,
        amountCents: neverBooked,
        description: 'Skill program cancelled — unscheduled sessions refunded',
        // Persisted in wallettransactions — do not rename.
        idempotencyKey: `program-cancel-${enrollmentPublicId}`,
        referenceId: enrollmentPublicId,
        referenceType: 'PROGRAM_CANCEL',
      });
    }

    const updated = await ProgramEnrollmentModel.findOneAndUpdate(
      { publicId: enrollmentPublicId, status: EnrollmentStatus.ACTIVE },
      { $set: { status: EnrollmentStatus.CANCELLED, cancelledBy: actorUserPublicId } },
      { new: true },
    ).lean();
    if (updated) {
      await ProgramModel.updateOne({ publicId: enrollment.programPublicId }, { $inc: { activeEnrollmentCount: -1 } });
      domainEvents.emit(DomainEvent.PROGRAM_ENROLLMENT_CANCELLED, { enrollmentPublicId, actorUserPublicId });
    }
    return updated ?? enrollment;
  }

  async listMine(studentUserPublicId: string): Promise<EnrichedEnrollment[]> {
    const student = await studentService.getByUserPublicId(studentUserPublicId);
    return enrich(await ProgramEnrollmentModel.find({ studentPublicId: student.publicId, isDeleted: false }).sort({ createdAt: -1 }).lean());
  }

  async listForParent(parentUserPublicId: string): Promise<EnrichedEnrollment[]> {
    const parent = await ParentProfileModel.findOne({ userPublicId: parentUserPublicId, isDeleted: false }).lean();
    const children = parent?.childStudentPublicIds ?? [];
    if (children.length === 0) return [];
    return enrich(await ProgramEnrollmentModel.find({
      studentPublicId: { $in: children },
      status: { $in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
      isDeleted: false,
    }).sort({ createdAt: -1 }).lean());
  }

  async listForProgram(tutorUserPublicId: string, programPublicId: string): Promise<EnrichedEnrollment[]> {
    const tutor = await tutorService.getByUserPublicId(tutorUserPublicId);
    const program = await ProgramModel.findOne({ publicId: programPublicId, tutorPublicId: tutor.publicId, isDeleted: false }).lean();
    if (!program) throw new NotFoundError('Program');
    return enrich(await ProgramEnrollmentModel.find({ programPublicId, isDeleted: false }).sort({ createdAt: -1 }).lean());
  }

  /** Program › Module › sessions. Status only for the student and their parents. */
  async getStructure(enrollmentPublicId: string, viewer: { role: string; userPublicId: string }) {
    const enrollment = await ProgramEnrollmentModel.findOne({ publicId: enrollmentPublicId, isDeleted: false }).lean();
    if (!enrollment) throw new NotFoundError('Enrollment');
    const viewerRole = await this._structureRole(enrollment, viewer);

    const [program, classes, [enriched]] = await Promise.all([
      ProgramModel.findOne({ publicId: enrollment.programPublicId }).lean(),
      ScheduledClassModel.find(
        { programEnrollmentPublicId: enrollmentPublicId, isDeleted: false },
        { publicId: 1, status: 1, startUTC: 1, endUTC: 1, programModulePublicId: 1 },
      ).lean(),
      enrich([enrollment]),
    ]);
    if (!program) throw new NotFoundError('Program');

    const progress = computeTopicProgress(
      program.modules.map((m) => ({ publicId: m.publicId, title: m.title, order: m.order })),
      classes.map((c) => ({ ...c, topicPublicId: c.programModulePublicId })),
      new Date(),
    );
    const showStatus = viewerRole === 'STUDENT' || viewerRole === 'PARENT';
    return {
      viewerRole,
      enrollment: {
        publicId: enrollment.publicId,
        status: enrollment.status,
        sessionCount: enrollment.sessionCount,
        sessionsScheduledCount: enrollment.sessionsScheduledCount,
        sessionsCompletedCount: enrollment.sessionsCompletedCount,
        availabilityWindow: enrollment.availabilityWindow,
        tutorName: enriched.tutorName,
        studentName: enriched.studentName,
      },
      program: { publicId: program.publicId, title: program.title, category: program.category, level: program.level, sessionMinutes: program.sessionMinutes, modules: program.modules },
      topics: progress.topics.map(({ status, nextClass, ...rest }) => ({
        ...rest,
        ...(showStatus ? { status, ...(nextClass ? { nextClass } : {}) } : {}),
        materials: [],
      })),
      otherClasses: progress.otherClasses,
    };
  }

  private async _structureRole(e: IProgramEnrollment, viewer: { role: string; userPublicId: string }): Promise<'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN'> {
    if (viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN') return 'ADMIN';
    if (viewer.role === 'STUDENT') {
      const s = await StudentProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
      if (s?.publicId === e.studentPublicId) return 'STUDENT';
    }
    if (viewer.role === 'PARENT') {
      const p = await ParentProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
      if (p?.childStudentPublicIds?.includes(e.studentPublicId)) return 'PARENT';
    }
    if (viewer.role === 'TUTOR' || viewer.role === 'PRINCIPAL') {
      const t = await TutorProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
      if (t?.publicId === e.tutorPublicId) return 'TUTOR';
    }
    throw new NotFoundError('Enrollment');
  }
}

export const programEnrollmentService = new ProgramEnrollmentService();
```

(`computeTopicProgress` takes classes with `topicPublicId`; program sessions carry `programModulePublicId`, mapped above. Check `ClassType.RECURRING` exists — it is used by `course.service.scheduleClass`.)

- [ ] **Step 4: Verify + commit** — `npx jest src/tests/modules/program.enrollment && npx tsc --noEmit -p .` → pass.
  `git add server/src && git commit -m "feat: skill program enrollment, session scheduling and cancellation"`

---

### Task 4: Routes, controller, notification

**Files:**
- Create: `server/src/modules/programs/program.controller.ts`, `program.routes.ts`
- Modify: `server/src/app.ts`, `server/src/modules/notifications/notification.service.ts`
- Test: `server/src/tests/modules/program.routes.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3 services and validators.
- Produces: the API table in the spec §6, mounted at `/api/v1/programs`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/modules/program.routes.test.ts
import request from 'supertest';
import app from '../../app';
import { programService } from '../../modules/programs/program.service';
import { programEnrollmentService } from '../../modules/programs/program-enrollment.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { settingsService } from '../../modules/settings/settings.service';

let mockRole = 'TUTOR';
jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'user-1', role: mockRole };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const body = { title: 'Chess', category: 'GAMES', level: 'BEGINNER', sessionCount: 4, priceCents: 4000, modules: [{ title: 'Openings' }] };

describe('/programs routes', () => {
  beforeEach(() => {
    jest.spyOn(settingsService, 'get').mockResolvedValue({ maintenanceMode: false } as never);
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-1' } as never);
  });
  afterEach(() => { jest.restoreAllMocks(); mockRole = 'TUTOR'; });

  it('tutor creates a program with a validated body; bad bodies 422', async () => {
    const create = jest.spyOn(programService, 'create').mockResolvedValue({ publicId: 'p-1' } as never);
    expect((await request(app).post('/api/v1/programs').send(body)).status).toBe(201);
    expect(create).toHaveBeenCalledWith('tp-1', expect.objectContaining({ title: 'Chess', sessionMinutes: 60 }));
    expect((await request(app).post('/api/v1/programs').send({ ...body, modules: [] })).status).toBe(422);
  });

  it('students cannot create programs; tutors cannot enroll', async () => {
    mockRole = 'STUDENT';
    expect((await request(app).post('/api/v1/programs').send(body)).status).toBe(403);
    mockRole = 'TUTOR';
    expect((await request(app).post('/api/v1/programs/p-1/enroll').send({})).status).toBe(403);
  });

  it('student enrolls with an availability window', async () => {
    mockRole = 'STUDENT';
    const enroll = jest.spyOn(programEnrollmentService, 'enroll').mockResolvedValue({ publicId: 'e-1' } as never);
    const res = await request(app).post('/api/v1/programs/p-1/enroll').send({
      availabilityWindow: { daysOfWeek: [1], startLocalTime: '16:00', endLocalTime: '18:00', ianaTimezone: 'UTC' },
    });
    expect(res.status).toBe(201);
    expect(enroll).toHaveBeenCalledWith('user-1', 'p-1', expect.anything());
  });

  it('catalog is open to any signed-in user and passes filters', async () => {
    mockRole = 'PARENT';
    const catalog = jest.spyOn(programService, 'catalog').mockResolvedValue({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } as never);
    expect((await request(app).get('/api/v1/programs?category=GAMES&age=9')).status).toBe(200);
    expect(catalog).toHaveBeenCalledWith(expect.objectContaining({ category: 'GAMES', age: 9 }));
  });

  it('fixed paths are not captured by /:programPublicId', async () => {
    mockRole = 'STUDENT';
    const mine = jest.spyOn(programEnrollmentService, 'listMine').mockResolvedValue([]);
    expect((await request(app).get('/api/v1/programs/enrollments/mine')).status).toBe(200);
    expect(mine).toHaveBeenCalledWith('user-1');
  });

  it('admins unpublish', async () => {
    mockRole = 'ADMIN';
    const un = jest.spyOn(programService, 'unpublish').mockResolvedValue({ publicId: 'p-1' } as never);
    expect((await request(app).post('/api/v1/programs/p-1/unpublish')).status).toBe(200);
    expect(un).toHaveBeenCalledWith('p-1');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/tests/modules/program.routes` → FAIL (404s).

- [ ] **Step 3: Controller**

```ts
// server/src/modules/programs/program.controller.ts
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { programService } from './program.service';
import { programEnrollmentService } from './program-enrollment.service';
import { programCatalogQuerySchema } from './program.validators';
import { tutorService } from '../tutors/tutor.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { ValidationError } from '../../utils/error';

const tutorId = async (req: AuthRequest) => (await tutorService.getByUserPublicId(req.user!.publicId)).publicId;
const viewer = (req: AuthRequest) => ({ role: req.user!.role, userPublicId: req.user!.publicId });

function catalogQuery(req: AuthRequest) {
  const parsed = programCatalogQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
  return parsed.data;
}

type Handler = (req: AuthRequest, res: Response) => Promise<void>;
const wrap = (fn: Handler) => (req: AuthRequest, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const programController = {
  catalog: wrap(async (req, res) => sendPaginated(res, await programService.catalog(catalogQuery(req)), 'Programs fetched')),
  mine: wrap(async (req, res) => sendSuccess(res, await programService.listMine(await tutorId(req)), 'Programs fetched')),
  get: wrap(async (req, res) => {
    const isTeacher = req.user!.role === 'TUTOR' || req.user!.role === 'PRINCIPAL';
    const program = await programService.getForViewer(req.params.programPublicId, {
      role: req.user!.role,
      tutorPublicId: isTeacher ? await tutorId(req).catch(() => undefined) : undefined,
    });
    sendSuccess(res, program, 'Program fetched');
  }),
  create: wrap(async (req, res) => sendCreated(res, await programService.create(await tutorId(req), req.body), 'Program created')),
  update: wrap(async (req, res) => sendSuccess(res, await programService.update(await tutorId(req), req.params.programPublicId, req.body), 'Program updated')),
  publish: wrap(async (req, res) => sendSuccess(res, await programService.setStatus(await tutorId(req), req.params.programPublicId, 'PUBLISHED'), 'Program published')),
  archive: wrap(async (req, res) => sendSuccess(res, await programService.setStatus(await tutorId(req), req.params.programPublicId, 'ARCHIVED'), 'Program archived')),
  remove: wrap(async (req, res) => {
    await programService.remove(await tutorId(req), req.params.programPublicId);
    sendSuccess(res, null, 'Program deleted');
  }),
  enrollments: wrap(async (req, res) => sendSuccess(res, await programEnrollmentService.listForProgram(req.user!.publicId, req.params.programPublicId), 'Enrollments fetched')),
  enroll: wrap(async (req, res) => sendCreated(res, await programEnrollmentService.enroll(req.user!.publicId, req.params.programPublicId, req.body), 'Enrolled')),
  myEnrollments: wrap(async (req, res) => sendSuccess(res, await programEnrollmentService.listMine(req.user!.publicId), 'Enrollments fetched')),
  childrenEnrollments: wrap(async (req, res) => sendSuccess(res, await programEnrollmentService.listForParent(req.user!.publicId), 'Enrollments fetched')),
  structure: wrap(async (req, res) => sendSuccess(res, await programEnrollmentService.getStructure(req.params.enrollmentPublicId, viewer(req)), 'Enrollment fetched')),
  scheduleSession: wrap(async (req, res) => sendCreated(res, await programEnrollmentService.scheduleSession(req.params.enrollmentPublicId, req.user!.publicId, req.body), 'Session scheduled')),
  cancel: wrap(async (req, res) => sendSuccess(res, await programEnrollmentService.cancel(req.params.enrollmentPublicId, req.user!.publicId), 'Enrollment cancelled')),
  adminList: wrap(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    sendPaginated(res, await programService.adminList({ ...catalogQuery(req), status }), 'Programs fetched');
  }),
  unpublish: wrap(async (req, res) => sendSuccess(res, await programService.unpublish(req.params.programPublicId), 'Program unpublished')),
};
```

- [ ] **Step 4: Routes** (fixed paths before `/:programPublicId`)

```ts
// server/src/modules/programs/program.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import { programController as c } from './program.controller';
import { createProgramSchema, updateProgramSchema, enrollSchema, scheduleSessionSchema } from './program.validators';

const router = Router();
router.use(authMiddleware);

const TEACHERS = requireRole(Role.TUTOR, Role.PRINCIPAL);
const ADMINS = requireRole(Role.ADMIN, Role.SUPER_ADMIN);

router.get('/', c.catalog);
router.get('/mine', TEACHERS, c.mine);
router.get('/admin', ADMINS, c.adminList);
router.get('/enrollments/mine', requireRole(Role.STUDENT), c.myEnrollments);
router.get('/enrollments/children', requireRole(Role.PARENT), c.childrenEnrollments);
router.get('/enrollments/:enrollmentPublicId/structure', c.structure);
router.post('/enrollments/:enrollmentPublicId/sessions', TEACHERS, validate(scheduleSessionSchema), c.scheduleSession);
router.post('/enrollments/:enrollmentPublicId/cancel', requireRole(Role.STUDENT, Role.TUTOR, Role.PRINCIPAL), c.cancel);

router.post('/', TEACHERS, validate(createProgramSchema), c.create);
router.get('/:programPublicId', c.get);
router.put('/:programPublicId', TEACHERS, validate(updateProgramSchema), c.update);
router.delete('/:programPublicId', TEACHERS, c.remove);
router.post('/:programPublicId/publish', TEACHERS, c.publish);
router.post('/:programPublicId/archive', TEACHERS, c.archive);
router.post('/:programPublicId/unpublish', ADMINS, c.unpublish);
router.get('/:programPublicId/enrollments', TEACHERS, c.enrollments);
router.post('/:programPublicId/enroll', requireRole(Role.STUDENT), validate(enrollSchema), c.enroll);

export default router;
```

`app.ts`: `import programRoutes from './modules/programs/program.routes';` and `app.use(`${API_BASE}/programs`, programRoutes);` next to the curricula/courses mounts. (If `validate` replaces `req.body` with the parsed value, defaults like `sessionMinutes: 60` reach the service; confirm by the create test.)

- [ ] **Step 5: Notification** — in `notification.service.ts` next to the course listeners:

```ts
    domainEvents.on(DomainEvent.PROGRAM_ENROLLED, async (payload: { programPublicId: string; tutorPublicId: string }) => {
      try {
        const { TutorProfileModel } = await import('../tutors/tutor.model');
        const tutor = await TutorProfileModel.findOne({ publicId: payload.tutorPublicId }, { userPublicId: 1 }).lean();
        if (!tutor) return;
        await this.create({
          recipientPublicId: tutor.userPublicId,
          type: 'CLASS_SCHEDULED' as const,
          title: 'New skill program enrollment',
          body: 'A student enrolled in your skill program. Schedule their first session.',
          data: { programPublicId: payload.programPublicId },
        });
      } catch (e) {
        logger.error('Failed to create PROGRAM_ENROLLED notification', { error: e });
      }
    });
```

(Use an existing notification `type` value that fits; check `notification.types.ts` and pick the closest, e.g. `CLASS_SCHEDULED` or a generic `SYSTEM`.)

- [ ] **Step 6: Verify + commit** — `npx jest --runInBand && npx tsc --noEmit -p .` → all pass.
  `git add server/src && git commit -m "feat: skill program API routes and enrollment notification"`

---

### Task 5: Frontend — services, hooks, tutor pages

**Files:**
- Create: `frontend/src/constants/programs.ts`, `services/programs.service.ts`, `hooks/use-programs.ts`, `features/programs/ProgramForm.tsx`, `features/programs/ProgramEnrollmentView.tsx`, `pages/tutor/TutorProgramsPage.tsx`, `pages/tutor/TutorProgramPage.tsx`, `pages/tutor/TutorProgramEnrollmentPage.tsx`
- Modify: `features/courses/CourseStructureTree.tsx` (add `hideMaterials`), `routes/index.tsx`, `components/shared/Sidebar.tsx`

**Interfaces:**
- Consumes: Task 4 API.
- Produces: `programsService`, hooks `usePrograms(catalogParams)`, `useMyPrograms()`, `useProgram(id)`, `useCreateProgram()`, `useUpdateProgram()`, `useSetProgramStatus()`, `useDeleteProgram()`, `useProgramEnrollments(programId)`, `useEnroll()`, `useMyEnrollments()`, `useChildrenEnrollments()`, `useEnrollmentStructure(id)`, `useScheduleSession()`, `useCancelEnrollment()`, `useAdminPrograms(params)`, `useUnpublishProgram()`; `<ProgramForm program? onDone />`; `<ProgramEnrollmentView enrollmentPublicId backTo backLabel actions? />`; constants `PROGRAM_CATEGORIES`, `PROGRAM_LEVELS`, `categoryLabel(c)`, `levelLabel(l)`.

- [ ] **Step 1: Constants**

```ts
// frontend/src/constants/programs.ts
export const PROGRAM_CATEGORIES = [
  { value: 'ARTS', label: 'Arts & Crafts' },
  { value: 'MUSIC', label: 'Music' },
  { value: 'GAMES', label: 'Games & Chess' },
  { value: 'CODING', label: 'Coding & Software' },
  { value: 'AI_DATA', label: 'AI & Data' },
  { value: 'LANGUAGES', label: 'Languages' },
  { value: 'LIFE_SKILLS', label: 'Life Skills' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const PROGRAM_LEVELS = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
] as const;

export const categoryLabel = (c: string) => PROGRAM_CATEGORIES.find((x) => x.value === c)?.label ?? c;
export const levelLabel = (l: string) => PROGRAM_LEVELS.find((x) => x.value === l)?.label ?? l;
```

- [ ] **Step 2: Service**

```ts
// frontend/src/services/programs.service.ts
import { api } from '../lib/axios';
import type { AvailabilityWindow } from './courses.service';
import type { ProgressClass, StructureTopic } from './courses.service';

export interface ProgramModule { publicId: string; title: string; description?: string; order: number }

export interface Program {
  publicId: string;
  tutorPublicId: string;
  tutorName: string;
  title: string;
  category: string;
  description?: string;
  level: string;
  ageMin?: number;
  ageMax?: number;
  sessionCount: number;
  sessionMinutes: number;
  priceCents: number;
  maxEnrollees?: number;
  activeEnrollmentCount: number;
  isFull: boolean;
  modules: ProgramModule[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
}

export interface ProgramInput {
  title: string;
  category: string;
  description?: string;
  level: string;
  ageMin?: number;
  ageMax?: number;
  sessionCount: number;
  sessionMinutes: number;
  priceCents: number;
  maxEnrollees?: number;
  modules: Array<{ publicId?: string; title: string; description?: string }>;
}

export interface Enrollment {
  publicId: string;
  programPublicId: string;
  programTitle: string;
  programCategory: string;
  tutorName: string;
  studentName: string;
  sessionCount: number;
  sessionsScheduledCount: number;
  sessionsCompletedCount: number;
  priceCentsPaid: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  availabilityWindow: AvailabilityWindow;
  createdAt: string;
}

export interface EnrollmentStructure {
  viewerRole: 'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN';
  enrollment: {
    publicId: string; status: Enrollment['status']; sessionCount: number; sessionsScheduledCount: number;
    sessionsCompletedCount: number; availabilityWindow: AvailabilityWindow; tutorName: string; studentName: string;
  };
  program: { publicId: string; title: string; category: string; level: string; sessionMinutes: number; modules: ProgramModule[] };
  topics: StructureTopic[];
  otherClasses: ProgressClass[];
}

export interface PaginatedPrograms { items: Program[]; total: number; page: number; limit: number; totalPages: number }

export const programsService = {
  catalog: (params: Record<string, string>): Promise<PaginatedPrograms> => api.get('/programs', { params }).then((r) => r.data.data),
  mine: (): Promise<Program[]> => api.get('/programs/mine').then((r) => r.data.data),
  get: (id: string): Promise<Program> => api.get(`/programs/${id}`).then((r) => r.data.data),
  create: (dto: ProgramInput): Promise<Program> => api.post('/programs', dto).then((r) => r.data.data),
  update: (id: string, dto: Partial<ProgramInput>): Promise<Program> => api.put(`/programs/${id}`, dto).then((r) => r.data.data),
  setStatus: (id: string, action: 'publish' | 'archive'): Promise<Program> => api.post(`/programs/${id}/${action}`).then((r) => r.data.data),
  remove: (id: string): Promise<void> => api.delete(`/programs/${id}`).then(() => undefined),
  enrollments: (id: string): Promise<Enrollment[]> => api.get(`/programs/${id}/enrollments`).then((r) => r.data.data),
  enroll: (id: string, availabilityWindow: AvailabilityWindow): Promise<Enrollment> =>
    api.post(`/programs/${id}/enroll`, { availabilityWindow }).then((r) => r.data.data),
  myEnrollments: (): Promise<Enrollment[]> => api.get('/programs/enrollments/mine').then((r) => r.data.data),
  childrenEnrollments: (): Promise<Enrollment[]> => api.get('/programs/enrollments/children').then((r) => r.data.data),
  structure: (enrollmentId: string): Promise<EnrollmentStructure> =>
    api.get(`/programs/enrollments/${enrollmentId}/structure`).then((r) => r.data.data),
  scheduleSession: (enrollmentId: string, dto: { startUTC: string; endUTC: string; title: string; programModulePublicId: string }) =>
    api.post(`/programs/enrollments/${enrollmentId}/sessions`, dto).then((r) => r.data.data),
  cancel: (enrollmentId: string): Promise<Enrollment> => api.post(`/programs/enrollments/${enrollmentId}/cancel`).then((r) => r.data.data),
  adminList: (params: Record<string, string>): Promise<PaginatedPrograms> => api.get('/programs/admin', { params }).then((r) => r.data.data),
  unpublish: (id: string): Promise<Program> => api.post(`/programs/${id}/unpublish`).then((r) => r.data.data),
};
```

(Export `AvailabilityWindow` from `courses.service.ts` if it isn't already.)

- [ ] **Step 3: Hooks**

```ts
// frontend/src/hooks/use-programs.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { programsService } from '../services/programs.service';
import type { ProgramInput } from '../services/programs.service';
import type { AvailabilityWindow } from '../services/courses.service';
import { useToast } from '../components/ui/Toast';

export const programKeys = {
  all: ['programs'] as const,
  catalog: (p: Record<string, string>) => [...programKeys.all, 'catalog', p] as const,
  mine: () => [...programKeys.all, 'mine'] as const,
  detail: (id: string) => [...programKeys.all, 'detail', id] as const,
  enrollments: (id: string) => [...programKeys.all, 'enrollments', id] as const,
  myEnrollments: () => [...programKeys.all, 'my-enrollments'] as const,
  children: () => [...programKeys.all, 'children'] as const,
  structure: (id: string) => [...programKeys.all, 'structure', id] as const,
  admin: (p: Record<string, string>) => [...programKeys.all, 'admin', p] as const,
};

export const usePrograms = (params: Record<string, string>) =>
  useQuery({ queryKey: programKeys.catalog(params), queryFn: () => programsService.catalog(params) });
export const useMyPrograms = () => useQuery({ queryKey: programKeys.mine(), queryFn: programsService.mine });
export const useProgram = (id?: string) =>
  useQuery({ queryKey: programKeys.detail(id ?? ''), queryFn: () => programsService.get(id!), enabled: !!id });
export const useProgramEnrollments = (id?: string) =>
  useQuery({ queryKey: programKeys.enrollments(id ?? ''), queryFn: () => programsService.enrollments(id!), enabled: !!id });
export const useMyEnrollments = () => useQuery({ queryKey: programKeys.myEnrollments(), queryFn: programsService.myEnrollments });
export const useChildrenEnrollments = () => useQuery({ queryKey: programKeys.children(), queryFn: programsService.childrenEnrollments });
export const useEnrollmentStructure = (id?: string) =>
  useQuery({ queryKey: programKeys.structure(id ?? ''), queryFn: () => programsService.structure(id!), enabled: !!id });
export const useAdminPrograms = (params: Record<string, string>) =>
  useQuery({ queryKey: programKeys.admin(params), queryFn: () => programsService.adminList(params) });

function useProgramMutation<V, R>(fn: (v: V) => Promise<R>, ok: string, fail: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: programKeys.all }); qc.invalidateQueries({ queryKey: ['classes'] }); toast.success(ok); },
    onError: (err: Error) => toast.error(fail, err.message),
  });
}

export const useCreateProgram = () => useProgramMutation((dto: ProgramInput) => programsService.create(dto), 'Program created', 'Could not create program');
export const useUpdateProgram = () =>
  useProgramMutation(({ id, dto }: { id: string; dto: Partial<ProgramInput> }) => programsService.update(id, dto), 'Program updated', 'Could not update program');
export const useSetProgramStatus = () =>
  useProgramMutation(({ id, action }: { id: string; action: 'publish' | 'archive' }) => programsService.setStatus(id, action), 'Program updated', 'Could not update program');
export const useDeleteProgram = () => useProgramMutation((id: string) => programsService.remove(id), 'Program deleted', 'Could not delete program');
export const useEnroll = () =>
  useProgramMutation(({ id, availabilityWindow }: { id: string; availabilityWindow: AvailabilityWindow }) => programsService.enroll(id, availabilityWindow), 'Enrolled', 'Could not enroll');
export const useScheduleSession = () =>
  useProgramMutation(
    ({ enrollmentId, dto }: { enrollmentId: string; dto: { startUTC: string; endUTC: string; title: string; programModulePublicId: string } }) =>
      programsService.scheduleSession(enrollmentId, dto),
    'Session scheduled', 'Could not schedule session');
export const useCancelEnrollment = () =>
  useProgramMutation((enrollmentId: string) => programsService.cancel(enrollmentId), 'Enrollment cancelled', 'Could not cancel enrollment');
export const useUnpublishProgram = () => useProgramMutation((id: string) => programsService.unpublish(id), 'Program unpublished', 'Could not unpublish');
```

- [ ] **Step 4: Tree option** — `CourseStructureTree`/`TopicNode`: add optional prop `hideMaterials?: boolean`; when set, skip the Materials block. Pass it through like `hideClasses`.

- [ ] **Step 5: Program form**

```tsx
// frontend/src/features/programs/ProgramForm.tsx
import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PROGRAM_CATEGORIES, PROGRAM_LEVELS } from '../../constants/programs';
import { useCreateProgram, useUpdateProgram } from '../../hooks/use-programs';
import type { Program, ProgramInput } from '../../services/programs.service';

type ModuleDraft = { publicId?: string; title: string; description?: string };
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

/** Create or edit a program. Price/sessions are locked server-side once students enrol. */
export function ProgramForm({ program, onDone }: { program?: Program; onDone: () => void }) {
  const { mutate: create, isPending: creating } = useCreateProgram();
  const { mutate: update, isPending: updating } = useUpdateProgram();
  const [title, setTitle] = useState(program?.title ?? '');
  const [category, setCategory] = useState(program?.category ?? 'GAMES');
  const [level, setLevel] = useState(program?.level ?? 'BEGINNER');
  const [description, setDescription] = useState(program?.description ?? '');
  const [ageMin, setAgeMin] = useState(program?.ageMin?.toString() ?? '');
  const [ageMax, setAgeMax] = useState(program?.ageMax?.toString() ?? '');
  const [sessionCount, setSessionCount] = useState(String(program?.sessionCount ?? 8));
  const [sessionMinutes, setSessionMinutes] = useState(String(program?.sessionMinutes ?? 60));
  const [price, setPrice] = useState(program ? (program.priceCents / 100).toFixed(2) : '');
  const [maxEnrollees, setMaxEnrollees] = useState(program?.maxEnrollees?.toString() ?? '');
  const [modules, setModules] = useState<ModuleDraft[]>(program ? [...program.modules].sort((a, b) => a.order - b.order) : [{ title: '' }]);
  const locked = !!program && program.activeEnrollmentCount > 0;

  const ready = title.trim() && modules.length > 0 && modules.every((m) => m.title.trim()) && Number(sessionCount) >= 1 && price !== '';

  const save = () => {
    const dto: ProgramInput = {
      title: title.trim(),
      category,
      level,
      description: description.trim() || undefined,
      ageMin: num(ageMin),
      ageMax: num(ageMax),
      sessionCount: Number(sessionCount),
      sessionMinutes: Number(sessionMinutes),
      priceCents: Math.round(Number(price) * 100),
      maxEnrollees: num(maxEnrollees),
      modules: modules.map((m) => ({ publicId: m.publicId, title: m.title.trim(), description: m.description?.trim() || undefined })),
    };
    if (program) update({ id: program.publicId, dto }, { onSuccess: onDone });
    else create(dto, { onSuccess: onDone });
  };

  return (
    <Card className="mb-4">
      <CardContent className="space-y-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{program ? 'Edit program' : 'New skill program'}</p>
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chess for Beginners" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Category" options={[...PROGRAM_CATEGORIES]} value={category} onChange={(e) => setCategory(e.target.value)} />
          <Select label="Level" options={[...PROGRAM_LEVELS]} value={level} onChange={(e) => setLevel(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={4000}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Min age (optional)" type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
          <Input label="Max age (optional)" type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
          <Input label="Max students (optional)" type="number" value={maxEnrollees} onChange={(e) => setMaxEnrollees(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Sessions" type="number" value={sessionCount} onChange={(e) => setSessionCount(e.target.value)} disabled={locked} />
          <Input label="Minutes per session" type="number" value={sessionMinutes} onChange={(e) => setSessionMinutes(e.target.value)} />
          <Input label="Total price ($)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} disabled={locked} />
        </div>
        {locked && <p className="text-xs text-gray-500">Students have enrolled: sessions and price are locked, and modules can only be added.</p>}

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Modules (in order)</p>
          {modules.map((m, i) => (
            <div key={m.publicId ?? `new-${i}`} className="flex items-center gap-2">
              <span className="w-6 text-xs text-gray-400">{i + 1}.</span>
              <input value={m.title} onChange={(e) => setModules((ms) => ms.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                placeholder="Module title" className="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm" />
              {!(locked && m.publicId) && (
                <button type="button" aria-label="Remove module" onClick={() => setModules((ms) => ms.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setModules((ms) => [...ms, { title: '' }])}><Plus className="h-3.5 w-3.5" /> Add module</Button>
        </div>

        <div className="flex gap-2">
          <Button variant="gradient" loading={creating || updating} disabled={!ready} onClick={save}>
            <Save className="h-3.5 w-3.5" /> {program ? 'Save changes' : 'Save program'}
          </Button>
          <Button variant="outline" onClick={onDone}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Enrollment view (shared by tutor, student, parent pages)**

```tsx
// frontend/src/features/programs/ProgramEnrollmentView.tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Loading';
import { useEnrollmentStructure } from '../../hooks/use-programs';
import { CourseStructureTree } from '../courses/CourseStructureTree';
import { categoryLabel, levelLabel } from '../../constants/programs';

export function ProgramEnrollmentView({ enrollmentPublicId, backTo, backLabel, actions }: {
  enrollmentPublicId?: string;
  backTo: string;
  backLabel: string;
  actions?: ReactNode;
}) {
  const { data, isLoading, isError } = useEnrollmentStructure(enrollmentPublicId);
  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (isError || !data) {
    return <div className="py-16 text-center text-sm text-gray-500">Enrollment not found. <Link to={backTo} className="text-brand-600 hover:underline">{backLabel}</Link></div>;
  }
  const { enrollment, program, topics, otherClasses, viewerRole } = data;
  const showStatus = viewerRole === 'STUDENT' || viewerRole === 'PARENT';
  const pct = enrollment.sessionCount ? Math.round((enrollment.sessionsCompletedCount / enrollment.sessionCount) * 100) : 0;
  const who = viewerRole === 'TUTOR' ? `for ${enrollment.studentName}` : `with ${enrollment.tutorName}`;

  return (
    <div className="animate-fade-in">
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </Link>
      <PageHeader
        eyebrow="Skill program"
        title={program.title}
        description={`${categoryLabel(program.category)} · ${levelLabel(program.level)} · ${who}`}
        icon={<Sparkles className="h-5 w-5" />}
        actions={actions}
      />
      <Card className="mb-4">
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-gray-900 dark:text-white">
              {enrollment.sessionsCompletedCount}/{enrollment.sessionCount} sessions completed
            </span>
            <span className="text-xs text-gray-500">{enrollment.sessionsScheduledCount} scheduled · {enrollment.status.toLowerCase()}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden>
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <CourseStructureTree topics={topics} otherClasses={otherClasses} showStatus={showStatus} hideMaterials onOpenMaterial={() => undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Tutor pages**

```tsx
// frontend/src/pages/tutor/TutorProgramsPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Plus, Eye, Archive, Trash2, Pencil } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { Tabs } from '../../components/ui/Tabs';
import { ProgramForm } from '../../features/programs/ProgramForm';
import { useMyPrograms, useSetProgramStatus, useDeleteProgram } from '../../hooks/use-programs';
import { categoryLabel, levelLabel } from '../../constants/programs';
import { formatCurrency } from '../../utils/currency';
import type { Program } from '../../services/programs.service';

const TABS = [
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'ARCHIVED', label: 'Archived' },
];

export function TutorProgramsPage() {
  const [tab, setTab] = useState('PUBLISHED');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const { data: programs = [], isLoading } = useMyPrograms();
  const { mutate: setStatus } = useSetProgramStatus();
  const { mutate: remove } = useDeleteProgram();
  const list = programs.filter((p) => p.status === tab);

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Tutor Studio"
        title="Skill Programs"
        description="Your own programs outside the school curriculum — arts, games, coding, AI and more."
        icon={<Sparkles className="h-5 w-5" />}
        actions={<Button variant="gradient" onClick={() => { setEditing(null); setCreating(true); }}><Plus className="h-3.5 w-3.5" /> New program</Button>}
      />
      {creating && <ProgramForm onDone={() => setCreating(false)} />}
      {editing && <ProgramForm key={editing.publicId} program={editing} onDone={() => setEditing(null)} />}
      <Tabs className="mb-4" tabs={TABS} activeTab={tab} onChange={setTab} />
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : list.length === 0 ? (
        <Card><CardContent><p className="py-10 text-center text-sm text-gray-500">No {tab.toLowerCase()} programs.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <Card key={p.publicId}>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/dashboard/tutor/programs/${p.publicId}`} className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{p.title}</p>
                    <p className="text-xs text-gray-500">
                      {categoryLabel(p.category)} · {levelLabel(p.level)} · {p.sessionCount} sessions · {formatCurrency(p.priceCents)}
                      {' · '}{p.activeEnrollmentCount}{p.maxEnrollees ? `/${p.maxEnrollees}` : ''} active students
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    {p.isFull && <Badge variant="warning" tone="soft">Full</Badge>}
                    <Button size="sm" variant="outline" onClick={() => { setCreating(false); setEditing(p); }}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    {p.status !== 'PUBLISHED' && (
                      <Button size="sm" variant="outline" onClick={() => setStatus({ id: p.publicId, action: 'publish' })}><Eye className="h-3.5 w-3.5" /> Publish</Button>
                    )}
                    {p.status === 'PUBLISHED' && (
                      <Button size="sm" variant="outline" onClick={() => setStatus({ id: p.publicId, action: 'archive' })}><Archive className="h-3.5 w-3.5" /> Archive</Button>
                    )}
                    {p.activeEnrollmentCount === 0 && (
                      <Button size="sm" variant="outline" aria-label={`Delete ${p.title}`} onClick={() => remove(p.publicId)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

```tsx
// frontend/src/pages/tutor/TutorProgramPage.tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Sparkles, Users } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useProgram, useProgramEnrollments, useScheduleSession } from '../../hooks/use-programs';
import { categoryLabel, levelLabel } from '../../constants/programs';
import type { Enrollment, ProgramModule } from '../../services/programs.service';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ScheduleForm({ enrollment, modules, sessionMinutes, programTitle }: {
  enrollment: Enrollment; modules: ProgramModule[]; sessionMinutes: number; programTitle: string;
}) {
  const [start, setStart] = useState('');
  const [moduleId, setModuleId] = useState('');
  const { mutate: schedule, isPending } = useScheduleSession();
  const w = enrollment.availabilityWindow;
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
      <p className="text-xs text-gray-500">
        Available {w.daysOfWeek.map((d) => DAYS[d]).join(', ')} · {w.startLocalTime}–{w.endLocalTime} ({w.ianaTimezone}) · {sessionMinutes} min sessions
      </p>
      <div className="flex flex-wrap gap-2">
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
        <select required value={moduleId} onChange={(e) => setModuleId(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900">
          <option value="" disabled>Module this session covers *</option>
          {[...modules].sort((a, b) => a.order - b.order).map((m) => <option key={m.publicId} value={m.publicId}>{m.title}</option>)}
        </select>
        <Button size="sm" variant="gradient" loading={isPending} disabled={!start || !moduleId}
          onClick={() => {
            const s = new Date(start);
            const e = new Date(s.getTime() + sessionMinutes * 60_000);
            const title = `${programTitle} — ${modules.find((m) => m.publicId === moduleId)?.title ?? 'Session'}`;
            schedule({ enrollmentId: enrollment.publicId, dto: { startUTC: s.toISOString(), endUTC: e.toISOString(), title, programModulePublicId: moduleId } });
          }}>
          <CalendarPlus className="h-3.5 w-3.5" /> Schedule session
        </Button>
      </div>
    </div>
  );
}

export function TutorProgramPage() {
  const { programPublicId } = useParams<{ programPublicId: string }>();
  const { data: program, isLoading } = useProgram(programPublicId);
  const { data: enrollments = [] } = useProgramEnrollments(programPublicId);
  const [open, setOpen] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!program) return <div className="py-16 text-center text-sm text-gray-500">Program not found.</div>;

  return (
    <div className="animate-fade-in">
      <Link to="/dashboard/tutor/programs" className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Skill Programs
      </Link>
      <PageHeader eyebrow="Skill program" title={program.title}
        description={`${categoryLabel(program.category)} · ${levelLabel(program.level)} · ${program.sessionCount} sessions`}
        icon={<Sparkles className="h-5 w-5" />} />
      <Card>
        <CardContent>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-gray-400" /> Students</p>
          {enrollments.length === 0 ? (
            <p className="text-sm text-gray-500">No students yet.</p>
          ) : (
            <ul className="space-y-3">
              {enrollments.map((e) => (
                <li key={e.publicId} className="rounded-lg border border-rule p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{e.studentName}</p>
                      <p className="text-xs text-gray-500">{e.sessionsScheduledCount}/{e.sessionCount} scheduled · {e.sessionsCompletedCount} completed</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="soft" variant={e.status === 'ACTIVE' ? 'info' : e.status === 'COMPLETED' ? 'success' : 'default'}>{e.status}</Badge>
                      <Link to={`/dashboard/tutor/programs/enrollments/${e.publicId}`}><Button size="sm" variant="outline">View</Button></Link>
                      {e.status === 'ACTIVE' && e.sessionsScheduledCount < e.sessionCount && (
                        <Button size="sm" variant="outline" onClick={() => setOpen(open === e.publicId ? null : e.publicId)}>
                          <CalendarPlus className="h-3.5 w-3.5" /> Schedule next session
                        </Button>
                      )}
                    </div>
                  </div>
                  {open === e.publicId && (
                    <ScheduleForm enrollment={e} modules={program.modules} sessionMinutes={program.sessionMinutes} programTitle={program.title} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

```tsx
// frontend/src/pages/tutor/TutorProgramEnrollmentPage.tsx
import { useParams } from 'react-router-dom';
import { ProgramEnrollmentView } from '../../features/programs/ProgramEnrollmentView';

export function TutorProgramEnrollmentPage() {
  const { enrollmentPublicId } = useParams<{ enrollmentPublicId: string }>();
  return <ProgramEnrollmentView enrollmentPublicId={enrollmentPublicId} backTo="/dashboard/tutor/programs" backLabel="Skill Programs" />;
}
```

Routes: `/dashboard/tutor/programs` → `TutorProgramsPage`, `/dashboard/tutor/programs/enrollments/:enrollmentPublicId` → `TutorProgramEnrollmentPage` (declare before) `/dashboard/tutor/programs/:programPublicId` → `TutorProgramPage`. Sidebar TUTOR: `{ label: 'Skill Programs', href: '/dashboard/tutor/programs', icon: Sparkles },` after Course Requests (import `Sparkles` if absent).

- [ ] **Step 8: Verify + commit** — `npx tsc --noEmit -p . && npx vite build` → clean.
  `git add frontend/src && git commit -m "feat(frontend): tutor skill program pages"`

---

### Task 6: Frontend — student, parent, admin

**Files:**
- Create: `features/programs/MyProgramsSection.tsx`, `pages/student/StudentSkillsPage.tsx`, `pages/student/StudentProgramPage.tsx`, `pages/student/StudentProgramEnrollmentPage.tsx`, `pages/parent/ParentProgramEnrollmentPage.tsx`, `pages/admin/AdminProgramsPage.tsx`
- Modify: `pages/dashboards/StudentDashboard.tsx`, `pages/parent/ParentCoursesPage.tsx`, `routes/index.tsx`, `components/shared/Sidebar.tsx`

**Interfaces:**
- Consumes: Task 5 hooks, `ProgramEnrollmentView`, constants.

- [ ] **Step 1: Student catalog**

```tsx
// frontend/src/pages/student/StudentSkillsPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Loading';
import { usePrograms } from '../../hooks/use-programs';
import { PROGRAM_CATEGORIES, PROGRAM_LEVELS, categoryLabel, levelLabel } from '../../constants/programs';
import { formatCurrency } from '../../utils/currency';

export function StudentSkillsPage() {
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [age, setAge] = useState('');
  const [q, setQ] = useState('');
  const params: Record<string, string> = { limit: '48' };
  if (category) params.category = category;
  if (level) params.level = level;
  if (age) params.age = age;
  if (q.trim()) params.q = q.trim();
  const { data, isLoading } = usePrograms(params);
  const programs = data?.items ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Beyond school" title="Skills" description="Programs from tutors: arts, music, chess, coding, AI and more." icon={<Sparkles className="h-5 w-5" />} />
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. chess" />
        <Select label="Category" placeholder="All categories" options={[{ value: '', label: 'All categories' }, ...PROGRAM_CATEGORIES]} value={category} onChange={(e) => setCategory(e.target.value)} />
        <Select label="Level" placeholder="All levels" options={[{ value: '', label: 'All levels' }, ...PROGRAM_LEVELS]} value={level} onChange={(e) => setLevel(e.target.value)} />
        <Input label="Age" type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Any" />
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : programs.length === 0 ? (
        <Card><CardContent><p className="py-10 text-center text-sm text-gray-500">No programs match these filters yet.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <Link key={p.publicId} to={`/dashboard/student/skills/${p.publicId}`}>
              <Card className="h-full hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                <CardContent>
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="purple" tone="soft">{categoryLabel(p.category)}</Badge>
                    {p.isFull && <Badge variant="warning" tone="soft">Full</Badge>}
                  </div>
                  <p className="mt-2 font-semibold text-gray-900 dark:text-white">{p.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">with {p.tutorName}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    {levelLabel(p.level)} · {p.sessionCount} sessions{p.ageMin || p.ageMax ? ` · ages ${p.ageMin ?? '?'}–${p.ageMax ?? '?'}` : ''}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(p.priceCents)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Program page + enroll**

```tsx
// frontend/src/pages/student/StudentProgramPage.tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useProgram, useEnroll, useMyEnrollments } from '../../hooks/use-programs';
import { categoryLabel, levelLabel } from '../../constants/programs';
import { formatCurrency } from '../../utils/currency';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StudentProgramPage() {
  const { programPublicId } = useParams<{ programPublicId: string }>();
  const navigate = useNavigate();
  const { data: program, isLoading } = useProgram(programPublicId);
  const { data: mine = [] } = useMyEnrollments();
  const { mutate: enroll, isPending } = useEnroll();
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [startLocalTime, setStart] = useState('16:00');
  const [endLocalTime, setEnd] = useState('19:00');

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!program) return <div className="py-16 text-center text-sm text-gray-500">Program not found.</div>;
  const active = mine.find((e) => e.programPublicId === program.publicId && e.status === 'ACTIVE');
  const toggle = (d: number) => setDays((s) => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n; });

  return (
    <div className="animate-fade-in">
      <Link to="/dashboard/student/skills" className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Skills
      </Link>
      <PageHeader eyebrow={categoryLabel(program.category)} title={program.title}
        description={`with ${program.tutorName} · ${levelLabel(program.level)} · ${program.sessionCount} × ${program.sessionMinutes} min`}
        icon={<Sparkles className="h-5 w-5" />} />
      <Card className="mb-4">
        <CardContent className="space-y-3">
          {program.description && <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{program.description}</p>}
          <div>
            <p className="mb-1.5 text-sm font-semibold">What you'll cover</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
              {[...program.modules].sort((a, b) => a.order - b.order).map((m) => <li key={m.publicId}>{m.title}</li>)}
            </ol>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3">
          {active ? (
            <p className="text-sm">You're enrolled. <Link to={`/dashboard/student/skills/enrollments/${active.publicId}`} className="text-brand-600 hover:underline">Open your program</Link></p>
          ) : program.isFull ? (
            <Badge variant="warning" tone="soft">This program is full</Badge>
          ) : (
            <>
              <p className="text-sm font-semibold">When are you free?</p>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((label, i) => (
                  <button key={label} type="button" onClick={() => toggle(i)}
                    className={`h-8 w-10 rounded-lg text-xs font-medium ${days.has(i) ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="time" value={startLocalTime} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
                <span className="text-xs text-gray-400">to</span>
                <input type="time" value={endLocalTime} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
              </div>
              <Button variant="gradient" loading={isPending} disabled={days.size === 0}
                onClick={() => enroll(
                  { id: program.publicId, availabilityWindow: { daysOfWeek: [...days], startLocalTime, endLocalTime, ianaTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone } },
                  { onSuccess: (e) => navigate(`/dashboard/student/skills/enrollments/${e.publicId}`) },
                )}>
                Enroll · {formatCurrency(program.priceCents)}
              </Button>
              <p className="text-xs text-gray-500">The full price is charged from your wallet now. Sessions you don't take are refunded if you cancel.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

```tsx
// frontend/src/pages/student/StudentProgramEnrollmentPage.tsx
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ProgramEnrollmentView } from '../../features/programs/ProgramEnrollmentView';
import { useCancelEnrollment, useMyEnrollments } from '../../hooks/use-programs';

export function StudentProgramEnrollmentPage() {
  const { enrollmentPublicId } = useParams<{ enrollmentPublicId: string }>();
  const { data: mine = [] } = useMyEnrollments();
  const { mutate: cancel, isPending } = useCancelEnrollment();
  const active = mine.find((e) => e.publicId === enrollmentPublicId)?.status === 'ACTIVE';
  return (
    <ProgramEnrollmentView
      enrollmentPublicId={enrollmentPublicId}
      backTo="/dashboard"
      backLabel="Dashboard"
      actions={active && (
        <Button variant="outline" loading={isPending} onClick={() => {
          if (window.confirm('Cancel this program? Sessions not yet taken will be refunded.')) cancel(enrollmentPublicId!);
        }}>Cancel enrollment</Button>
      )}
    />
  );
}
```

- [ ] **Step 3: Dashboard + parent + admin**

```tsx
// frontend/src/features/programs/MyProgramsSection.tsx
import { Link } from 'react-router-dom';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { useMyEnrollments } from '../../hooks/use-programs';
import { categoryLabel } from '../../constants/programs';

export function MyProgramsSection() {
  const { data = [] } = useMyEnrollments();
  const enrollments = data.filter((e) => e.status !== 'CANCELLED');
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>My skill programs</CardTitle>
          <p className="mt-1 text-xs text-gray-500">Extracurricular programs you're taking</p>
        </div>
        <Link to="/dashboard/student/skills" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
          Browse skills <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {enrollments.length === 0 ? (
          <EmptyState compact icon={<Sparkles className="h-6 w-6" />} title="No skill programs yet"
            description="Explore arts, chess, coding, AI and more."
            action={<Link to="/dashboard/student/skills"><Button size="sm" variant="gradient">Browse skills</Button></Link>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((e) => {
              const pct = e.sessionCount ? Math.round((e.sessionsCompletedCount / e.sessionCount) * 100) : 0;
              return (
                <Link key={e.publicId} to={`/dashboard/student/skills/enrollments/${e.publicId}`} className="rounded-xl border border-rule p-4 hover:border-brand-300">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white">{e.programTitle}</p>
                    <Badge variant={e.status === 'COMPLETED' ? 'success' : 'purple'} tone="soft">{e.status === 'COMPLETED' ? 'Completed' : categoryLabel(e.programCategory)}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">with {e.tutorName}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden>
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{e.sessionsCompletedCount}/{e.sessionCount} sessions completed</p>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

`StudentDashboard.tsx`: import and render `<MyProgramsSection />` right after `<MyCoursesSection />`.

```tsx
// frontend/src/pages/parent/ParentProgramEnrollmentPage.tsx
import { useParams } from 'react-router-dom';
import { ProgramEnrollmentView } from '../../features/programs/ProgramEnrollmentView';

export function ParentProgramEnrollmentPage() {
  const { enrollmentPublicId } = useParams<{ enrollmentPublicId: string }>();
  return <ProgramEnrollmentView enrollmentPublicId={enrollmentPublicId} backTo="/dashboard/parent/courses" backLabel="Courses" />;
}
```

`ParentCoursesPage.tsx`: `const { data: programs = [] } = useChildrenEnrollments();` and, after the courses sections, render when `programs.length > 0`:

```tsx
      {programs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Skill programs</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((e) => (
              <Link key={e.publicId} to={`/dashboard/parent/programs/${e.publicId}`} className="rounded-xl border border-rule p-4 hover:border-brand-300">
                <p className="font-semibold text-gray-900 dark:text-white">{e.programTitle}</p>
                <p className="mt-0.5 text-xs text-gray-500">{e.studentName} · with {e.tutorName}</p>
                <p className="mt-1 text-xs text-gray-500">{e.sessionsCompletedCount}/{e.sessionCount} sessions completed</p>
              </Link>
            ))}
          </div>
        </section>
      )}
```

(Also show the page — not the "No courses yet" empty card — when there are programs but no courses.)

```tsx
// frontend/src/pages/admin/AdminProgramsPage.tsx
import { useState } from 'react';
import { Sparkles, EyeOff } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { Tabs } from '../../components/ui/Tabs';
import { useAdminPrograms, useUnpublishProgram } from '../../hooks/use-programs';
import { categoryLabel, levelLabel } from '../../constants/programs';
import { formatCurrency } from '../../utils/currency';

const TABS = [{ key: 'PUBLISHED', label: 'Published' }, { key: 'DRAFT', label: 'Drafts' }, { key: 'ARCHIVED', label: 'Archived' }];

export function AdminProgramsPage() {
  const [status, setStatus] = useState('PUBLISHED');
  const { data, isLoading } = useAdminPrograms({ status, limit: '50' });
  const { mutate: unpublish } = useUnpublishProgram();
  const programs = data?.items ?? [];
  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Platform" title="Skill Programs" description="Tutor-created extracurricular programs." icon={<Sparkles className="h-5 w-5" />} />
      <Tabs className="mb-4" tabs={TABS} activeTab={status} onChange={setStatus} />
      {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : programs.length === 0 ? (
        <Card><CardContent><p className="py-10 text-center text-sm text-gray-500">No programs.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <Card key={p.publicId}>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{p.title}</p>
                    <p className="text-xs text-gray-500">{p.tutorName} · {categoryLabel(p.category)} · {levelLabel(p.level)} · {p.sessionCount} sessions · {formatCurrency(p.priceCents)} · {p.activeEnrollmentCount} active</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="soft" variant={p.status === 'PUBLISHED' ? 'success' : 'default'}>{p.status}</Badge>
                    {p.status === 'PUBLISHED' && (
                      <Button size="sm" variant="outline" onClick={() => unpublish(p.publicId)}><EyeOff className="h-3.5 w-3.5" /> Unpublish</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Routes + sidebar**

Routes: student `/dashboard/student/skills` → `StudentSkillsPage`, `/dashboard/student/skills/enrollments/:enrollmentPublicId` → `StudentProgramEnrollmentPage` (before) `/dashboard/student/skills/:programPublicId` → `StudentProgramPage`; parent `/dashboard/parent/programs/:enrollmentPublicId` → `ParentProgramEnrollmentPage`; admin `/dashboard/admin/programs` and `/dashboard/super-admin/programs` → `AdminProgramsPage`.
Sidebar: STUDENT `{ label: 'Skills', href: '/dashboard/student/skills', icon: Sparkles }` after My courses; ADMIN and SUPER_ADMIN `{ label: 'Skill Programs', href: '/dashboard/{admin|super-admin}/programs', icon: Sparkles }` after Curriculum.

- [ ] **Step 5: Verify + commit** — `npx tsc --noEmit -p . && npx vite build` → clean.
  `git add frontend/src && git commit -m "feat(frontend): student, parent and admin skill program pages"`

---

### Task 7: Final verification

- [ ] `cd server && npx jest --runInBand` → all pass; `npx tsc --noEmit -p .` → clean.
- [ ] `cd frontend && npx tsc --noEmit -p . && npx vite build` → clean.
- [ ] Report: no DB migration needed (new collections; new optional class fields); manual smoke per role not run without a non-production DB.
