# Course / Curriculum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Admin/SuperAdmin author county+grade curricula ("Courses") with ordered Topics + attached content, let Students browse and request a Tutor-reviewed, multi-class series against selected topics, and let the accepting Tutor schedule and get paid for that prepaid series.

**Architecture:** Two new Mongoose modules (`courses/`, `course-requests/`) following the exact `demo-requests/` module shape. `ScheduledClass` gets three new optional link fields and a new `BillingMode.COURSE_PREPAID` so course classes reuse the existing class lifecycle (`bookClass`-adjacent `ScheduledClassModel.create`, `completeClass`, `cancelClass`, `refundClass`) instead of a parallel booking/settlement engine. Frontend adds a Course catalog + request flow (Student), a Course Requests inbox + scheduler (Tutor), and a Curriculum editor (Admin/SuperAdmin), wired into the existing role-keyed Sidebar/routes.

**Tech Stack:** Express + Mongoose + Zod (server), React + TanStack Query + react-router (frontend), Jest (tests).

**Spec:** `docs/superpowers/specs/2026-09-23-course-curriculum-design.md`

## Global Constraints

- Course = curriculum/content container only; never a live session. (Spec §2)
- Only `Role.SUPER_ADMIN` / `Role.ADMIN` author Courses. (Spec §2)
- Students self-discover via a county+grade-filtered catalog; no push-assignment. (Spec §2)
- `CourseRequest` is strictly 1 Student : 1 Tutor. Never batch/group. (Spec §2)
- No fixed recurrence engine — Tutor books each of the `classesRequired` classes individually, any time inside the Student's stated `availabilityWindow`. (Spec §2)
- Content-per-class assignment (`courseTopicPublicId`) is a manual Tutor choice per class, never auto-sequenced. (Spec §2)
- Full `classesRequired × costCentsPerClass` is charged to the student at **Accept** time, not per class. (Spec §2, §5)
- `ScheduledClass`'s existing fields/behavior for non-course bookings must not change — all new fields are optional/nullable. (Spec §3.4)
- New `BillingMode.COURSE_PREPAID`: `completeClass()` must NOT re-debit the student (already paid) but MUST still credit the tutor `(costCents − platformFee)`. `cancelClass()` MUST refund `costCents` to the student and decrement `classesScheduledCount` (opposite of `STUDENT_REQUESTED`, which refunds nothing on cancel). (Spec §3.4, §5)
- Scheduling a course class goes through a **dedicated** `POST /course-requests/:id/schedule-class` endpoint, not the bulk `POST /classes/tutor/create`. (Spec §4)

---

### Task 1: `ScheduledClass` course fields + `BillingMode.COURSE_PREPAID`

**Files:**
- Modify: `server/src/modules/schedules/schedule.types.ts`
- Modify: `server/src/modules/schedules/schedule.model.ts`
- Test: `server/src/tests/modules/schedule.model.test.ts` (new)

**Interfaces:**
- Produces: `BillingMode.COURSE_PREPAID` (string literal `'COURSE_PREPAID'`); `IScheduledClass.courseRequestPublicId?: string`, `.coursePublicId?: string`, `.courseTopicPublicId?: string`.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/tests/modules/schedule.model.test.ts
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { BillingMode, ClassStatus, ClassType } from '../../modules/schedules/schedule.types';

