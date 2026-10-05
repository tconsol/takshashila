/* A student has one profile per tutor link. Class access must use the profile that owns the class. */
import { assertClassParty } from '../../modules/classes/class-access';
import { getClassMembership } from '../../sockets/class-membership';
import { classService } from '../../modules/classes/class.service';
import { classController } from '../../modules/classes/class.controller';
import { studentService } from '../../modules/students/student.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { domainEvents } from '../../events/event-emitter';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

// The user "u1" has an old link (profile p-old) and a newer link (profile p-new); the class belongs to p-new.
const profiles = [
  { publicId: 'p-old', userPublicId: 'u1' },
  { publicId: 'p-new', userPublicId: 'u1' },
];
const cls = { publicId: 'c1', tutorPublicId: 'tp1', studentPublicId: 'p-new', status: 'SCHEDULED', groupPublicId: 'g1', isDeleted: false };

/** Like Mongo: returns the first profile matching every key of the query. */
const profileFindOne = (q: Record<string, unknown>) =>
  lean(profiles.find((p) => Object.entries(q).every(([k, v]) => k === 'isDeleted' || (p as Record<string, unknown>)[k] === v)) ?? null);

describe('student with several tutor links', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(StudentProfileModel, 'findOne').mockImplementation(profileFindOne as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean(null) as never);
  });

  it('assertClassParty lets the student act on a class of their second link', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    await expect(assertClassParty({ publicId: 'u1', role: 'STUDENT' }, 'c1', { allowStudent: true })).resolves.toBeUndefined();
  });

  it('assertClassParty still refuses a user who owns none of the profiles', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    await expect(assertClassParty({ publicId: 'stranger', role: 'STUDENT' }, 'c1', { allowStudent: true }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('socket membership is "student" for a class of their second link', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    await expect(getClassMembership({ publicId: 'u1', role: 'STUDENT' }, 'c1')).resolves.toBe('student');
  });

  it('joinClass authorises the student for a class of their second link', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...cls, status: 'LIVE' }) as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    await expect(classService.joinClass('c1', 'u1', 'STUDENT')).resolves.toMatchObject({ status: 'LIVE' });
  });

  it('joinClass refuses a student who owns none of the profiles', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    await expect(classService.joinClass('c1', 'stranger', 'STUDENT')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('the video token is issued for a class of their second link', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await classController.getAgoraToken({ user: { publicId: 'u1', role: 'STUDENT' }, params: { classId: 'c1' } } as never, res as never, jest.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ channel: 'g1' }) }));
  });

  it('the class list covers every profile of the student', async () => {
    jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean(profiles) as never);
    const find = jest.spyOn(ScheduledClassModel, 'find').mockReturnValue({
      sort: () => ({ skip: () => ({ limit: () => lean([]) }) }),
    } as never);
    jest.spyOn(ScheduledClassModel, 'countDocuments').mockResolvedValue(0 as never);
    const sendList = jest.spyOn(classService, 'withParticipantNames').mockResolvedValue([] as never);

    const ids = await studentService.getProfileIdsByUser('u1');
    expect(ids).toEqual(['p-old', 'p-new']);
    await classService.getClassesByStudent(ids, {}, {} as never);

    expect((find.mock.calls[0] as unknown[])[0]).toMatchObject({ studentPublicId: { $in: ['p-old', 'p-new'] } });
    expect(sendList).toHaveBeenCalled();
  });

  it('a single profile id still works as before', async () => {
    const find = jest.spyOn(ScheduledClassModel, 'find').mockReturnValue({
      sort: () => ({ skip: () => ({ limit: () => lean([]) }) }),
    } as never);
    jest.spyOn(ScheduledClassModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(classService, 'withParticipantNames').mockResolvedValue([] as never);
    await classService.getClassesByStudent('p-old', {}, {} as never);
    expect((find.mock.calls[0] as unknown[])[0]).toMatchObject({ studentPublicId: 'p-old' });
  });
});
