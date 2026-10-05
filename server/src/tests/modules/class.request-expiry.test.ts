/* A class request nobody answers expires when the class starts. */
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { ClassStatus, RequestStatus } from '../../modules/schedules/schedule.types';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const limited = (v: unknown) => ({ limit: () => lean(v) });

const rec = (publicId: string, student: string, series = 'series-1') => ({
  publicId, studentPublicId: student, tutorPublicId: 'tp1', seriesPublicId: series, title: 'Algebra',
});

describe('expirePendingRequests', () => {
  let claim: jest.SpyInstance;
  let find: jest.SpyInstance;
  let emit: jest.SpyInstance;
  const now = new Date('2026-10-10T10:00:00Z');

  beforeEach(() => {
    jest.restoreAllMocks();
    find = jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(limited([]) as never);
    claim = jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({}) as never);
    jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([
      { publicId: 's1', userPublicId: 'su1' }, { publicId: 's2', userPublicId: 'su2' },
    ]) as never);
    jest.spyOn(TutorProfileModel, 'find').mockReturnValue(lean([{ publicId: 'tp1', userPublicId: 'tu1' }]) as never);
    emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  });

  it('looks only at pending, still-scheduled requests whose class has started', async () => {
    await classService.expirePendingRequests(now);
    expect(find.mock.calls[0][0]).toMatchObject({
      requestStatus: RequestStatus.PENDING, status: ClassStatus.SCHEDULED, startUTC: { $lte: now }, isDeleted: false,
    });
  });

  it('does nothing and says nothing when no request is due', async () => {
    await expect(classService.expirePendingRequests(now)).resolves.toBe(0);
    expect(claim).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('cancels the record as expired, by the system, and announces it to the tutor', async () => {
    find.mockReturnValue(limited([rec('c1', 's1')]) as never);
    await expect(classService.expirePendingRequests(now)).resolves.toBe(1);

    const [filter, update] = claim.mock.calls[0];
    expect(filter).toMatchObject({ publicId: 'c1', requestStatus: RequestStatus.PENDING, status: ClassStatus.SCHEDULED });
    expect(update.$set).toMatchObject({
      status: ClassStatus.CANCELLED, requestStatus: RequestStatus.EXPIRED, cancelledBy: 'system', requestRespondedAt: now,
    });
    expect(emit).toHaveBeenCalledWith(DomainEvent.CLASS_REQUEST_RESPONDED, expect.objectContaining({
      classPublicId: 'c1', answer: 'EXPIRED', sessions: 1, tutorUserPublicId: 'tu1', studentUserPublicId: 'su1',
    }));
  });

  it('tells the tutor once per student request, counting the sessions of a series', async () => {
    find.mockReturnValue(limited([rec('c1', 's1'), rec('c2', 's1'), rec('c3', 's1')]) as never);
    await expect(classService.expirePendingRequests(now)).resolves.toBe(3);
    const answers = emit.mock.calls.filter(([e]) => e === DomainEvent.CLASS_REQUEST_RESPONDED);
    expect(answers).toHaveLength(1);
    expect(answers[0][1]).toMatchObject({ sessions: 3 });
  });

  it('a group: each student who did not answer is a separate notice, others are untouched', async () => {
    find.mockReturnValue(limited([rec('c1', 's1'), rec('c2', 's2')]) as never);
    await classService.expirePendingRequests(now);
    const who = emit.mock.calls.filter(([e]) => e === DomainEvent.CLASS_REQUEST_RESPONDED).map(([, p]) => p.studentUserPublicId);
    expect(who.sort()).toEqual(['su1', 'su2']);
    // Only records that were found pending were claimed: a student who accepted never appears in the query.
    expect(claim).toHaveBeenCalledTimes(2);
  });

  it('skips a record someone answered in the meantime (lost the claim)', async () => {
    find.mockReturnValue(limited([rec('c1', 's1'), rec('c2', 's2')]) as never);
    claim.mockReturnValueOnce(lean(null) as never).mockReturnValueOnce(lean({}) as never);
    await expect(classService.expirePendingRequests(now)).resolves.toBe(1);
    const who = emit.mock.calls.filter(([e]) => e === DomainEvent.CLASS_REQUEST_RESPONDED).map(([, p]) => p.studentUserPublicId);
    expect(who).toEqual(['su2']);
  });

  it('announces nothing if every claim was lost', async () => {
    find.mockReturnValue(limited([rec('c1', 's1')]) as never);
    claim.mockReturnValue(lean(null) as never);
    await expect(classService.expirePendingRequests(now)).resolves.toBe(0);
    expect(emit).not.toHaveBeenCalled();
  });
});