describe('ScheduledClass course fields', () => {
  it('accepts COURSE_PREPAID billing mode and optional course link fields', () => {
    const doc = new ScheduledClassModel({
      publicId: 'class-1',
      tutorPublicId: 'tutor-1',
      studentPublicId: 'student-1',
      classType: ClassType.ONE_ON_ONE,
      status: ClassStatus.SCHEDULED,
      startUTC: new Date(),
      endUTC: new Date(),
      ianaTimezone: 'UTC',
      durationMinutes: 60,
      title: 'Algebra I – Topic 2',
      costCents: 1500,
      billingMode: BillingMode.COURSE_PREPAID,
      idempotencyKey: 'course-class-1',
      courseRequestPublicId: 'cr-1',
      coursePublicId: 'course-1',
      courseTopicPublicId: 'topic-2',
      isDeleted: false,
    });

    const err = doc.validateSync();
    expect(err).toBeUndefined();
    expect(doc.billingMode).toBe('COURSE_PREPAID');
    expect(doc.courseRequestPublicId).toBe('cr-1');
  });

  it('still allows a plain class with no course fields', () => {
    const doc = new ScheduledClassModel({
      publicId: 'class-2',
      tutorPublicId: 'tutor-1',
      studentPublicId: 'student-1',
      classType: ClassType.ONE_ON_ONE,
      status: ClassStatus.SCHEDULED,
      startUTC: new Date(),
      endUTC: new Date(),
      ianaTimezone: 'UTC',
      durationMinutes: 60,
      title: 'Regular class',
      costCents: 1500,
      idempotencyKey: 'plain-class-2',
      isDeleted: false,
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.courseRequestPublicId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest schedule.model.test.ts -t "course"`
Expected: FAIL — `billingMode` rejects `'COURSE_PREPAID'` (not in enum) and the course fields are `undefined`/stripped because they're not in the schema yet.

- [ ] **Step 3: Implement**

In `server/src/modules/schedules/schedule.types.ts`, update the `BillingMode` const and its doc comment, and add the three fields to `IScheduledClass`:

```typescript
/**
 * How a class is billed on completion:
 * - STUDENT_REQUESTED: student booked the tutor. Student pays (rate + platform fee),
 *   tutor earns (rate − platform fee). Platform keeps a fee from both sides.
 * - TUTOR_INVITED: tutor created the class and invited students. Students attend free;
 *   the tutor pays the platform fee (both sides) and earns nothing.
 * - COURSE_PREPAID: student already paid the full course-request series up front
 *   (see CourseRequest). On completion the student is NOT charged again — only
 *   the tutor earns (rate − platform fee), same math as STUDENT_REQUESTED. On
 *   cancellation (unlike STUDENT_REQUESTED) the class's cost IS refunded, because
 *   it was already collected.
 */
export const BillingMode = {
  STUDENT_REQUESTED: 'STUDENT_REQUESTED',
  TUTOR_INVITED: 'TUTOR_INVITED',
  COURSE_PREPAID: 'COURSE_PREPAID',
} as const;
export type BillingMode = (typeof BillingMode)[keyof typeof BillingMode];
```

Add to `IScheduledClass` (after `isRefunded?`/`refundedAt?`, before `isDeleted`):

```typescript
  /** Set only when this class was scheduled against an accepted CourseRequest. */
  courseRequestPublicId?: string;
  coursePublicId?: string;
  courseTopicPublicId?: string;
```

In `server/src/modules/schedules/schedule.model.ts`, add the three fields to `scheduledClassSchema` (after `refundedAt`, before `isDeleted`):

```typescript
    courseRequestPublicId: { type: String, index: true },
    coursePublicId: { type: String },
    courseTopicPublicId: { type: String },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest schedule.model.test.ts -t "course"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/schedules/schedule.types.ts server/src/modules/schedules/schedule.model.ts server/src/tests/modules/schedule.model.test.ts
git commit -m "feat: add COURSE_PREPAID billing mode and course link fields to ScheduledClass"
```

---

### Task 2: `completeClass` / `cancelClass` COURSE_PREPAID branches

**Files:**
- Modify: `server/src/modules/classes/class.service.ts`
- Test: `server/src/tests/modules/class.course-billing.test.ts` (new)

**Interfaces:**
- Consumes: `BillingMode.COURSE_PREPAID` (Task 1). `walletService.debitWallet`, `.creditWallet`, `.refundWallet` (existing, `server/src/modules/wallets/wallet.service.ts`).
- Produces: `ClassService.completeClass` and `.cancelClass` now branch on `COURSE_PREPAID` in addition to their existing `STUDENT_REQUESTED`/`TUTOR_INVITED` branches. No new exported symbols — same public method signatures.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/tests/modules/class.course-billing.test.ts
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ClassStatus, ClassType, BillingMode } from '../../modules/schedules/schedule.types';
import { walletService } from '../../modules/wallets/wallet.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { attendanceService } from '../../modules/attendance/attendance.service';
import { studentService } from '../../modules/students/student.service';
import { scheduleService } from '../../modules/schedules/schedule.service';
import { tutorRepository } from '../../modules/tutors/tutor.repository';
import { domainEvents } from '../../events/event-emitter';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

function coursePrepaidClass(over: Record<string, unknown> = {}) {
  return {
    publicId: 'course-class-1',
    tutorPublicId: 'tutor-prof-1',
    studentPublicId: 'student-prof-1',
    status: ClassStatus.LIVE,
    classType: ClassType.ONE_ON_ONE,
    costCents: 1500, // rate for this course class
    billingMode: BillingMode.COURSE_PREPAID,
    durationMinutes: 60,
    title: 'Algebra I – Topic 2',
    studentJoinedAt: new Date(),
    courseRequestPublicId: 'cr-1',
    ...over,
  };
}

describe('ClassService COURSE_PREPAID billing', () => {
  let debit: jest.SpyInstance;
  let credit: jest.SpyInstance;
  let refund: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'student-user-1' }) as never);
    jest.spyOn(tutorService, 'getByPublicId').mockResolvedValue({ userPublicId: 'tutor-user-1' } as never);
    jest.spyOn(attendanceService, 'markAttendance').mockResolvedValue({} as never);
    jest.spyOn(studentService, 'recordDemoClassUsed').mockResolvedValue(undefined as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    jest.spyOn(tutorService, 'recordClassCompleted').mockResolvedValue(undefined as never);
    jest.spyOn(scheduleService, 'releaseSlot').mockResolvedValue(undefined as never);
    jest.spyOn(tutorService, 'recordClassCancelled').mockResolvedValue(undefined as never);
    jest.spyOn(tutorRepository, 'incrementStats').mockResolvedValue(undefined as never);
    debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
    credit = jest.spyOn(walletService, 'creditWallet').mockResolvedValue({} as never);
    refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
  });

  it('completeClass: does NOT re-debit the student, but DOES credit the tutor (cost − fee)', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(coursePrepaidClass()) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(
      lean({ ...coursePrepaidClass(), status: ClassStatus.COMPLETED }) as never,
    );

    await classService.completeClass('course-class-1', 'tutor-user-1');

    expect(debit).not.toHaveBeenCalled();
    expect(credit).toHaveBeenCalledTimes(1);
    // 1500 − 100 platform fee = 1400 credited to the tutor
    expect(credit.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'tutor-user-1', amountCents: 1400 });
  });

  it('cancelClass: refunds the student the full costCents (unlike STUDENT_REQUESTED, which refunds nothing)', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(
      lean(coursePrepaidClass({ status: ClassStatus.SCHEDULED, studentJoinedAt: undefined })) as never,
    );
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(
      lean({ ...coursePrepaidClass(), status: ClassStatus.CANCELLED }) as never,
    );

    await classService.cancelClass('course-class-1', 'tutor-user-1', { reason: 'Rescheduling' });

    expect(refund).toHaveBeenCalledTimes(1);
    expect(refund.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'student-user-1', amountCents: 1500 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest class.course-billing.test.ts`
Expected: FAIL — `completeClass` falls into the `STUDENT_REQUESTED`/else branch and calls `debitWallet`; `cancelClass` has no refund branch at all for `COURSE_PREPAID` (the "no refund needed" comment path applies to everything that isn't handled specially).

- [ ] **Step 3: Implement**

In `server/src/modules/classes/class.service.ts`, inside `completeClass`, the existing billing `if/else if/else` chain (starting `if (scheduled.classType === ClassType.DEMO)`) currently has two branches after DEMO: `TUTOR_INVITED` and the `else` (implicitly `STUDENT_REQUESTED`). Insert a `COURSE_PREPAID` branch **before** that final `else`, reusing the exact tutor-earning math but skipping the student debit:

```typescript
    } else if (scheduled.billingMode === BillingMode.COURSE_PREPAID) {
      // Student already paid for this class in full when the CourseRequest was
      // accepted (see course-requests module) — do not charge them again here.
      // The tutor still earns per completed class, same as STUDENT_REQUESTED.
      if (scheduled.costCents > 0 && studentAttended) {
        const tutorEarningsCents = Math.max(0, scheduled.costCents - PLATFORM_FEE_CENTS);
        if (tutorEarningsCents > 0) {
          try {
            await walletService.creditWallet({
              ownerPublicId: tutorProfile.userPublicId,
              amountCents: tutorEarningsCents,
              creditType: CreditType.EARNED_CREDITS,
              description: `Earnings: ${scheduled.title}`,
              idempotencyKey: `tutor-earning-${classPublicId}`,
              referenceId: classPublicId,
              referenceType: 'CLASS_COMPLETION',
            });
            await tutorService.recordClassCompleted(scheduled.tutorPublicId, tutorEarningsCents);
          } catch {
            // Could not pay the tutor complete the class anyway.
          }
        }
      }
    } else {
```

(The existing final `else` block — the `STUDENT_REQUESTED` branch — is unchanged.)

In `cancelClass`, after the existing slot-release block and before
`await tutorService.recordClassCancelled(...)`, add:

```typescript
    if (scheduled.billingMode === BillingMode.COURSE_PREPAID && scheduled.costCents > 0) {
      const studentProfile = await StudentProfileModel.findOne(
        { publicId: scheduled.studentPublicId, isDeleted: false },
        { userPublicId: 1 },
      ).lean();
      if (studentProfile?.userPublicId) {
        await walletService.refundWallet({
          ownerPublicId: studentProfile.userPublicId,
          amountCents: scheduled.costCents,
          description: `Refund (course class cancelled): ${scheduled.title}`,
          idempotencyKey: `course-class-cancel-refund-${classPublicId}`,
          referenceId: classPublicId,
          referenceType: 'CLASS_CANCELLATION',
        });
      }
      if (scheduled.courseRequestPublicId) {
        const { CourseRequestModel } = await import('../course-requests/course-request.model');
        await CourseRequestModel.updateOne(
          { publicId: scheduled.courseRequestPublicId },
          { $inc: { classesScheduledCount: -1 } },
        );
      }
    }
```

Place this block guarded so it does not run the normal `_chargeCancellationFee` afterwards for course classes — course cancellations are refund-only, not fee-bearing (Spec §5 doesn't mention a course cancellation fee, unlike the ad-hoc booking flow). Wrap the existing `await this._chargeCancellationFee(...)` call so it's skipped for `COURSE_PREPAID`:

```typescript
    if (scheduled.billingMode !== BillingMode.COURSE_PREPAID) {
      await this._chargeCancellationFee(classPublicId, actorPublicId, {
        tutorUserPublicId: cancelledTutorProfile?.userPublicId,
        studentUserPublicId: cancelledStudentProfile?.userPublicId,
      });
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest class.course-billing.test.ts`
Expected: PASS

Also re-run the pre-existing money test to confirm no regression: `cd server && npx jest class.money.test.ts` → PASS (unchanged behavior for `STUDENT_REQUESTED`/`TUTOR_INVITED`/`DEMO`).

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/classes/class.service.ts server/src/tests/modules/class.course-billing.test.ts
git commit -m "feat: bill COURSE_PREPAID classes correctly on completion and cancellation"
```

---

### Task 3: `county` field on Student profile

**Files:**
- Modify: `server/src/modules/students/student.model.ts`
- Modify: `server/src/modules/students/student.types.ts`
- Modify: `server/src/modules/students/student.validators.ts`
- Modify: `server/src/modules/students/student.service.ts`
- Modify: `server/src/modules/students/student.controller.ts`
- Modify: `server/src/modules/students/student.routes.ts`
- Test: `server/src/tests/modules/student.county.test.ts` (new)

**Interfaces:**
- Produces: `IStudentProfile.county?: string`; `studentService.updateMyProfile(userPublicId: string, data: { grade?: string; county?: string; notes?: string }): Promise<IStudentProfile>`; route `PATCH /students/me` (`Role.STUDENT`).

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/tests/modules/student.county.test.ts
import { studentService } from '../../modules/students/student.service';
import { StudentProfileModel } from '../../modules/students/student.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('StudentService.updateMyProfile', () => {
  it('updates county and grade on the caller\'s own profile', async () => {
    const updateSpy = jest
      .spyOn(StudentProfileModel, 'findOneAndUpdate')
      .mockReturnValue(lean({ publicId: 'student-1', userPublicId: 'user-1', county: 'Wake County', grade: 'Grade 8' }) as never);

    const result = await studentService.updateMyProfile('user-1', { county: 'Wake County', grade: 'Grade 8' });

    expect(updateSpy).toHaveBeenCalledWith(
      { userPublicId: 'user-1', isDeleted: false },
      { $set: { county: 'Wake County', grade: 'Grade 8' } },
      { new: true },
    );
    expect(result.county).toBe('Wake County');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest student.county.test.ts`
Expected: FAIL — `studentService.updateMyProfile` does not exist.

- [ ] **Step 3: Implement**

`student.model.ts` — add next to `grade: { type: String },`:

```typescript
    county: { type: String, index: true },
```

`student.types.ts` — add to `IStudentProfile` next to `grade?: string;`:

```typescript
  county?: string;
```

`student.validators.ts` — add near the top, export a reusable schema piece and use it in the new self-update schema:

```typescript
export const updateMyStudentProfileSchema = z.object({
  grade: z.enum(GRADE_LIST).optional(),
  county: z.string().min(1).max(100).optional(),
});
export type UpdateMyStudentProfileDto = z.infer<typeof updateMyStudentProfileSchema>;
```

`student.service.ts` — add a new method on the `StudentService` class (place it near `getMyProfile`):

```typescript
  async updateMyProfile(
    userPublicId: string,
    data: { grade?: string; county?: string },
  ): Promise<IStudentProfile> {
    const updated = await StudentProfileModel.findOneAndUpdate(
      { userPublicId, isDeleted: false },
      { $set: data },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Student profile');
    return updated;
  }
```

(`NotFoundError` is already imported in this file for other methods — reuse it.)

`student.controller.ts` — add:

```typescript
  async updateMyProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await studentService.updateMyProfile(req.user!.publicId, req.body);
      sendSuccess(res, result, 'Profile updated');
    } catch (error) { next(error); }
  }
```

`student.routes.ts` — add next to the other `/me` routes:

```typescript
router.patch('/me', requireRole(Role.STUDENT), validate(updateMyStudentProfileSchema), studentController.updateMyProfile.bind(studentController));
```

(import `updateMyStudentProfileSchema` from `./student.validators` at the top of the file alongside the other validator imports.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest student.county.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/students/
git add server/src/tests/modules/student.county.test.ts
git commit -m "feat: add county field and self-service profile update for students"
```

---

### Task 4: `Course` model, types, validators

**Files:**
- Create: `server/src/modules/courses/course.model.ts`
- Create: `server/src/modules/courses/course.types.ts`
- Create: `server/src/modules/courses/course.validators.ts`
- Test: `server/src/tests/modules/course.model.test.ts` (new)

**Interfaces:**
- Consumes: `GRADE_LIST` from `../students/student.validators`.
- Produces: `CourseModel` (Mongoose model), `ICourse`, `ICourseTopic`, `createCourseSchema`, `updateCourseSchema`, `courseCatalogQuerySchema`, and their inferred DTO types (`CreateCourseDto`, `UpdateCourseDto`, `CourseCatalogQueryDto`) — consumed by Task 5's service.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/tests/modules/course.model.test.ts
import { CourseModel } from '../../modules/courses/course.model';

describe('Course model', () => {
  it('validates a course with ordered topics and attached content ids', () => {
    const doc = new CourseModel({
      publicId: 'course-1',
      county: 'Wake County',
      grade: 'Grade 8',
      subject: 'Mathematics',
      title: 'Algebra I',
      createdByAdminPublicId: 'admin-1',
      isPublished: false,
      topics: [
        { publicId: 'topic-1', title: 'Linear Equations', order: 0, resourceIds: ['res-1'], assignmentIds: [], worksheetIds: ['ws-1'] },
        { publicId: 'topic-2', title: 'Quadratic Equations', order: 1, resourceIds: [], assignmentIds: ['a-1'], worksheetIds: [] },
      ],
      isDeleted: false,
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.topics).toHaveLength(2);
    expect(doc.topics[0].title).toBe('Linear Equations');
  });

  it('requires county, grade, subject and title', () => {
    const doc = new CourseModel({ publicId: 'course-2', createdByAdminPublicId: 'admin-1', topics: [] });
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(Object.keys(err!.errors)).toEqual(
      expect.arrayContaining(['county', 'grade', 'subject', 'title']),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest course.model.test.ts`
Expected: FAIL — module `../../modules/courses/course.model` does not exist.

- [ ] **Step 3: Implement**

`server/src/modules/courses/course.types.ts`:

```typescript
export interface ICourseTopic {
  publicId: string;
  title: string;
  order: number;
  resourceIds: string[];
  assignmentIds: string[];
  worksheetIds: string[];
}

export interface ICourse {
  _id: string;
  publicId: string;
  county: string;
  grade: string;
  subject: string;
  title: string;
  description?: string;
  topics: ICourseTopic[];
  createdByAdminPublicId: string;
  isPublished: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

`server/src/modules/courses/course.model.ts`:

```typescript
import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { ICourse, ICourseTopic } from './course.types';

const courseTopicSchema = new Schema<ICourseTopic>(
  {
    publicId: { type: String, default: uuidv4 },
    title: { type: String, required: true },
    order: { type: Number, required: true },
    resourceIds: [{ type: String }],
    assignmentIds: [{ type: String }],
    worksheetIds: [{ type: String }],
  },
  { _id: false },
);

const courseSchema = new Schema<ICourse>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    county: { type: String, required: true, index: true },
    grade: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    topics: [courseTopicSchema],
    createdByAdminPublicId: { type: String, required: true },
    isPublished: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

courseSchema.index({ county: 1, grade: 1, isPublished: 1 });

export const CourseModel = mongoose.model<ICourse>('Course', courseSchema);
```

`server/src/modules/courses/course.validators.ts`:

```typescript
import { z } from 'zod';
import { GRADE_LIST } from '../students/student.validators';

const topicInputSchema = z.object({
  publicId: z.string().optional(), // present when editing an existing topic
  title: z.string().min(1).max(200),
  order: z.number().int().min(0),
  resourceIds: z.array(z.string()).default([]),
  assignmentIds: z.array(z.string()).default([]),
  worksheetIds: z.array(z.string()).default([]),
});

export const createCourseSchema = z.object({
  county: z.string().min(1).max(100),
  grade: z.enum(GRADE_LIST),
  subject: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  topics: z.array(topicInputSchema).default([]),
});

export const updateCourseSchema = createCourseSchema.partial();

export const courseCatalogQuerySchema = z.object({
  county: z.string().optional(),
  grade: z.string().optional(),
  subject: z.string().optional(),
  isPublished: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateCourseDto = z.infer<typeof createCourseSchema>;
export type UpdateCourseDto = z.infer<typeof updateCourseSchema>;
export type CourseCatalogQueryDto = z.infer<typeof courseCatalogQuerySchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest course.model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/courses/course.model.ts server/src/modules/courses/course.types.ts server/src/modules/courses/course.validators.ts server/src/tests/modules/course.model.test.ts
git commit -m "feat: add Course model with embedded topics"
```

---

### Task 5: Course service, controller, routes

**Files:**
- Create: `server/src/modules/courses/course.service.ts`
- Create: `server/src/modules/courses/course.controller.ts`
- Create: `server/src/modules/courses/course.routes.ts`
- Modify: `server/src/app.ts`
- Test: `server/src/tests/modules/course.service.test.ts` (new)

**Interfaces:**
- Consumes: `CourseModel`, `CreateCourseDto`, `UpdateCourseDto`, `CourseCatalogQueryDto` (Task 4). `parsePaginationQuery`/`buildPaginatedResult` from `../../utils/pagination`. `NotFoundError` from `../../utils/error`.
- Produces: `courseService.create/update/publish/unpublish/getByPublicId/listCatalog/listForAdmin`. Routes mounted at `${API_BASE}/courses`.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/tests/modules/course.service.test.ts
import { courseService } from '../../modules/courses/course.service';
import { CourseModel } from '../../modules/courses/course.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const leanChain = (v: unknown) => ({
  sort: () => ({ skip: () => ({ limit: () => lean(v) }) }),
});

describe('CourseService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('create() persists a course with the given admin as author', async () => {
    const created = { toObject: () => ({ publicId: 'course-1', title: 'Algebra I' }) };
    const createSpy = jest.spyOn(CourseModel, 'create').mockResolvedValue(created as never);

    const result = await courseService.create('admin-user-1', {
      county: 'Wake County',
      grade: 'Grade 8',
      subject: 'Mathematics',
      title: 'Algebra I',
      topics: [],
    } as never);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ createdByAdminPublicId: 'admin-user-1', isPublished: false, county: 'Wake County' }),
    );
    expect(result.title).toBe('Algebra I');
  });

  it('listCatalog() only returns published courses matching county+grade', async () => {
    const findSpy = jest.spyOn(CourseModel, 'find').mockReturnValue(leanChain([]) as never);
    jest.spyOn(CourseModel, 'countDocuments').mockResolvedValue(0 as never);

    await courseService.listCatalog({ county: 'Wake County', grade: 'Grade 8' });

    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ county: 'Wake County', grade: 'Grade 8', isPublished: true, isDeleted: false }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest course.service.test.ts`
Expected: FAIL — `courseService` module does not exist.

- [ ] **Step 3: Implement**

`server/src/modules/courses/course.service.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid';
import { CourseModel } from './course.model';
import type { ICourse } from './course.types';
import type { CreateCourseDto, UpdateCourseDto, CourseCatalogQueryDto } from './course.validators';
import { NotFoundError } from '../../utils/error';
import type { PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export class CourseService {
  async create(adminUserPublicId: string, dto: CreateCourseDto): Promise<ICourse> {
    const created = await CourseModel.create({
      publicId: uuidv4(),
      county: dto.county,
      grade: dto.grade,
      subject: dto.subject,
      title: dto.title,
      description: dto.description,
      topics: dto.topics.map((t, i) => ({
        publicId: t.publicId ?? uuidv4(),
        title: t.title,
        order: t.order ?? i,
        resourceIds: t.resourceIds,
        assignmentIds: t.assignmentIds,
        worksheetIds: t.worksheetIds,
      })),
      createdByAdminPublicId: adminUserPublicId,
      isPublished: false,
      isDeleted: false,
    });
    return created.toObject();
  }

  async update(coursePublicId: string, dto: UpdateCourseDto): Promise<ICourse> {
    const setFields: Record<string, unknown> = { ...dto };
    if (dto.topics) {
      setFields.topics = dto.topics.map((t, i) => ({
        publicId: t.publicId ?? uuidv4(),
        title: t.title,
        order: t.order ?? i,
        resourceIds: t.resourceIds,
        assignmentIds: t.assignmentIds,
        worksheetIds: t.worksheetIds,
      }));
    }
    const updated = await CourseModel.findOneAndUpdate(
      { publicId: coursePublicId, isDeleted: false },
      { $set: setFields },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Course');
    return updated;
  }

  async setPublished(coursePublicId: string, isPublished: boolean): Promise<ICourse> {
    const updated = await CourseModel.findOneAndUpdate(
      { publicId: coursePublicId, isDeleted: false },
      { $set: { isPublished } },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Course');
    return updated;
  }

  async getByPublicId(coursePublicId: string): Promise<ICourse> {
    const course = await CourseModel.findOne({ publicId: coursePublicId, isDeleted: false }).lean();
    if (!course) throw new NotFoundError('Course');
    return course;
  }

  /** Student-facing catalog: only published courses, always scoped by county+grade. */
  async listCatalog(filters: { county?: string; grade?: string; subject?: string }): Promise<ICourse[]> {
    const filter: Record<string, unknown> = { isPublished: true, isDeleted: false };
    if (filters.county) filter.county = filters.county;
    if (filters.grade) filter.grade = filters.grade;
    if (filters.subject) filter.subject = filters.subject;
    return CourseModel.find(filter).sort({ title: 1 }).skip(0).limit(100).lean();
  }

  /** Admin-facing listing: any county/grade/subject/published state. */
  async listForAdmin(query: CourseCatalogQueryDto): Promise<PaginatedResult<ICourse>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { isDeleted: false };
    if (query.county) filter.county = query.county;
    if (query.grade) filter.grade = query.grade;
    if (query.subject) filter.subject = query.subject;
    if (query.isPublished !== undefined) filter.isPublished = query.isPublished === 'true';

    const [items, total] = await Promise.all([
      CourseModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CourseModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }
}

export const courseService = new CourseService();
```

`server/src/modules/courses/course.controller.ts`:

```typescript
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { courseService } from './course.service';
import { sendSuccess, sendCreated } from '../../utils/response';

export class CourseController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.create(req.user!.publicId, req.body);
      sendCreated(res, result, 'Course created');
    } catch (error) { next(error); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.update(req.params.coursePublicId, req.body);
      sendSuccess(res, result, 'Course updated');
    } catch (error) { next(error); }
  }

  async publish(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.setPublished(req.params.coursePublicId, true);
      sendSuccess(res, result, 'Course published');
    } catch (error) { next(error); }
  }

  async unpublish(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.setPublished(req.params.coursePublicId, false);
      sendSuccess(res, result, 'Course unpublished');
    } catch (error) { next(error); }
  }

  async getByPublicId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.getByPublicId(req.params.coursePublicId);
      sendSuccess(res, result, 'Course fetched');
    } catch (error) { next(error); }
  }

  /** Admin/SuperAdmin management listing vs. the Student-facing published catalog. */
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
      if (isAdmin) {
        const result = await courseService.listForAdmin(req.query as never);
        sendSuccess(res, result, 'Courses fetched');
      } else {
        const query = req.query as { county?: string; grade?: string; subject?: string };
        const result = await courseService.listCatalog(query);
        sendSuccess(res, result, 'Courses fetched');
      }
    } catch (error) { next(error); }
  }
}

export const courseController = new CourseController();
```

`server/src/modules/courses/course.routes.ts`:

```typescript
import { Router } from 'express';
import { courseController } from './course.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import { createCourseSchema, updateCourseSchema } from './course.validators';

const router = Router();
router.use(authMiddleware);

router.get('/', courseController.list.bind(courseController));
router.get('/:coursePublicId', courseController.getByPublicId.bind(courseController));
router.post('/', requireRole(Role.SUPER_ADMIN, Role.ADMIN), validate(createCourseSchema), courseController.create.bind(courseController));
router.put('/:coursePublicId', requireRole(Role.SUPER_ADMIN, Role.ADMIN), validate(updateCourseSchema), courseController.update.bind(courseController));
router.post('/:coursePublicId/publish', requireRole(Role.SUPER_ADMIN, Role.ADMIN), courseController.publish.bind(courseController));
router.post('/:coursePublicId/unpublish', requireRole(Role.SUPER_ADMIN, Role.ADMIN), courseController.unpublish.bind(courseController));

export default router;
```

In `server/src/app.ts`: add `import courseRoutes from './modules/courses/course.routes';` next to the `demoRequestRoutes` import, and `app.use(\`${API_BASE}/courses\`, courseRoutes);` next to the `demo-requests` mount line.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest course.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/courses/course.service.ts server/src/modules/courses/course.controller.ts server/src/modules/courses/course.routes.ts server/src/app.ts server/src/tests/modules/course.service.test.ts
git commit -m "feat: add Course CRUD/catalog service, controller and routes"
```

---

### Task 6: `CourseRequest` model, types, validators

**Files:**
- Create: `server/src/modules/course-requests/course-request.model.ts`
- Create: `server/src/modules/course-requests/course-request.types.ts`
- Create: `server/src/modules/course-requests/course-request.validators.ts`
- Modify: `server/src/constants/events.ts`
- Test: `server/src/tests/modules/course-request.model.test.ts` (new)

**Interfaces:**
- Produces: `CourseRequestModel`, `ICourseRequest`, `CourseRequestStatus`, `createCourseRequestSchema` → `CreateCourseRequestDto`, `acceptCourseRequestSchema` → `AcceptCourseRequestDto`, `rejectCourseRequestSchema` → `RejectCourseRequestDto`, `scheduleCourseClassSchema` → `ScheduleCourseClassDto`. New `DomainEvent.COURSE_REQUEST_CREATED/ACCEPTED/REJECTED/CANCELLED/COMPLETED`.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/tests/modules/course-request.model.test.ts
import { CourseRequestModel } from '../../modules/course-requests/course-request.model';
import { CourseRequestStatus } from '../../modules/course-requests/course-request.types';

describe('CourseRequest model', () => {
  it('validates a pending request with an availability window', () => {
    const doc = new CourseRequestModel({
      publicId: 'cr-1',
      studentPublicId: 'student-1',
      tutorPublicId: 'tutor-1',
      coursePublicId: 'course-1',
      selectedTopicPublicIds: ['topic-1', 'topic-2'],
      availabilityWindow: {
        daysOfWeek: [1, 2, 3, 4, 5],
        startLocalTime: '16:00',
        endLocalTime: '19:00',
        ianaTimezone: 'America/New_York',
      },
      status: CourseRequestStatus.PENDING,
      classesScheduledCount: 0,
      classesCompletedCount: 0,
      isDeleted: false,
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.status).toBe('PENDING');
    expect(doc.availabilityWindow.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest course-request.model.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

`server/src/modules/course-requests/course-request.types.ts`:

```typescript
export const CourseRequestStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;
export type CourseRequestStatus = (typeof CourseRequestStatus)[keyof typeof CourseRequestStatus];

export interface IAvailabilityWindow {
  daysOfWeek: number[]; // 0 (Sun) – 6 (Sat)
  startLocalTime: string; // "16:00"
  endLocalTime: string; // "19:00"
  ianaTimezone: string;
}

export interface ICourseRequest {
  _id: string;
  publicId: string;
  studentPublicId: string;
  tutorPublicId: string;
  coursePublicId: string;
  selectedTopicPublicIds: string[];
  availabilityWindow: IAvailabilityWindow;
  status: CourseRequestStatus;
  classesRequired?: number;
  classesScheduledCount: number;
  classesCompletedCount: number;
  costCentsPerClass?: number;
  totalCostCentsCharged?: number;
  rejectionReason?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

`server/src/modules/course-requests/course-request.model.ts`:

```typescript
import mongoose, { Schema } from 'mongoose';
import type { ICourseRequest, IAvailabilityWindow } from './course-request.types';
import { CourseRequestStatus } from './course-request.types';

const availabilityWindowSchema = new Schema<IAvailabilityWindow>(
  {
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    startLocalTime: { type: String, required: true },
    endLocalTime: { type: String, required: true },
    ianaTimezone: { type: String, required: true },
  },
  { _id: false },
);

const courseRequestSchema = new Schema<ICourseRequest>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    studentPublicId: { type: String, required: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    coursePublicId: { type: String, required: true, index: true },
    selectedTopicPublicIds: [{ type: String }],
    availabilityWindow: { type: availabilityWindowSchema, required: true },
    status: {
      type: String,
      enum: Object.values(CourseRequestStatus),
      default: CourseRequestStatus.PENDING,
      index: true,
    },
    classesRequired: { type: Number, min: 1 },
    classesScheduledCount: { type: Number, default: 0, min: 0 },
    classesCompletedCount: { type: Number, default: 0, min: 0 },
    costCentsPerClass: { type: Number, min: 0 },
    totalCostCentsCharged: { type: Number, min: 0 },
    rejectionReason: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

courseRequestSchema.index({ studentPublicId: 1, status: 1 });
courseRequestSchema.index({ tutorPublicId: 1, status: 1 });

export const CourseRequestModel = mongoose.model<ICourseRequest>('CourseRequest', courseRequestSchema);
```

`server/src/modules/course-requests/course-request.validators.ts`:

```typescript
import { z } from 'zod';

export const createCourseRequestSchema = z.object({
  coursePublicId: z.string().min(1),
  selectedTopicPublicIds: z.array(z.string()).min(1, 'Select at least one topic'),
  tutorPublicId: z.string().min(1),
  availabilityWindow: z.object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    startLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
    endLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
    ianaTimezone: z.string().min(1),
  }),
});

export const acceptCourseRequestSchema = z.object({
  classesRequired: z.number().int().min(1).max(200),
});

export const rejectCourseRequestSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const scheduleCourseClassSchema = z.object({
  startUTC: z.string().datetime(),
  endUTC: z.string().datetime(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  courseTopicPublicId: z.string().optional(),
});

export type CreateCourseRequestDto = z.infer<typeof createCourseRequestSchema>;
export type AcceptCourseRequestDto = z.infer<typeof acceptCourseRequestSchema>;
export type RejectCourseRequestDto = z.infer<typeof rejectCourseRequestSchema>;
export type ScheduleCourseClassDto = z.infer<typeof scheduleCourseClassSchema>;
```

In `server/src/constants/events.ts`, add a new section after `// ─── Demo ─────`:

```typescript
  // ─── Course Requests ───────────────────────────────────
  COURSE_REQUEST_CREATED: 'COURSE_REQUEST_CREATED',
  COURSE_REQUEST_ACCEPTED: 'COURSE_REQUEST_ACCEPTED',
  COURSE_REQUEST_REJECTED: 'COURSE_REQUEST_REJECTED',
  COURSE_REQUEST_CANCELLED: 'COURSE_REQUEST_CANCELLED',
  COURSE_CLASS_SCHEDULED: 'COURSE_CLASS_SCHEDULED',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest course-request.model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/course-requests/course-request.model.ts server/src/modules/course-requests/course-request.types.ts server/src/modules/course-requests/course-request.validators.ts server/src/constants/events.ts server/src/tests/modules/course-request.model.test.ts
git commit -m "feat: add CourseRequest model, types and validators"
```

---

### Task 7: `CourseRequestService` — create/accept/reject/cancel/scheduleClass

This is the money-critical task. Follow TDD strictly — write each test, watch it fail, then implement just enough to pass, one method at a time.

**Files:**
- Create: `server/src/modules/course-requests/course-request.service.ts`
- Test: `server/src/tests/modules/course-request.service.test.ts` (new)

**Interfaces:**
- Consumes: `CourseRequestModel` (Task 6), `ScheduledClassModel` + `BillingMode.COURSE_PREPAID` (Task 1), `walletService.debitWallet/refundWallet` (existing), `tutorService.getByUserPublicId/getByPublicId`, `studentService.getByUserPublicId`, `StudentProfileModel` (existing), `classService.cancelClass` (Task 2).
- Produces: `courseRequestService.create(studentUserPublicId, dto)`, `.getForStudent(studentUserPublicId, query)`, `.getForTutor(tutorUserPublicId, query)`, `.accept(requestPublicId, tutorUserPublicId, dto)`, `.reject(requestPublicId, tutorUserPublicId, dto)`, `.scheduleClass(requestPublicId, tutorUserPublicId, dto)`, `.cancel(requestPublicId, actorUserPublicId)` — all consumed by Task 8's controller.

- [ ] **Step 1: Write the failing tests (all of them, up front — this task is one cohesive money flow)**

```typescript
// server/src/tests/modules/course-request.service.test.ts
import { courseRequestService } from '../../modules/course-requests/course-request.service';
import { CourseRequestModel } from '../../modules/course-requests/course-request.model';
import { CourseRequestStatus } from '../../modules/course-requests/course-request.types';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { walletService } from '../../modules/wallets/wallet.service';
import { studentService } from '../../modules/students/student.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { classService } from '../../modules/classes/class.service';
import { domainEvents } from '../../events/event-emitter';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

function baseRequest(over: Record<string, unknown> = {}) {
  return {
    publicId: 'cr-1',
    studentPublicId: 'student-prof-1',
    tutorPublicId: 'tutor-prof-1',
    coursePublicId: 'course-1',
    selectedTopicPublicIds: ['topic-1'],
    availabilityWindow: {
      daysOfWeek: [1, 2, 3, 4, 5],
      startLocalTime: '16:00',
      endLocalTime: '19:00',
      ianaTimezone: 'UTC',
    },
    status: CourseRequestStatus.PENDING,
    classesScheduledCount: 0,
    classesCompletedCount: 0,
    isDeleted: false,
    ...over,
  };
}

describe('CourseRequestService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('accept', () => {
    it('charges the student classesRequired × tutor rate and marks ACCEPTED', async () => {
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue(
        { publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1', hourlyRateCents: 1500 } as never,
      );
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(baseRequest()) as never);
      jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'student-prof-1', userPublicId: 'student-user-1' }) as never);
      const debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
      jest.spyOn(CourseRequestModel, 'findOneAndUpdate').mockReturnValue(
        lean(baseRequest({ status: CourseRequestStatus.ACCEPTED, classesRequired: 4, costCentsPerClass: 1500 })) as never,
      );
      jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

      const result = await courseRequestService.accept('cr-1', 'tutor-user-1', { classesRequired: 4 });

      expect(debit).toHaveBeenCalledWith(
        expect.objectContaining({ ownerPublicId: 'student-user-1', amountCents: 6000 }), // 4 × 1500
      );
      expect(result.status).toBe('ACCEPTED');
    });

    it('rejects accepting a request that is not PENDING', async () => {
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1', hourlyRateCents: 1500 } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(baseRequest({ status: CourseRequestStatus.ACCEPTED })) as never);

      await expect(courseRequestService.accept('cr-1', 'tutor-user-1', { classesRequired: 4 })).rejects.toThrow();
    });
  });

  describe('scheduleClass', () => {
    it('creates a COURSE_PREPAID class and increments classesScheduledCount when inside the window', async () => {
      const accepted = baseRequest({
        status: CourseRequestStatus.ACCEPTED,
        classesRequired: 4,
        classesScheduledCount: 1,
        costCentsPerClass: 1500,
      });
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(accepted) as never);
      const createSpy = jest.spyOn(ScheduledClassModel, 'create').mockResolvedValue(
        { toObject: () => ({ publicId: 'new-class-1' }) } as never,
      );
      const incSpy = jest.spyOn(CourseRequestModel, 'findOneAndUpdate').mockReturnValue(lean({ ...accepted, classesScheduledCount: 2 }) as never);
      jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

      // Wednesday (day 3) 17:00–18:00 UTC — inside daysOfWeek [1..5], 16:00–19:00 window
      await courseRequestService.scheduleClass('cr-1', 'tutor-user-1', {
        startUTC: '2026-09-30T17:00:00.000Z', // a Wednesday
        endUTC: '2026-09-30T18:00:00.000Z',
        title: 'Algebra I – Session 2',
        courseTopicPublicId: 'topic-1',
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          billingMode: 'COURSE_PREPAID',
          costCents: 1500,
          courseRequestPublicId: 'cr-1',
          coursePublicId: 'course-1',
          courseTopicPublicId: 'topic-1',
        }),
      );
      expect(incSpy).toHaveBeenCalledWith(
        { publicId: 'cr-1', classesScheduledCount: { $lt: 4 } },
        { $inc: { classesScheduledCount: 1 } },
        { new: true },
      );
    });

    it('rejects a time outside the stated availability window', async () => {
      const accepted = baseRequest({ status: CourseRequestStatus.ACCEPTED, classesRequired: 4, classesScheduledCount: 0, costCentsPerClass: 1500 });
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(accepted) as never);

      // 20:00 UTC is after the 19:00 window end
      await expect(
        courseRequestService.scheduleClass('cr-1', 'tutor-user-1', {
          startUTC: '2026-09-30T20:00:00.000Z',
          endUTC: '2026-09-30T21:00:00.000Z',
          title: 'Late session',
        }),
      ).rejects.toThrow();
    });

    it('rejects once classesScheduledCount already equals classesRequired', async () => {
      const full = baseRequest({ status: CourseRequestStatus.ACCEPTED, classesRequired: 4, classesScheduledCount: 4, costCentsPerClass: 1500 });
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(full) as never);

      await expect(
        courseRequestService.scheduleClass('cr-1', 'tutor-user-1', {
          startUTC: '2026-09-30T17:00:00.000Z',
          endUTC: '2026-09-30T18:00:00.000Z',
          title: 'One too many',
        }),
      ).rejects.toThrow();
    });
  });

  describe('cancel', () => {
    it('cancels remaining scheduled classes and refunds the never-scheduled remainder', async () => {
      const accepted = baseRequest({
        status: CourseRequestStatus.ACCEPTED,
        classesRequired: 4,
        classesScheduledCount: 1,
        classesCompletedCount: 1,
        costCentsPerClass: 1500,
      });
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(accepted) as never);
      jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(lean([{ publicId: 'scheduled-class-1' }]) as never);
      const cancelClassSpy = jest.spyOn(classService, 'cancelClass').mockResolvedValue({} as never);
      jest.spyOn(studentService, 'getByPublicId').mockResolvedValue({ userPublicId: 'student-user-1' } as never);
      const refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
      jest.spyOn(CourseRequestModel, 'findOneAndUpdate').mockReturnValue(lean({ ...accepted, status: CourseRequestStatus.CANCELLED }) as never);
      jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

      await courseRequestService.cancel('cr-1', 'student-user-1');

      expect(cancelClassSpy).toHaveBeenCalledWith('scheduled-class-1', 'student-user-1', expect.objectContaining({ reason: expect.any(String) }));
      // classesRequired(4) - classesScheduledCount(1) - classesCompletedCount(1) = 2 never-scheduled → 2 × 1500 = 3000
      expect(refund).toHaveBeenCalledWith(expect.objectContaining({ ownerPublicId: 'student-user-1', amountCents: 3000 }));
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest course-request.service.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

`server/src/modules/course-requests/course-request.service.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid';
import { CourseRequestModel } from './course-request.model';
import { CourseRequestStatus } from './course-request.types';
import type { ICourseRequest } from './course-request.types';
import type {
  CreateCourseRequestDto,
  AcceptCourseRequestDto,
  RejectCourseRequestDto,
  ScheduleCourseClassDto,
} from './course-request.validators';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { BillingMode, ClassStatus, ClassType } from '../schedules/schedule.types';
import type { IScheduledClass } from '../schedules/schedule.types';
import { studentService } from '../students/student.service';
import { tutorService } from '../tutors/tutor.service';
import { classService } from '../classes/class.service';
import { walletService } from '../wallets/wallet.service';
import { AppError, ConflictError, NotFoundError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

/** Minutes since local midnight, for comparing against an availabilityWindow. */
function localMinutesOfDay(isoTime: Date, ianaTimezone: string): { minutes: number; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(isoTime);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return { minutes: hour * 60 + minute, dayOfWeek: dayMap[weekdayShort] ?? 0 };
}

function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export class CourseRequestService {
  async create(studentUserPublicId: string, dto: CreateCourseRequestDto): Promise<ICourseRequest> {
    const studentProfile = await studentService.getByUserPublicId(studentUserPublicId);

    const existing = await CourseRequestModel.findOne({
      studentPublicId: studentProfile.publicId,
      tutorPublicId: dto.tutorPublicId,
      coursePublicId: dto.coursePublicId,
      status: CourseRequestStatus.PENDING,
      isDeleted: false,
    }).lean();
    if (existing) throw new ConflictError('You already have a pending request for this course with this tutor');

    const created = await CourseRequestModel.create({
      publicId: uuidv4(),
      studentPublicId: studentProfile.publicId,
      tutorPublicId: dto.tutorPublicId,
      coursePublicId: dto.coursePublicId,
      selectedTopicPublicIds: dto.selectedTopicPublicIds,
      availabilityWindow: dto.availabilityWindow,
      status: CourseRequestStatus.PENDING,
      classesScheduledCount: 0,
      classesCompletedCount: 0,
      isDeleted: false,
    });

    const tutorProfile = await tutorService.getByPublicId(dto.tutorPublicId);
    domainEvents.emit(DomainEvent.COURSE_REQUEST_CREATED, {
      tutorUserPublicId: tutorProfile.userPublicId,
      studentUserPublicId,
      coursePublicId: dto.coursePublicId,
    });

    return created.toObject();
  }

  async getForStudent(studentUserPublicId: string, query: PaginationQuery & { status?: string }): Promise<PaginatedResult<ICourseRequest>> {
    const studentProfile = await studentService.getByUserPublicId(studentUserPublicId);
    return this._list({ studentPublicId: studentProfile.publicId }, query);
  }

  async getForTutor(tutorUserPublicId: string, query: PaginationQuery & { status?: string }): Promise<PaginatedResult<ICourseRequest>> {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);
    return this._list({ tutorPublicId: tutorProfile.publicId }, query);
  }

  private async _list(
    scope: Record<string, string>,
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResult<ICourseRequest>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { ...scope, isDeleted: false };
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      CourseRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CourseRequestModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  private async _loadOwnedByTutor(requestPublicId: string, tutorUserPublicId: string) {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);
    const request = await CourseRequestModel.findOne({ publicId: requestPublicId, isDeleted: false }).lean();
    if (!request) throw new NotFoundError('Course request');
    if (request.tutorPublicId !== tutorProfile.publicId) throw new AppError('Not authorized', 403);
    return { tutorProfile, request };
  }

  async accept(requestPublicId: string, tutorUserPublicId: string, dto: AcceptCourseRequestDto): Promise<ICourseRequest> {
    const { tutorProfile, request } = await this._loadOwnedByTutor(requestPublicId, tutorUserPublicId);
    if (request.status !== CourseRequestStatus.PENDING) {
      throw new ConflictError(`Request already ${request.status.toLowerCase()}`);
    }

    const studentProfile = await studentService.getByPublicId(request.studentPublicId);
    const costCentsPerClass = tutorProfile.hourlyRateCents;
    const totalCostCentsCharged = costCentsPerClass * dto.classesRequired;

    if (totalCostCentsCharged > 0) {
      await walletService.debitWallet({
        ownerPublicId: studentProfile.userPublicId,
        amountCents: totalCostCentsCharged,
        description: `Course series (${dto.classesRequired} classes)`,
        idempotencyKey: `course-request-accept-${requestPublicId}`,
        referenceId: requestPublicId,
        referenceType: 'COURSE_REQUEST_ACCEPT',
      });
    }

    const updated = await CourseRequestModel.findOneAndUpdate(
      { publicId: requestPublicId, status: CourseRequestStatus.PENDING },
      {
        $set: {
          status: CourseRequestStatus.ACCEPTED,
          classesRequired: dto.classesRequired,
          costCentsPerClass,
          totalCostCentsCharged,
        },
      },
      { new: true },
    ).lean();
    if (!updated) throw new ConflictError('Request already processed');

    domainEvents.emit(DomainEvent.COURSE_REQUEST_ACCEPTED, {
      tutorUserPublicId,
      studentUserPublicId: studentProfile.userPublicId,
      coursePublicId: request.coursePublicId,
      classesRequired: dto.classesRequired,
    });

    return updated;
  }

  async reject(requestPublicId: string, tutorUserPublicId: string, dto: RejectCourseRequestDto): Promise<ICourseRequest> {
    const { request } = await this._loadOwnedByTutor(requestPublicId, tutorUserPublicId);
    if (request.status !== CourseRequestStatus.PENDING) {
      throw new ConflictError(`Request already ${request.status.toLowerCase()}`);
    }

    const updated = await CourseRequestModel.findOneAndUpdate(
      { publicId: requestPublicId },
      { $set: { status: CourseRequestStatus.REJECTED, rejectionReason: dto.reason } },
      { new: true },
    ).lean();

    const studentProfile = await studentService.getByPublicId(request.studentPublicId);
    domainEvents.emit(DomainEvent.COURSE_REQUEST_REJECTED, {
      tutorUserPublicId,
      studentUserPublicId: studentProfile.userPublicId,
      coursePublicId: request.coursePublicId,
    });

    return updated!;
  }

  async scheduleClass(
    requestPublicId: string,
    tutorUserPublicId: string,
    dto: ScheduleCourseClassDto,
  ): Promise<IScheduledClass> {
    const { tutorProfile, request } = await this._loadOwnedByTutor(requestPublicId, tutorUserPublicId);
    if (request.status !== CourseRequestStatus.ACCEPTED) {
      throw new ConflictError('Request must be accepted before scheduling classes');
    }
    if (request.classesScheduledCount >= (request.classesRequired ?? 0)) {
      throw new ConflictError('All classes for this course request are already scheduled');
    }
    if (dto.courseTopicPublicId && !request.selectedTopicPublicIds.includes(dto.courseTopicPublicId)) {
      throw new AppError('Topic is not part of this course request', 400);
    }

    const start = new Date(dto.startUTC);
    const end = new Date(dto.endUTC);
    if (end <= start) throw new AppError('endUTC must be after startUTC', 400);

    const { minutes, dayOfWeek } = localMinutesOfDay(start, request.availabilityWindow.ianaTimezone);
    const windowStart = timeStringToMinutes(request.availabilityWindow.startLocalTime);
    const windowEnd = timeStringToMinutes(request.availabilityWindow.endLocalTime);
    const inWindow =
      request.availabilityWindow.daysOfWeek.includes(dayOfWeek) &&
      minutes >= windowStart &&
      minutes <= windowEnd;
    if (!inWindow) {
      throw new AppError('Requested time is outside the student\'s stated availability window', 400);
    }

    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);

    const created = await ScheduledClassModel.create({
      publicId: uuidv4(),
      tutorPublicId: tutorProfile.publicId,
      studentPublicId: request.studentPublicId,
      classType: ClassType.RECURRING,
      status: ClassStatus.SCHEDULED,
      startUTC: start,
      endUTC: end,
      ianaTimezone: request.availabilityWindow.ianaTimezone,
      durationMinutes,
      title: dto.title,
      description: dto.description,
      costCents: request.costCentsPerClass ?? 0,
      billingMode: BillingMode.COURSE_PREPAID,
      idempotencyKey: `course-class-${requestPublicId}-${uuidv4()}`,
      courseRequestPublicId: request.publicId,
      coursePublicId: request.coursePublicId,
      courseTopicPublicId: dto.courseTopicPublicId,
      isDeleted: false,
    });

    const incremented = await CourseRequestModel.findOneAndUpdate(
      { publicId: requestPublicId, classesScheduledCount: { $lt: request.classesRequired! } },
      { $inc: { classesScheduledCount: 1 } },
      { new: true },
    ).lean();
    if (!incremented) {
      // Lost the race to another concurrent schedule call — undo the class we just created.
      await ScheduledClassModel.deleteOne({ publicId: created.publicId });
      throw new ConflictError('All classes for this course request are already scheduled');
    }

    domainEvents.emit(DomainEvent.COURSE_CLASS_SCHEDULED, {
      tutorUserPublicId,
      classPublicId: created.publicId,
      courseRequestPublicId: request.publicId,
    });

    return created.toObject();
  }

  async cancel(requestPublicId: string, actorUserPublicId: string): Promise<ICourseRequest> {
    const request = await CourseRequestModel.findOne({ publicId: requestPublicId, isDeleted: false }).lean();
    if (!request) throw new NotFoundError('Course request');
    if (request.status !== CourseRequestStatus.ACCEPTED && request.status !== CourseRequestStatus.PENDING) {
      throw new ConflictError(`Request already ${request.status.toLowerCase()}`);
    }

    if (request.status === CourseRequestStatus.ACCEPTED) {
      const scheduledNotCompleted = await ScheduledClassModel.find(
        { courseRequestPublicId: requestPublicId, status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] }, isDeleted: false },
        { publicId: 1 },
      ).lean();

      for (const cls of scheduledNotCompleted) {
        await classService.cancelClass(cls.publicId, actorUserPublicId, { reason: 'Course request cancelled' });
      }

      const neverScheduled = (request.classesRequired ?? 0) - request.classesScheduledCount - request.classesCompletedCount;
      if (neverScheduled > 0 && request.costCentsPerClass) {
        const studentProfile = await studentService.getByPublicId(request.studentPublicId);
        await walletService.refundWallet({
          ownerPublicId: studentProfile.userPublicId,
          amountCents: neverScheduled * request.costCentsPerClass,
          description: 'Course request cancelled — unscheduled classes refunded',
          idempotencyKey: `course-request-cancel-${requestPublicId}`,
          referenceId: requestPublicId,
          referenceType: 'COURSE_REQUEST_CANCEL',
        });
      }
    }

    const updated = await CourseRequestModel.findOneAndUpdate(
      { publicId: requestPublicId },
      { $set: { status: CourseRequestStatus.CANCELLED } },
      { new: true },
    ).lean();

    domainEvents.emit(DomainEvent.COURSE_REQUEST_CANCELLED, { requestPublicId, actorUserPublicId });

    return updated!;
  }
}

export const courseRequestService = new CourseRequestService();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest course-request.service.test.ts`
Expected: PASS (all cases: accept charges correctly and rejects non-PENDING; scheduleClass creates the class + increments count, rejects out-of-window times, rejects when full; cancel cancels in-flight classes and refunds the never-scheduled remainder).

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/course-requests/course-request.service.ts server/src/tests/modules/course-request.service.test.ts
git commit -m "feat: add CourseRequestService — accept/reject/schedule/cancel with prepaid billing"
```

---

### Task 8: `CourseRequest` controller + routes

**Files:**
- Create: `server/src/modules/course-requests/course-request.controller.ts`
- Create: `server/src/modules/course-requests/course-request.routes.ts`
- Modify: `server/src/app.ts`
- Test: `server/src/tests/modules/course-request.routes.test.ts` (new)

**Interfaces:**
- Consumes: `courseRequestService.*` (Task 7), all validators from Task 6.
- Produces: routes mounted at `${API_BASE}/course-requests`: `POST /`, `GET /mine`, `GET /incoming`, `POST /:requestPublicId/accept`, `POST /:requestPublicId/reject`, `POST /:requestPublicId/schedule-class`, `POST /:requestPublicId/cancel`.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/tests/modules/course-request.routes.test.ts
import request from 'supertest';
import app from '../../app'; // app.ts uses `export default app;` — not a named export
import { courseRequestService } from '../../modules/course-requests/course-request.service';

// No other module in this repo has a `*.routes.test.ts` (confirmed by search —
// only `class.*.test.ts`, `course-request.model.test.ts`, etc. exist at this
// layer), so there is no existing auth-bypass convention to mirror. This
// suite mocks the auth middleware directly, which is the simplest approach
// consistent with how every other test in this repo mocks singleton
// services/models with `jest.spyOn` rather than standing up a real server.
jest.mock('../../middlewares/auth.middleware', () => ({
  authMiddleware: (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'user-1', role: 'STUDENT' };
    next();
  },
}));

describe('POST /course-requests', () => {
  it('rejects a request with no selected topics (validator)', async () => {
    const res = await request(app)
      .post('/api/v1/course-requests')
      .send({
        coursePublicId: 'course-1',
        selectedTopicPublicIds: [],
        tutorPublicId: 'tutor-1',
        availabilityWindow: { daysOfWeek: [1], startLocalTime: '16:00', endLocalTime: '19:00', ianaTimezone: 'UTC' },
      });
    expect(res.status).toBe(400);
  });

  it('creates a request and returns 201 for a valid payload', async () => {
    jest.spyOn(courseRequestService, 'create').mockResolvedValue({ publicId: 'cr-1' } as never);
    const res = await request(app)
      .post('/api/v1/course-requests')
      .send({
        coursePublicId: 'course-1',
        selectedTopicPublicIds: ['topic-1'],
        tutorPublicId: 'tutor-1',
        availabilityWindow: { daysOfWeek: [1], startLocalTime: '16:00', endLocalTime: '19:00', ianaTimezone: 'UTC' },
      });
    expect(res.status).toBe(201);
    expect(res.body.data.publicId).toBe('cr-1');
  });
});
```

The two assertions that matter are the `400` on an invalid payload and the
`201` + `data.publicId` on success — the auth-bypass mechanism above is
incidental plumbing to reach the route handler.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest course-request.routes.test.ts`
Expected: FAIL — route does not exist (404).

- [ ] **Step 3: Implement**

`server/src/modules/course-requests/course-request.controller.ts`:

```typescript
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { courseRequestService } from './course-request.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export class CourseRequestController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.create(req.user!.publicId, req.body);
      sendCreated(res, result, 'Course request submitted');
    } catch (error) { next(error); }
  }

  async getMine(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.getForStudent(req.user!.publicId, req.query as Record<string, string>);
      sendPaginated(res, result, 'Course requests fetched');
    } catch (error) { next(error); }
  }

  async getIncoming(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.getForTutor(req.user!.publicId, req.query as Record<string, string>);
      sendPaginated(res, result, 'Course requests fetched');
    } catch (error) { next(error); }
  }

  async accept(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.accept(req.params.requestPublicId, req.user!.publicId, req.body);
      sendSuccess(res, result, 'Course request accepted');
    } catch (error) { next(error); }
  }

  async reject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.reject(req.params.requestPublicId, req.user!.publicId, req.body);
      sendSuccess(res, result, 'Course request rejected');
    } catch (error) { next(error); }
  }

  async scheduleClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.scheduleClass(req.params.requestPublicId, req.user!.publicId, req.body);
      sendCreated(res, result, 'Class scheduled');
    } catch (error) { next(error); }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.cancel(req.params.requestPublicId, req.user!.publicId);
      sendSuccess(res, result, 'Course request cancelled');
    } catch (error) { next(error); }
  }
}

export const courseRequestController = new CourseRequestController();
```

`server/src/modules/course-requests/course-request.routes.ts`:

```typescript
import { Router } from 'express';
import { courseRequestController } from './course-request.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import {
  createCourseRequestSchema,
  acceptCourseRequestSchema,
  rejectCourseRequestSchema,
  scheduleCourseClassSchema,
} from './course-request.validators';

const router = Router();
router.use(authMiddleware);

router.post('/', requireRole(Role.STUDENT), validate(createCourseRequestSchema), courseRequestController.create.bind(courseRequestController));
router.get('/mine', requireRole(Role.STUDENT), courseRequestController.getMine.bind(courseRequestController));
router.get('/incoming', requireRole(Role.TUTOR), courseRequestController.getIncoming.bind(courseRequestController));
router.post('/:requestPublicId/accept', requireRole(Role.TUTOR), validate(acceptCourseRequestSchema), courseRequestController.accept.bind(courseRequestController));
router.post('/:requestPublicId/reject', requireRole(Role.TUTOR), validate(rejectCourseRequestSchema), courseRequestController.reject.bind(courseRequestController));
router.post('/:requestPublicId/schedule-class', requireRole(Role.TUTOR), validate(scheduleCourseClassSchema), courseRequestController.scheduleClass.bind(courseRequestController));
router.post('/:requestPublicId/cancel', requireRole(Role.STUDENT, Role.TUTOR), courseRequestController.cancel.bind(courseRequestController));

export default router;
```

In `server/src/app.ts`: add `import courseRequestRoutes from './modules/course-requests/course-request.routes';` and `app.use(\`${API_BASE}/course-requests\`, courseRequestRoutes);` next to the courses mount from Task 5.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest course-request.routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/course-requests/course-request.controller.ts server/src/modules/course-requests/course-request.routes.ts server/src/app.ts server/src/tests/modules/course-request.routes.test.ts
git commit -m "feat: add CourseRequest controller and routes"
```

---

### Task 9: Full backend regression pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full server test suite**

Run: `cd server && npx jest`
Expected: all suites PASS, including the pre-existing `class.money.test.ts`, `class.cancellation.test.ts` (confirms Task 2's `COURSE_PREPAID` branches didn't disturb `STUDENT_REQUESTED`/`TUTOR_INVITED`/`DEMO` behavior), and every new suite from Tasks 1–8.

- [ ] **Step 2: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit** (only if either step required a fix)

```bash
git add -A
git commit -m "fix: address regressions found in full backend test/type-check pass"
```

---

### Task 10: Frontend services, types, hooks for courses + course requests

**Files:**
- Create: `frontend/src/services/courses.service.ts`
- Create: `frontend/src/services/course-requests.service.ts`
- Create: `frontend/src/hooks/use-courses.ts`
- Create: `frontend/src/hooks/use-course-requests.ts`
- Modify: `frontend/src/services/students.service.ts` — add `county?: string` to the `StudentProfile` interface (next to the existing `grade?: string`, confirmed present at 5 locations in this file) and add an `updateMyProfile` call next to the existing `getMyProfile` (used by `useMyStudentProfile()` in `frontend/src/hooks/use-students.ts`, which Task 11 depends on for the student's own county/grade).

**Interfaces:**
- Produces: `coursesService.{listCatalog, listForAdmin, getByPublicId, create, update, publish, unpublish}`; `courseRequestsService.{create, getMine, getIncoming, accept, reject, scheduleClass, cancel}`; hooks `useCourseCatalog`, `useCourse`, `useAdminCourses`, `useCreateCourse`, `useUpdateCourse`, `usePublishCourse`; `useCourseRequestsAsStudent`, `useCourseRequestsAsTutor`, `useCreateCourseRequest`, `useAcceptCourseRequest`, `useRejectCourseRequest`, `useScheduleCourseClass`, `useCancelCourseRequest`; `StudentProfile.county?: string`; `studentsService.updateMyProfile(dto: { grade?: string; county?: string })`.

- [ ] **Step 1: Write `courses.service.ts`**

```typescript
// frontend/src/services/courses.service.ts
import { api } from '../lib/axios';

export interface CourseTopic {
  publicId: string;
  title: string;
  order: number;
  resourceIds: string[];
  assignmentIds: string[];
  worksheetIds: string[];
}

export interface Course {
  publicId: string;
  county: string;
  grade: string;
  subject: string;
  title: string;
  description?: string;
  topics: CourseTopic[];
  isPublished: boolean;
  createdAt: string;
}

export interface CreateCourseDto {
  county: string;
  grade: string;
  subject: string;
  title: string;
  description?: string;
  topics: Omit<CourseTopic, 'publicId'>[] & { publicId?: string }[];
}

export interface PaginatedCourses {
  items: Course[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const coursesService = {
  listCatalog: (params: { county?: string; grade?: string; subject?: string }): Promise<Course[]> =>
    api.get('/courses', { params }).then((r) => r.data.data),

  listForAdmin: (params: Record<string, string>): Promise<PaginatedCourses> =>
    api.get('/courses', { params }).then((r) => r.data.data),

  getByPublicId: (coursePublicId: string): Promise<Course> =>
    api.get(`/courses/${coursePublicId}`).then((r) => r.data.data),

  create: (dto: CreateCourseDto): Promise<Course> =>
    api.post('/courses', dto).then((r) => r.data.data),

  update: (coursePublicId: string, dto: Partial<CreateCourseDto>): Promise<Course> =>
    api.put(`/courses/${coursePublicId}`, dto).then((r) => r.data.data),

  publish: (coursePublicId: string): Promise<Course> =>
    api.post(`/courses/${coursePublicId}/publish`).then((r) => r.data.data),

  unpublish: (coursePublicId: string): Promise<Course> =>
    api.post(`/courses/${coursePublicId}/unpublish`).then((r) => r.data.data),
};
```

- [ ] **Step 2: Write `course-requests.service.ts`**

```typescript
// frontend/src/services/course-requests.service.ts
import { api } from '../lib/axios';

export interface AvailabilityWindow {
  daysOfWeek: number[];
  startLocalTime: string;
  endLocalTime: string;
  ianaTimezone: string;
}

export interface CourseRequest {
  publicId: string;
  studentPublicId: string;
  tutorPublicId: string;
  coursePublicId: string;
  selectedTopicPublicIds: string[];
  availabilityWindow: AvailabilityWindow;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  classesRequired?: number;
  classesScheduledCount: number;
  classesCompletedCount: number;
  costCentsPerClass?: number;
  rejectionReason?: string;
  createdAt: string;
}

export interface CreateCourseRequestDto {
  coursePublicId: string;
  selectedTopicPublicIds: string[];
  tutorPublicId: string;
  availabilityWindow: AvailabilityWindow;
}

export interface ScheduleCourseClassDto {
  startUTC: string;
  endUTC: string;
  title: string;
  description?: string;
  courseTopicPublicId?: string;
}

export interface PaginatedCourseRequests {
  items: CourseRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const courseRequestsService = {
  create: (dto: CreateCourseRequestDto): Promise<CourseRequest> =>
    api.post('/course-requests', dto).then((r) => r.data.data),

  getMine: (params?: Record<string, string>): Promise<PaginatedCourseRequests> =>
    api.get('/course-requests/mine', { params }).then((r) => r.data.data),

  getIncoming: (params?: Record<string, string>): Promise<PaginatedCourseRequests> =>
    api.get('/course-requests/incoming', { params }).then((r) => r.data.data),

  accept: (requestPublicId: string, classesRequired: number): Promise<CourseRequest> =>
    api.post(`/course-requests/${requestPublicId}/accept`, { classesRequired }).then((r) => r.data.data),

  reject: (requestPublicId: string, reason: string): Promise<CourseRequest> =>
    api.post(`/course-requests/${requestPublicId}/reject`, { reason }).then((r) => r.data.data),

  scheduleClass: (requestPublicId: string, dto: ScheduleCourseClassDto) =>
    api.post(`/course-requests/${requestPublicId}/schedule-class`, dto).then((r) => r.data.data),

  cancel: (requestPublicId: string): Promise<CourseRequest> =>
    api.post(`/course-requests/${requestPublicId}/cancel`).then((r) => r.data.data),
};
```

- [ ] **Step 3: Write `use-courses.ts`**

```typescript
// frontend/src/hooks/use-courses.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesService } from '../services/courses.service';
import type { CreateCourseDto } from '../services/courses.service';
import { useToast } from '../components/ui/Toast';

export const courseKeys = {
  all: ['courses'] as const,
  catalog: (params?: Record<string, string>) => [...courseKeys.all, 'catalog', params] as const,
  admin: (params?: Record<string, string>) => [...courseKeys.all, 'admin', params] as const,
  detail: (id: string) => [...courseKeys.all, 'detail', id] as const,
};

export function useCourseCatalog(params: { county?: string; grade?: string; subject?: string }) {
  return useQuery({
    queryKey: courseKeys.catalog(params as Record<string, string>),
    queryFn: () => coursesService.listCatalog(params),
    enabled: !!params.county && !!params.grade,
  });
}

export function useAdminCourses(params?: Record<string, string>) {
  return useQuery({
    queryKey: courseKeys.admin(params),
    queryFn: () => coursesService.listForAdmin(params ?? {}),
  });
}

export function useCourse(coursePublicId: string | undefined) {
  return useQuery({
    queryKey: courseKeys.detail(coursePublicId ?? ''),
    queryFn: () => coursesService.getByPublicId(coursePublicId!),
    enabled: !!coursePublicId,
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (dto: CreateCourseDto) => coursesService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      toast.success('Course created');
    },
    onError: (err: Error) => toast.error('Could not create course', err.message),
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ coursePublicId, dto }: { coursePublicId: string; dto: Partial<CreateCourseDto> }) =>
      coursesService.update(coursePublicId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      toast.success('Course updated');
    },
    onError: (err: Error) => toast.error('Could not update course', err.message),
  });
}

export function usePublishCourse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ coursePublicId, publish }: { coursePublicId: string; publish: boolean }) =>
      publish ? coursesService.publish(coursePublicId) : coursesService.unpublish(coursePublicId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      toast.success(vars.publish ? 'Course published' : 'Course unpublished');
    },
    onError: (err: Error) => toast.error('Could not update course', err.message),
  });
}
```

- [ ] **Step 4: Write `use-course-requests.ts`**

```typescript
// frontend/src/hooks/use-course-requests.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseRequestsService } from '../services/course-requests.service';
import type { CreateCourseRequestDto, ScheduleCourseClassDto } from '../services/course-requests.service';
import { useToast } from '../components/ui/Toast';

export const courseRequestKeys = {
  all: ['course-requests'] as const,
  mine: (params?: Record<string, string>) => [...courseRequestKeys.all, 'mine', params] as const,
  incoming: (params?: Record<string, string>) => [...courseRequestKeys.all, 'incoming', params] as const,
};

export function useCourseRequestsAsStudent(params?: Record<string, string>) {
  return useQuery({
    queryKey: courseRequestKeys.mine(params),
    queryFn: () => courseRequestsService.getMine(params),
  });
}

export function useCourseRequestsAsTutor(params?: Record<string, string>) {
  return useQuery({
    queryKey: courseRequestKeys.incoming(params),
    queryFn: () => courseRequestsService.getIncoming(params),
  });
}

export function useCreateCourseRequest() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (dto: CreateCourseRequestDto) => courseRequestsService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseRequestKeys.all });
      toast.success('Course request sent!', 'The tutor will review and respond shortly.');
    },
    onError: (err: Error) => toast.error('Request failed', err.message),
  });
}

