/* Attendance maths and the presence service (Step 2 of the class exit rule). */
import { applyHeartbeat, attendedMs, requiredAttendanceMinutes } from '../../modules/classes/class-presence';
import type { PresenceInterval } from '../../modules/classes/class-presence';
import { classPresenceService } from '../../modules/classes/class-presence.service';
import { ClassPresenceModel } from '../../modules/classes/class-presence.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { settingsService } from '../../modules/settings/settings.service';

const MIN = 60_000;
const GRACE = 5 * MIN;
const T0 = new Date('2026-10-06T12:00:00Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * MIN);
const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('applyHeartbeat', () => {
  it('starts an interval on the first heartbeat', () => {
    expect(applyHeartbeat([], at(0), GRACE)).toEqual([{ start: at(0), end: at(0) }]);
  });

  it('extends the interval for regular heartbeats', () => {
    let iv: PresenceInterval[] = [];
    for (let m = 0; m <= 10; m += 0.5) iv = applyHeartbeat(iv, at(m), GRACE);
    expect(iv).toEqual([{ start: at(0), end: at(10) }]);
  });

  it('counts a gap of exactly the grace as present', () => {
    const iv = applyHeartbeat([{ start: at(0), end: at(10) }], at(15), GRACE);
    expect(iv).toEqual([{ start: at(0), end: at(15) }]);
  });

  it('starts a new interval after a gap longer than the grace', () => {
    const iv = applyHeartbeat([{ start: at(0), end: at(10) }], at(15.5), GRACE);
    expect(iv).toEqual([{ start: at(0), end: at(10) }, { start: at(15.5), end: at(15.5) }]);
  });

  it('does not move an interval end backwards for a late older heartbeat', () => {
    const iv = applyHeartbeat([{ start: at(0), end: at(10) }], at(8), GRACE);
    expect(iv).toEqual([{ start: at(0), end: at(10) }]);
  });

  it('does not change the stored intervals it was given', () => {
    const stored = [{ start: at(0), end: at(1) }];
    applyHeartbeat(stored, at(2), GRACE);
    expect(stored).toEqual([{ start: at(0), end: at(1) }]);
  });

  it('with a zero grace every gap starts a new interval', () => {
    const iv = applyHeartbeat([{ start: at(0), end: at(1) }], at(1.5), 0);
    expect(iv).toHaveLength(2);
  });
});

describe('attendedMs', () => {
  const start = at(0);
  const end = at(60);

  it('counts the whole interval inside the class', () => {
    expect(attendedMs([{ start: at(10), end: at(40) }], start, end)).toBe(30 * MIN);
  });
  it('ignores time before the scheduled start (the room opens 15 minutes early)', () => {
    expect(attendedMs([{ start: at(-15), end: at(10) }], start, end)).toBe(10 * MIN);
  });
  it('ignores time after the scheduled end', () => {
    expect(attendedMs([{ start: at(50), end: at(75) }], start, end)).toBe(10 * MIN);
  });
  it('sums several intervals and skips the time away', () => {
    const iv = [{ start: at(0), end: at(20) }, { start: at(30), end: at(60) }];
    expect(attendedMs(iv, start, end)).toBe(50 * MIN);
  });
  it('is zero with no intervals or an interval outside the class', () => {
    expect(attendedMs([], start, end)).toBe(0);
    expect(attendedMs([{ start: at(70), end: at(80) }], start, end)).toBe(0);
  });
});

describe('requiredAttendanceMinutes', () => {
  it('matches the decided examples: 50 of 60 and 25 of 30 at 83%', () => {
    expect(requiredAttendanceMinutes(60, 83)).toBe(50);
    expect(requiredAttendanceMinutes(30, 83)).toBe(25);
  });
  it('rounds up and never returns less than 1', () => {
    expect(requiredAttendanceMinutes(45, 83)).toBe(38);
    expect(requiredAttendanceMinutes(5, 1)).toBe(1);
  });
  it('is the full length at 100%', () => {
    expect(requiredAttendanceMinutes(60, 100)).toBe(60);
  });
});

describe('ClassPresenceService', () => {
  const cls = {
    publicId: 'c1', groupPublicId: undefined as string | undefined,
    tutorPublicId: 'tp1', studentPublicId: 'sp1', status: 'LIVE',
    startUTC: at(0), endUTC: at(60), durationMinutes: 60,
  };

  const mockClass = (over: object = {}) =>
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean({ ...cls, ...over }) as never);
  const mockPeople = (tutorUser?: string, studentUser?: string) => {
    jest.spyOn(TutorProfileModel, 'findOne').mockImplementation(((q: { userPublicId: string }) =>
      lean(q.userPublicId === tutorUser ? { publicId: 'tp1' } : null)) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockImplementation(((q: { userPublicId: string }) =>
      lean(q.userPublicId === studentUser ? { publicId: 'sp1' } : null)) as never);
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(settingsService, 'get').mockResolvedValue({ disconnectGraceMinutes: 5, minAttendancePercent: 83 } as never);
  });

  it('uses the group id as the room key for a group, the class id otherwise', () => {
    expect(classPresenceService.roomKey({ publicId: 'c1', groupPublicId: 'g1' })).toBe('g1');
    expect(classPresenceService.roomKey({ publicId: 'c1' })).toBe('c1');
  });

  it('creates the first presence record for the class tutor', async () => {
    mockClass(); mockPeople('tu1');
    jest.spyOn(ClassPresenceModel, 'findOne').mockReturnValue(lean(null) as never);
    const create = jest.spyOn(ClassPresenceModel, 'create').mockResolvedValue({} as never);
    await classPresenceService.recordPresence('c1', 'tu1', at(1));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      roomKey: 'c1', userPublicId: 'tu1', role: 'TUTOR', lastSeenAt: at(1),
      intervals: [{ start: at(1), end: at(1) }],
    }));
  });

  it('keys a group student under the shared room, as STUDENT', async () => {
    mockClass({ groupPublicId: 'g1' }); mockPeople(undefined, 'su1');
    jest.spyOn(ClassPresenceModel, 'findOne').mockReturnValue(lean(null) as never);
    const create = jest.spyOn(ClassPresenceModel, 'create').mockResolvedValue({} as never);
    await classPresenceService.recordPresence('c1', 'su1', at(1));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ roomKey: 'g1', role: 'STUDENT' }));
  });

  it('extends an existing record with a compare-and-set on lastSeenAt', async () => {
    mockClass(); mockPeople('tu1');
    jest.spyOn(ClassPresenceModel, 'findOne').mockReturnValue(lean({
      intervals: [{ start: at(0), end: at(2) }], lastSeenAt: at(2),
    }) as never);
    const update = jest.spyOn(ClassPresenceModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    await classPresenceService.recordPresence('c1', 'tu1', at(3));
    expect(update).toHaveBeenCalledWith(
      { roomKey: 'c1', userPublicId: 'tu1', lastSeenAt: at(2) },
      { $set: { intervals: [{ start: at(0), end: at(3) }], lastSeenAt: at(3) } },
    );
  });

  it('retries when another tab wrote in between, then gives up quietly', async () => {
    mockClass(); mockPeople('tu1');
    jest.spyOn(ClassPresenceModel, 'findOne').mockReturnValue(lean({ intervals: [], lastSeenAt: at(2) }) as never);
    const update = jest.spyOn(ClassPresenceModel, 'updateOne').mockResolvedValue({ modifiedCount: 0 } as never);
    await expect(classPresenceService.recordPresence('c1', 'tu1', at(3))).resolves.toBeNull();
    expect(update).toHaveBeenCalledTimes(3);
  });

  it('reads the grace from the admin setting', async () => {
    mockClass(); mockPeople('tu1');
    (settingsService.get as jest.Mock).mockResolvedValue({ disconnectGraceMinutes: 1 });
    jest.spyOn(ClassPresenceModel, 'findOne').mockReturnValue(lean({
      intervals: [{ start: at(0), end: at(2) }], lastSeenAt: at(2),
    }) as never);
    const update = jest.spyOn(ClassPresenceModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    await classPresenceService.recordPresence('c1', 'tu1', at(5)); // 3 min gap > 1 min grace
    const patch = (update.mock.calls as unknown as Array<[unknown, { $set: { intervals: unknown[] } }]>)[0][1];
    expect(patch.$set.intervals).toHaveLength(2);
  });

  it('records nothing for a class that is no longer open', async () => {
    mockClass({ status: 'COMPLETED' }); mockPeople('tu1');
    const find = jest.spyOn(ClassPresenceModel, 'findOne');
    await expect(classPresenceService.recordPresence('c1', 'tu1', at(1))).resolves.toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  it('returns progress: minutes present so far against the minutes required', async () => {
    mockClass(); mockPeople('tu1');
    jest.spyOn(ClassPresenceModel, 'findOne').mockReturnValue(lean({
      intervals: [{ start: at(0), end: at(14) }], lastSeenAt: at(14),
    }) as never);
    jest.spyOn(ClassPresenceModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    await expect(classPresenceService.recordPresence('c1', 'tu1', at(15)))
      .resolves.toEqual({ attendedMinutes: 15, requiredMinutes: 50 });
  });

  it('returns progress for a first heartbeat too', async () => {
    mockClass(); mockPeople('tu1');
    jest.spyOn(ClassPresenceModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(ClassPresenceModel, 'create').mockResolvedValue({} as never);
    await expect(classPresenceService.recordPresence('c1', 'tu1', at(1)))
      .resolves.toEqual({ attendedMinutes: 0, requiredMinutes: 50 });
  });

  it('refuses someone who is not the tutor or student of the class', async () => {
    mockClass(); mockPeople('tu1', 'su1');
    await expect(classPresenceService.recordPresence('c1', 'stranger', at(1))).rejects.toThrow(/not found/i);
  });

  it('refuses a student whose profile belongs to a different class', async () => {
    mockClass({ studentPublicId: 'other-profile' }); mockPeople(undefined, 'su1');
    await expect(classPresenceService.recordPresence('c1', 'su1', at(1))).rejects.toThrow(/not found/i);
  });

  it('404s for a missing class', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(classPresenceService.recordPresence('nope', 'tu1', at(1))).rejects.toThrow(/not found/i);
  });

  it('reports attended minutes from stored intervals, clamped to the class window', async () => {
    jest.spyOn(ClassPresenceModel, 'findOne').mockReturnValue(lean({
      intervals: [{ start: at(-10), end: at(20) }, { start: at(40), end: at(70) }],
    }) as never);
    const mins = await classPresenceService.attendedMinutes(
      { publicId: 'c1', startUTC: at(0), endUTC: at(60) }, 'tu1',
    );
    expect(mins).toBe(40);
  });

  it('reports zero minutes when nothing was recorded', async () => {
    jest.spyOn(ClassPresenceModel, 'findOne').mockReturnValue(lean(null) as never);
    expect(await classPresenceService.attendedMinutes({ publicId: 'c1', startUTC: at(0), endUTC: at(60) }, 'tu1')).toBe(0);
  });

  it('computes the required minutes from the admin percentage', async () => {
    expect(await classPresenceService.requiredMinutes({ durationMinutes: 60 })).toBe(50);
  });
});
