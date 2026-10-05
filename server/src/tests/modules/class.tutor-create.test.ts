/* tutorCreateClasses: student ownership, platform limits, tutor overlap. */
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { tutorService } from '../../modules/tutors/tutor.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { settingsService } from '../../modules/settings/settings.service';
import { domainEvents } from '../../events/event-emitter';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const base = (over: object = {}) => ({
  title: 'T', classType: 'GROUP', recurrence: 'NONE', studentPublicIds: ['s1'],
  startUTC: iso(DAY), endUTC: iso(DAY + HOUR), ...over,
}) as never;

describe('ClassService.tutorCreateClasses guards', () => {
  let create: jest.SpyInstance;
  let findOne: jest.SpyInstance;
  let studentFind: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp1', userPublicId: 'tu1' } as never);
    studentFind = jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([{ publicId: 's1', userPublicId: 'su1' }]) as never);
    jest.spyOn(settingsService, 'get').mockResolvedValue({ maxAdvanceBookingDays: 30, minClassDurationMinutes: 30, maxClassDurationMinutes: 180 } as never);
    jest.spyOn(walletService, 'getWallet').mockResolvedValue({ balanceCents: 1_000_000 } as never);
    findOne = jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(null) as never);
    create = jest.spyOn(ScheduledClassModel, 'create').mockImplementation((async () => ({ publicId: 'c', toObject: () => ({ publicId: 'c' }) })) as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  });

  it('creates a class for own active students', async () => {
    await expect(classService.tutorCreateClasses('tu1', base())).resolves.toHaveLength(1);
    expect(studentFind.mock.calls[0][0]).toMatchObject({ tutorPublicId: 'tp1', status: 'ACTIVE' });
  });

  it("rejects student ids that are not the tutor's own, listing them", async () => {
    await expect(classService.tutorCreateClasses('tu1', base({ studentPublicIds: ['s1', 'x9'] })))
      .rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining('x9') });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects when the tutor already has an overlapping class, naming the time', async () => {
    const clash = { startUTC: new Date('2030-01-01T10:00:00Z'), endUTC: new Date('2030-01-01T11:00:00Z') };
    findOne.mockReturnValue(lean(clash) as never);
    await expect(classService.tutorCreateClasses('tu1', base()))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('2030-01-01T10:00:00.000Z') });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects durations outside min..max', async () => {
    await expect(classService.tutorCreateClasses('tu1', base({ endUTC: iso(DAY + 10 * 60_000) })))
      .rejects.toThrow(/between 30 and 180/);
  });

  it('rejects starts beyond maxAdvanceBookingDays', async () => {
    await expect(classService.tutorCreateClasses('tu1', base({ startUTC: iso(40 * DAY), endUTC: iso(40 * DAY + HOUR) })))
      .rejects.toThrow(/30 days/);
  });

  it('exempts DEMO classes from duration and advance limits', async () => {
    await expect(classService.tutorCreateClasses('tu1', base({
      classType: 'DEMO', startUTC: iso(40 * DAY), endUTC: iso(40 * DAY + 10 * 60_000),
    }))).resolves.toHaveLength(1);
  });
});

describe('ClassService.tutorCreateClasses notifications for a group', () => {
  let emit: jest.SpyInstance;
  let n = 0;

  beforeEach(() => {
    jest.restoreAllMocks();
    n = 0;
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp1', userPublicId: 'tu1' } as never);
    jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([
      { publicId: 's1', userPublicId: 'su1' }, { publicId: 's2', userPublicId: 'su2' },
    ]) as never);
    jest.spyOn(settingsService, 'get').mockResolvedValue({ maxAdvanceBookingDays: 30, minClassDurationMinutes: 30, maxClassDurationMinutes: 180 } as never);
    jest.spyOn(walletService, 'getWallet').mockResolvedValue({ balanceCents: 1_000_000 } as never);
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(ScheduledClassModel, 'create').mockImplementation((async (d: { studentPublicId: string }) => {
      const doc = { publicId: `c${++n}`, studentPublicId: d.studentPublicId };
      return { ...doc, toObject: () => doc };
    }) as never);
    emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  });

  it("points each student's CLASS_BOOKED event at that student's own class (legacy demo classes)", async () => {
    await classService.tutorCreateClasses('tu1', base({ classType: 'DEMO', studentPublicIds: ['s1', 's2'] }));
    const booked = emit.mock.calls.filter(([e]) => e === 'CLASS_BOOKED').map(([, p]) => [p.studentPublicId, p.classPublicId]);
    expect(booked).toEqual(expect.arrayContaining([['s1', 'c1'], ['s2', 'c2']]));
  });

  it('reports sessions per student, not records for everyone', async () => {
    await classService.tutorCreateClasses('tu1', base({ studentPublicIds: ['s1', 's2'] }));
    const created = emit.mock.calls.find(([e]) => e === 'CLASS_CREATED_BY_TUTOR');
    expect(created?.[1].count).toBe(1);
  });
});

describe('ClassService.tutorCreateClasses group rules', () => {
  let create: jest.SpyInstance;
  const students = (n: number) => Array.from({ length: n }, (_, i) => ({ publicId: `s${i}`, userPublicId: `su${i}` }));

  const arrange = (count: number, balanceCents = 1_000_000) => {
    jest.restoreAllMocks();
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp1', userPublicId: 'tu1' } as never);
    jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean(students(count)) as never);
    jest.spyOn(settingsService, 'get').mockResolvedValue({ maxAdvanceBookingDays: 30, minClassDurationMinutes: 30, maxClassDurationMinutes: 180 } as never);
    jest.spyOn(walletService, 'getWallet').mockResolvedValue({ balanceCents } as never);
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(null) as never);
    create = jest.spyOn(ScheduledClassModel, 'create').mockImplementation((async (d: object) => ({ toObject: () => d })) as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  };

  it('needs a Meet/Zoom link for more than 10 students', async () => {
    arrange(11);
    await expect(classService.tutorCreateClasses('tu1', base({ studentPublicIds: [] })))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('11 students') });
    expect(create).not.toHaveBeenCalled();
  });

  it('allows exactly 10 students in the in-app room', async () => {
    arrange(10);
    await classService.tutorCreateClasses('tu1', base({ studentPublicIds: [] }));
    expect(create).toHaveBeenCalledTimes(10);
    expect(create.mock.calls[0][0]).toMatchObject({ meetingProvider: 'native' });
  });

  it.each([
    ['https://zoom.us/j/123', 'zoom'],
    ['https://meet.google.com/abc-defg-hij', 'google_meet'],
  ])('hosts more than 10 students on an external link (%s -> %s)', async (meetingUrl, provider) => {
    arrange(12);
    await classService.tutorCreateClasses('tu1', base({ studentPublicIds: [], meetingUrl }));
    expect(create).toHaveBeenCalledTimes(12);
    expect(create.mock.calls[0][0]).toMatchObject({ meetingUrl, meetingProvider: provider });
  });

  it('legacy (demo) classes still need 2 credits per student per session in the tutor wallet', async () => {
    arrange(3, 599); // 3 students x 2 credits = 600 cents
    await expect(classService.tutorCreateClasses('tu1', base({ classType: 'DEMO', studentPublicIds: [] })))
      .rejects.toMatchObject({ statusCode: 402, message: expect.stringContaining('6 credits') });
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts a wallet that covers every student and session (legacy demo classes)', async () => {
    arrange(3, 600);
    await expect(classService.tutorCreateClasses('tu1', base({ classType: 'DEMO', studentPublicIds: [] }))).resolves.toHaveLength(3);
  });
});