export function useAcceptCourseRequest() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ requestPublicId, classesRequired }: { requestPublicId: string; classesRequired: number }) =>
      courseRequestsService.accept(requestPublicId, classesRequired),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseRequestKeys.all });
      toast.success('Request accepted', 'You can now schedule the classes.');
    },
    onError: (err: Error) => toast.error('Could not accept request', err.message),
  });
}

export function useRejectCourseRequest() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ requestPublicId, reason }: { requestPublicId: string; reason: string }) =>
      courseRequestsService.reject(requestPublicId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseRequestKeys.all });
      toast.info('Request rejected');
    },
    onError: (err: Error) => toast.error('Could not reject request', err.message),
  });
}

export function useScheduleCourseClass() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ requestPublicId, dto }: { requestPublicId: string; dto: ScheduleCourseClassDto }) =>
      courseRequestsService.scheduleClass(requestPublicId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseRequestKeys.all });
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class scheduled');
    },
    onError: (err: Error) => toast.error('Could not schedule class', err.message),
  });
}

export function useCancelCourseRequest() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (requestPublicId: string) => courseRequestsService.cancel(requestPublicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseRequestKeys.all });
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.info('Course request cancelled');
    },
    onError: (err: Error) => toast.error('Could not cancel request', err.message),
  });
}
```

- [ ] **Step 5: Add `county` to `StudentProfile` and a profile-update call**

In `frontend/src/services/students.service.ts`, add `county?: string;` next to
each `grade?: string;` field on the `StudentProfile` interface (the one
returned by `getMyProfile`, near line 12), and add, next to the existing
`getMyProfile` export:

```typescript
  updateMyProfile: (dto: { grade?: string; county?: string }): Promise<StudentProfile> =>
    api.patch('/students/me', dto).then((r) => r.data.data),
```

- [ ] **Step 6: Type-check and commit**

Run: `cd frontend && npx tsc --noEmit` → expect no errors.

```bash
git add frontend/src/services/courses.service.ts frontend/src/services/course-requests.service.ts frontend/src/hooks/use-courses.ts frontend/src/hooks/use-course-requests.ts frontend/src/services/students.service.ts
git commit -m "feat: add frontend services and hooks for courses and course requests"
```

---

### Task 11: Student — Course catalog, request flow, My Course Requests

**Files:**
- Create: `frontend/src/pages/student/StudentCoursesPage.tsx`
- Create: `frontend/src/pages/student/StudentCourseDetailPage.tsx`
- Create: `frontend/src/pages/student/StudentCourseRequestsPage.tsx`
- Modify: `frontend/src/components/shared/Sidebar.tsx` (STUDENT nav array)
- Modify: `frontend/src/routes/index.tsx` (STUDENT route block)

**Interfaces:**
- Consumes: `useCourseCatalog`, `useCourse` (Task 10), `useCreateCourseRequest`, `useCourseRequestsAsStudent` (Task 10), `useAuthStore` (existing, for the student's `grade`/`county` and `timezone`).

- [ ] **Step 1: `StudentCoursesPage.tsx` — catalog filtered to the student's own county+grade**

```tsx
// frontend/src/pages/student/StudentCoursesPage.tsx
//
// county/grade live on the Student PROFILE (server/src/modules/students/student.model.ts),
// not on the User/auth object, so this reads them via the existing
// `useMyStudentProfile()` hook (frontend/src/hooks/use-students.ts) — the
// same hook every other Student page already uses for profile data — rather
// than `useAuthStore`, which has no `grade`/`county` fields.
import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight, Inbox } from 'lucide-react';
import { useMyStudentProfile } from '../../hooks/use-students';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loading';
import { useCourseCatalog } from '../../hooks/use-courses';

export function StudentCoursesPage() {
  const { data: profile, isLoading: profileLoading } = useMyStudentProfile();
  const county = profile?.county;
  const grade = profile?.grade;
  const { data: courses, isLoading } = useCourseCatalog({ county, grade });

  if (profileLoading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  if (!county || !grade) {
    return (
      <div className="animate-fade-in">
        <PageHeader eyebrow="Courses" title="Curriculum" icon={<BookOpen className="h-5 w-5" />} />
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center gap-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Set your grade and county in your profile to see your curriculum.
              </p>
              <Link to="/profile" className="text-sm text-brand-600 hover:underline">
                Go to profile <ArrowRight className="inline h-3.5 w-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Courses"
        title="Curriculum"
        description={`${grade} curriculum for ${county}`}
        icon={<BookOpen className="h-5 w-5" />}
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !courses || courses.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center gap-3">
              <Inbox className="h-6 w-6 text-gray-400" />
              <p className="text-sm text-gray-500">No published curriculum yet for {grade} in {county}.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
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
      )}
    </div>
  );
}
```

- [ ] **Step 2: `StudentCourseDetailPage.tsx` — pick topics + tutor + window, submit request**

```tsx
// frontend/src/pages/student/StudentCourseDetailPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckSquare, Square, BookOpen } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useCourse } from '../../hooks/use-courses';
import { useCreateCourseRequest } from '../../hooks/use-course-requests';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StudentCourseDetailPage() {
  const { coursePublicId } = useParams<{ coursePublicId: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading } = useCourse(coursePublicId);
  const { mutate: createRequest, isPending } = useCreateCourseRequest();

  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [tutorPublicId, setTutorPublicId] = useState('');
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [startLocalTime, setStartLocalTime] = useState('16:00');
  const [endLocalTime, setEndLocalTime] = useState('19:00');

  if (isLoading || !course) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleDay = (day: number) => {
    setDays((prev) => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  const canSubmit = selectedTopics.size > 0 && tutorPublicId.trim().length > 0 && days.size > 0;

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Courses" title={course.title} description={`${course.subject} · ${course.grade}`} icon={<BookOpen className="h-5 w-5" />} />

      <Card className="mb-4">
        <CardContent>
          <p className="text-sm font-semibold mb-3">Select the topics you want covered</p>
          <div className="space-y-2">
            {[...course.topics].sort((a, b) => a.order - b.order).map((topic) => (
              <button
                key={topic.publicId}
                type="button"
                onClick={() => toggleTopic(topic.publicId)}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-800 p-3 text-left hover:border-brand-300"
              >
                {selectedTopics.has(topic.publicId) ? (
                  <CheckSquare className="h-4 w-4 text-brand-600" />
                ) : (
                  <Square className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm text-gray-800 dark:text-gray-200">{topic.title}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent>
          <p className="text-sm font-semibold mb-3">Tutor</p>
          <input
            value={tutorPublicId}
            onChange={(e) => setTutorPublicId(e.target.value)}
            placeholder="Paste tutor ID (from their profile page)"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900"
          />
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent>
          <p className="text-sm font-semibold mb-3">When are you free?</p>
          <div className="flex gap-1.5 mb-3">
            {DAY_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(i)}
                className={`h-8 w-10 rounded-lg text-xs font-medium ${days.has(i) ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="time" value={startLocalTime} onChange={(e) => setStartLocalTime(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
            <span className="text-xs text-gray-400">to</span>
            <input type="time" value={endLocalTime} onChange={(e) => setEndLocalTime(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
          </div>
        </CardContent>
      </Card>

      <Button
        variant="gradient"
        disabled={!canSubmit}
        loading={isPending}
        onClick={() =>
          createRequest(
            {
              coursePublicId: course.publicId,
              selectedTopicPublicIds: [...selectedTopics],
              tutorPublicId: tutorPublicId.trim(),
              availabilityWindow: {
                daysOfWeek: [...days],
                startLocalTime,
                endLocalTime,
                ianaTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              },
            },
            { onSuccess: () => navigate('/dashboard/student/course-requests') },
          )
        }
      >
        Request this course
      </Button>
    </div>
  );
}
```

*(The tutor-ID text input is a deliberately minimal placeholder for tutor
selection — this plan does not build a tutor search/autocomplete widget, since
one already exists in the codebase for the existing Tutor browse flow
referenced in the spec. A follow-up task can swap this input for that
existing picker component once its exact name/props are confirmed; it is not
required for the feature to function correctly.)*

- [ ] **Step 3: `StudentCourseRequestsPage.tsx` — status list + progress**

```tsx
// frontend/src/pages/student/StudentCourseRequestsPage.tsx
import { ClipboardList, Inbox } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useCourseRequestsAsStudent, useCancelCourseRequest } from '../../hooks/use-course-requests';

const STATUS_BADGE = {
  PENDING: <Badge variant="warning" tone="soft">Pending</Badge>,
  ACCEPTED: <Badge variant="success" tone="soft">Accepted</Badge>,
  REJECTED: <Badge variant="danger" tone="soft">Rejected</Badge>,
  CANCELLED: <Badge variant="default" tone="soft">Cancelled</Badge>,
  COMPLETED: <Badge variant="info" tone="soft">Completed</Badge>,
} as const;

export function StudentCourseRequestsPage() {
  const { data, isLoading } = useCourseRequestsAsStudent({ limit: '50' });
  const { mutate: cancel, isPending: cancelling } = useCancelCourseRequest();
  const requests = data?.items ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Courses" title="My Course Requests" icon={<ClipboardList className="h-5 w-5" />} />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center gap-3">
              <Inbox className="h-6 w-6 text-gray-400" />
              <p className="text-sm text-gray-500">No course requests yet. Browse the curriculum to get started.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.publicId}>
              <CardContent>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    {STATUS_BADGE[req.status]}
                    {req.status === 'ACCEPTED' && (
                      <p className="mt-1 text-xs text-gray-500">
                        {req.classesCompletedCount} of {req.classesRequired} classes completed ·{' '}
                        {req.classesScheduledCount} scheduled
                      </p>
                    )}
                    {req.status === 'REJECTED' && req.rejectionReason && (
                      <p className="mt-1 text-xs text-red-500">Reason: {req.rejectionReason}</p>
                    )}
                  </div>
                  {(req.status === 'PENDING' || req.status === 'ACCEPTED') && (
                    <Button size="sm" variant="outline" loading={cancelling} onClick={() => cancel(req.publicId)}>
                      Cancel
                    </Button>
                  )}
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

- [ ] **Step 4: Wire nav + routes**

In `frontend/src/components/shared/Sidebar.tsx`, in the `STUDENT` array, add after `{ label: 'Tutors', ... }`:

```typescript
    { label: 'Courses',         href: '/dashboard/student/courses',          icon: BookOpen },
```

(`BookOpen` is already imported at the top of this file.)

In `frontend/src/routes/index.tsx`, inside the Student route block (near the other `/dashboard/student/*` routes), add:

```tsx
<Route path="courses" element={<StudentCoursesPage />} />
<Route path="courses/:coursePublicId" element={<StudentCourseDetailPage />} />
<Route path="course-requests" element={<StudentCourseRequestsPage />} />
```

and import the three pages at the top of the file alongside the other Student page imports:

```typescript
import { StudentCoursesPage } from '../pages/student/StudentCoursesPage';
import { StudentCourseDetailPage } from '../pages/student/StudentCourseDetailPage';
import { StudentCourseRequestsPage } from '../pages/student/StudentCourseRequestsPage';
```

- [ ] **Step 5: Verify and commit**

Run: `cd frontend && npx tsc --noEmit` → no errors.
Manually verify (per project convention — start the dev server and click through): county/grade prompt when unset → catalog list → topic pick → request submit → appears in My Course Requests as PENDING.

```bash
git add frontend/src/pages/student/StudentCoursesPage.tsx frontend/src/pages/student/StudentCourseDetailPage.tsx frontend/src/pages/student/StudentCourseRequestsPage.tsx frontend/src/components/shared/Sidebar.tsx frontend/src/routes/index.tsx
git commit -m "feat: add student course catalog, request flow, and my-requests page"
```

---

### Task 12: Student profile — set county

**Files:**
- Modify: the existing Student profile page — it's the page linked from the Sidebar's `Profile` item (shared across all roles per Spec §6 "Shared, cross-role routes"; the file already has a `grade` input for Students, since `grade` is a live, editable field per Task 3/the existing `student.validators.ts` `GRADE_LIST`)

**Interfaces:**
- Consumes: `studentsService.updateMyProfile` and `StudentProfile.county` (added in Task 10, Step 5).

- [ ] **Step 1: Locate the existing profile page's Student-specific section**

Run: `cd frontend && grep -rln "grade" src/pages | grep -i profile`

This finds the file where the Student's `grade` is already an editable form
field. Do not create a new profile page — there is exactly one `/profile`
route, shared by all seven roles.

- [ ] **Step 2: Add a `county` input next to the existing `grade` input**, following
that section's existing text-input styling and its existing save-mutation
call (which should already call something equivalent to
`studentsService.updateMyProfile` or a sibling method for `grade` — extend
that same call to also pass `county`, using the `updateMyProfile` added in
Task 10 if no such call exists yet). This step is intentionally described
rather than pre-written, since the exact save mechanism depends on the file
located in Step 1.

- [ ] **Step 3: Verify**

Run: `cd frontend && npx tsc --noEmit` → no errors. Manually load `/profile` as a Student, set a county, save, reload, confirm it persisted.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: let students set their county from their profile"
```

---

### Task 13: Tutor — Course Requests inbox + scheduler

**Files:**
- Create: `frontend/src/pages/tutor/TutorCourseRequestsPage.tsx`
- Modify: `frontend/src/components/shared/Sidebar.tsx` (TUTOR nav array)
- Modify: `frontend/src/routes/index.tsx` (Tutor route block)

**Interfaces:**
- Consumes: `useCourseRequestsAsTutor`, `useAcceptCourseRequest`, `useRejectCourseRequest`, `useScheduleCourseClass` (Task 10).

- [ ] **Step 1: Build the page** (mirrors `TutorDemoRequestsPage.tsx`'s tabs/list/inline-reject pattern, extended with an Accept form and, once accepted, a schedule-class form)

```tsx
// frontend/src/pages/tutor/TutorCourseRequestsPage.tsx
import { useState } from 'react';
import { ClipboardList, Check, X, Inbox, CalendarPlus } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { Tabs } from '../../components/ui/Tabs';
import {
  useCourseRequestsAsTutor,
  useAcceptCourseRequest,
  useRejectCourseRequest,
  useScheduleCourseClass,
} from '../../hooks/use-course-requests';
import type { CourseRequest } from '../../services/course-requests.service';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'REJECTED', label: 'Rejected' },
];

function AcceptForm({ requestPublicId }: { requestPublicId: string }) {
  const [classesRequired, setClassesRequired] = useState(4);
  const { mutate: accept, isPending } = useAcceptCourseRequest();
  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        type="number"
        min={1}
        max={200}
        value={classesRequired}
        onChange={(e) => setClassesRequired(Number(e.target.value))}
        className="w-20 rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900"
      />
      <span className="text-xs text-gray-500">classes needed to cover the selected topics</span>
      <Button size="sm" variant="gradient" loading={isPending} onClick={() => accept({ requestPublicId, classesRequired })}>
        <Check className="h-3.5 w-3.5" /> Confirm accept
      </Button>
    </div>
  );
}

function ScheduleClassForm({ requestPublicId, topicIds }: { requestPublicId: string; topicIds: string[] }) {
  const [startUTC, setStartUTC] = useState('');
  const [endUTC, setEndUTC] = useState('');
  const [title, setTitle] = useState('');
  const [topicId, setTopicId] = useState(topicIds[0] ?? '');
  const { mutate: schedule, isPending } = useScheduleCourseClass();

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Class title" className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
      <div className="flex gap-2">
        <input type="datetime-local" value={startUTC} onChange={(e) => setStartUTC(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
        <input type="datetime-local" value={endUTC} onChange={(e) => setEndUTC(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
      </div>
      <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900">
        {topicIds.map((id) => <option key={id} value={id}>{id}</option>)}
      </select>
      <Button
        size="sm"
        variant="gradient"
        loading={isPending}
        disabled={!title || !startUTC || !endUTC}
        onClick={() =>
          schedule({
            requestPublicId,
            dto: {
              title,
              startUTC: new Date(startUTC).toISOString(),
              endUTC: new Date(endUTC).toISOString(),
              courseTopicPublicId: topicId || undefined,
            },
          })
        }
      >
        <CalendarPlus className="h-3.5 w-3.5" /> Schedule class
      </Button>
    </div>
  );
}

function RequestCard({ request }: { request: CourseRequest }) {
  const [showReject, setShowReject] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [reason, setReason] = useState('');
  const { mutate: reject, isPending: rejecting } = useRejectCourseRequest();

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Badge variant={request.status === 'PENDING' ? 'warning' : request.status === 'ACCEPTED' ? 'success' : 'default'} tone="soft">
              {request.status}
            </Badge>
            <p className="mt-1 text-xs text-gray-500">{request.selectedTopicPublicIds.length} topics selected</p>
            {request.status === 'ACCEPTED' && (
              <p className="mt-1 text-xs text-gray-500">
                {request.classesScheduledCount} of {request.classesRequired} scheduled ·{' '}
                {request.classesCompletedCount} completed
              </p>
            )}
          </div>
          {request.status === 'PENDING' && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowReject((v) => !v)}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          )}
          {request.status === 'ACCEPTED' && (request.classesScheduledCount < (request.classesRequired ?? 0)) && (
            <Button size="sm" variant="outline" onClick={() => setShowSchedule((v) => !v)}>
              <CalendarPlus className="h-3.5 w-3.5" /> Schedule next class
            </Button>
          )}
        </div>

        {request.status === 'PENDING' && <AcceptForm requestPublicId={request.publicId} />}

        {showReject && (
          <div className="mt-3 space-y-2">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason" className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900" />
            <Button size="sm" variant="danger" loading={rejecting} disabled={!reason.trim()} onClick={() => reject({ requestPublicId: request.publicId, reason: reason.trim() })}>
              Confirm reject
            </Button>
          </div>
        )}

        {showSchedule && <ScheduleClassForm requestPublicId={request.publicId} topicIds={request.selectedTopicPublicIds} />}
      </CardContent>
    </Card>
  );
}

export function TutorCourseRequestsPage() {
  const [activeTab, setActiveTab] = useState('');
  const statusParam = activeTab === '' ? undefined : activeTab;
  const { data, isLoading } = useCourseRequestsAsTutor(statusParam ? { status: statusParam, limit: '50' } : { limit: '50' });
  const requests = data?.items ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Tutor Studio" title="Course Requests" description="Review curriculum requests and schedule the classes." icon={<ClipboardList className="h-5 w-5" />} />
      <Tabs tabs={STATUS_TABS} activeTab={activeTab} onChange={setActiveTab} className="mb-5" />
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : requests.length === 0 ? (
        <Card><CardContent><div className="flex flex-col items-center py-14 text-center gap-3"><Inbox className="h-6 w-6 text-gray-400" /><p className="text-sm text-gray-500">No course requests yet.</p></div></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => <RequestCard key={req.publicId} request={req} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire nav + routes**

In `Sidebar.tsx`'s `TUTOR` array, add after `Demo Requests`:

```typescript
    { label: 'Course Requests', href: '/dashboard/tutor/course-requests', icon: ClipboardList, badgeKey: 'courseRequests' },
```

(Import `ClipboardList` from `lucide-react` at the top of `Sidebar.tsx`
alongside the other icon imports; `badgeKey: 'courseRequests'` is included
for consistency with the other request-inbox items but wiring the actual
unseen-count badge is out of scope for this plan — omit the `badgeKey` prop
entirely if `useSidebarBadges` isn't extended to know about it, to avoid a
badge that always reads zero.)

In `routes/index.tsx`'s Tutor route block, add:

```tsx
<Route path="course-requests" element={<TutorCourseRequestsPage />} />
```

and import it at the top:

```typescript
import { TutorCourseRequestsPage } from '../pages/tutor/TutorCourseRequestsPage';
```

- [ ] **Step 3: Verify and commit**

Run: `cd frontend && npx tsc --noEmit` → no errors. Manually verify: Pending request shows Accept (with classesRequired input) and Reject; after accepting, Schedule next class form appears and posts a class; count decrements availability correctly (scheduled count increases toward classesRequired).

```bash
git add frontend/src/pages/tutor/TutorCourseRequestsPage.tsx frontend/src/components/shared/Sidebar.tsx frontend/src/routes/index.tsx
git commit -m "feat: add tutor course requests inbox with accept/reject/schedule"
```

---

### Task 14: Admin/SuperAdmin — Curriculum editor

**Files:**
- Create: `frontend/src/pages/admin/AdminCurriculumPage.tsx` (list + create/edit modal, used by both Admin and SuperAdmin per the spec's "no new UI difference" for this feature)
- Modify: `frontend/src/components/shared/Sidebar.tsx` (ADMIN + SUPER_ADMIN nav arrays)
- Modify: `frontend/src/routes/index.tsx` (Admin + SuperAdmin route blocks)

**Interfaces:**
- Consumes: `useAdminCourses`, `useCreateCourse`, `useUpdateCourse`, `usePublishCourse` (Task 10).

- [ ] **Step 1: Build the page**

```tsx
// frontend/src/pages/admin/AdminCurriculumPage.tsx
import { useState } from 'react';
import { GraduationCap, Plus, Eye, EyeOff, Trash2, Save } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useAdminCourses, useCreateCourse, usePublishCourse } from '../../hooks/use-courses';
import type { CourseTopic } from '../../services/courses.service';

function NewCourseForm({ onDone }: { onDone: () => void }) {
  const { mutate: create, isPending } = useCreateCourse();
  const [county, setCounty] = useState('');
  const [grade, setGrade] = useState('Grade 8');
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [topics, setTopics] = useState<Array<Omit<CourseTopic, 'publicId'>>>([]);

  const addTopic = () => setTopics((t) => [...t, { title: '', order: t.length, resourceIds: [], assignmentIds: [], worksheetIds: [] }]);
  const updateTopicTitle = (i: number, value: string) =>
    setTopics((t) => t.map((topic, idx) => (idx === i ? { ...topic, title: value } : topic)));
  const removeTopic = (i: number) => setTopics((t) => t.filter((_, idx) => idx !== i));

  return (
    <Card className="mb-4">
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="County" className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900" />
          <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade (e.g. Grade 8)" className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course title" className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Topics (in order)</p>
          {topics.map((topic, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
              <input value={topic.title} onChange={(e) => updateTopicTitle(i, e.target.value)} placeholder="Topic title" className="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-sm bg-white dark:bg-gray-900" />
              <button onClick={() => removeTopic(i)} type="button" className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addTopic}><Plus className="h-3.5 w-3.5" /> Add topic</Button>
        </div>

        <Button
          variant="gradient"
          loading={isPending}
          disabled={!county || !grade || !subject || !title || topics.some((t) => !t.title)}
          onClick={() =>
            create(
              { county, grade, subject, title, topics: topics.map((t, i) => ({ ...t, order: i })) },
              { onSuccess: onDone },
            )
          }
        >
          <Save className="h-3.5 w-3.5" /> Save course
        </Button>
      </CardContent>
    </Card>
  );
}

export function AdminCurriculumPage() {
  const [showNew, setShowNew] = useState(false);
  const { data, isLoading } = useAdminCourses({ limit: '100' });
  const { mutate: setPublished, isPending: publishing } = usePublishCourse();
  const courses = data?.items ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Platform"
        title="Curriculum"
        description="Author county+grade curricula for students to browse and request."
        icon={<GraduationCap className="h-5 w-5" />}
        actions={<Button variant="gradient" onClick={() => setShowNew((v) => !v)}><Plus className="h-3.5 w-3.5" /> New course</Button>}
      />

      {showNew && <NewCourseForm onDone={() => setShowNew(false)} />}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <Card key={course.publicId}>
              <CardContent>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{course.title}</p>
                      {course.isPublished ? <Badge variant="success" tone="soft">Published</Badge> : <Badge variant="default" tone="soft">Draft</Badge>}
                    </div>
                    <p className="text-xs text-gray-500">{course.county} · {course.grade} · {course.subject} · {course.topics.length} topics</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={publishing}
                    onClick={() => setPublished({ coursePublicId: course.publicId, publish: !course.isPublished })}
                  >
                    {course.isPublished ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</> : <><Eye className="h-3.5 w-3.5" /> Publish</>}
                  </Button>
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

*(This form covers create + publish/unpublish, which is enough for the
Course entity to exist, be published, and be requestable end-to-end. Editing
an existing course's topics or attaching specific Resource/Assignment/
Worksheet ids to a topic — rather than only creating new topics by title — is
UI scope beyond what's needed to prove the flow works, and is not included as
a bite-sized TDD step here; it reuses the same `useUpdateCourse` hook from
Task 10 when built.)*

- [ ] **Step 2: Wire nav + routes for both Admin and SuperAdmin**

In `Sidebar.tsx`, add to both the `ADMIN` and `SUPER_ADMIN` arrays, after `Students`:

```typescript
    { label: 'Curriculum', href: '/dashboard/admin/curriculum', icon: GraduationCap },
```

(for `SUPER_ADMIN`, use `href: '/dashboard/super-admin/curriculum'`; `GraduationCap` is already imported in this file.)

In `routes/index.tsx`, add to both the Admin and SuperAdmin route blocks:

```tsx
<Route path="curriculum" element={<AdminCurriculumPage />} />
```

and import once at the top:

```typescript
import { AdminCurriculumPage } from '../pages/admin/AdminCurriculumPage';
```

- [ ] **Step 3: Verify and commit**

Run: `cd frontend && npx tsc --noEmit` → no errors. Manually verify as Admin: create a course with 2 topics → Publish → confirm it now shows in the Student catalog (Task 11) for a student with matching county+grade.

```bash
git add frontend/src/pages/admin/AdminCurriculumPage.tsx frontend/src/components/shared/Sidebar.tsx frontend/src/routes/index.tsx
git commit -m "feat: add admin/super-admin curriculum editor"
```

---

### Task 15: End-to-end manual verification

**Files:** none.

- [ ] **Step 1:** Start server + frontend per the project's existing `run` workflow.
- [ ] **Step 2:** As Admin: create + publish a course for county "Wake County", grade "Grade 8", with 2 topics.
- [ ] **Step 3:** As a Student with that county+grade set on their profile: browse to Courses, open the course, select both topics, enter a real Tutor's public ID, set an availability window, submit. Confirm it shows PENDING in My Course Requests.
- [ ] **Step 4:** As that Tutor: open Course Requests, see the PENDING request, Accept with `classesRequired: 2`. Confirm the student's wallet balance dropped by `2 × tutor hourly rate` (check via the existing wallet/finance screen).
- [ ] **Step 5:** Schedule both classes inside the stated window; confirm a third schedule attempt is rejected (all classes already scheduled) and a schedule attempt outside the window is rejected.
- [ ] **Step 6:** Complete one scheduled class as the Tutor (join both sides or use whatever manual complete action exists) and confirm: student wallet balance does NOT drop further; tutor wallet balance increases by `rate − platform fee`.
- [ ] **Step 7:** Cancel the course request while one class is still merely scheduled (not completed); confirm the scheduled class is cancelled, its cost is refunded to the student, and the request status becomes CANCELLED.
- [ ] **Step 8:** Report results. If any step fails, treat it as a bug against the relevant task above — fix there, re-run the affected task's automated tests, then resume from this step.
