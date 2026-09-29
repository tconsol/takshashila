import { assertActorCanManageStudent, studentService } from '../../modules/students/student.service';
import { studentRepository } from '../../modules/students/student.repository';
import { tutorRepository } from '../../modules/tutors/tutor.repository';
import { NotFoundError } from '../../utils/error';

const student = (o: Record<string, unknown> = {}) =>
  ({ publicId: 's1', tutorPublicId: 't1', previousTutorPublicIds: [], status: 'ACTIVE', invitedBy: 'someone', ...o }) as never;

const tutors: Record<string, { publicId: string; userPublicId: string; principalPublicId?: string }> = {
  t1: { publicId: 't1', userPublicId: 'u-t1', principalPublicId: 'p1' },
  t2: { publicId: 't2', userPublicId: 'u-t2', principalPublicId: 'p1' },
  t3: { publicId: 't3', userPublicId: 'u-t3', principalPublicId: 'p2' },
};

beforeEach(() => {
  jest.spyOn(tutorRepository, 'findByPublicId').mockImplementation((async (id: string) => tutors[id] ?? null) as never);
  jest.spyOn(tutorRepository, 'findByUserPublicId').mockImplementation(
    (async (u: string) => Object.values(tutors).find((t) => t.userPublicId === u) ?? null) as never,
  );
});
afterEach(() => jest.restoreAllMocks());

describe('assertActorCanManageStudent', () => {
  it('allows admins', async () => {
    await expect(assertActorCanManageStudent(student(), { userPublicId: 'x', role: 'ADMIN' })).resolves.toBeUndefined();
  });
  it('allows the owning tutor, rejects another', async () => {
    await expect(assertActorCanManageStudent(student(), { userPublicId: 'u-t1', role: 'TUTOR' })).resolves.toBeUndefined();
    await expect(assertActorCanManageStudent(student(), { userPublicId: 'u-t2', role: 'TUTOR' })).rejects.toBeInstanceOf(NotFoundError);
  });
  it('allows the requested tutor for a pending student without a tutor', async () => {
    const s = student({ tutorPublicId: undefined, pendingTutorPublicId: 't2', status: 'PENDING_APPROVAL' });
    await expect(assertActorCanManageStudent(s, { userPublicId: 'u-t2', role: 'TUTOR' })).resolves.toBeUndefined();
    await expect(assertActorCanManageStudent(s, { userPublicId: 'u-t1', role: 'TUTOR' })).rejects.toBeInstanceOf(NotFoundError);
  });
  it('allows the inviting tutor for an unassigned student', async () => {
    const s = student({ tutorPublicId: undefined, status: 'PENDING_APPROVAL', invitedBy: 'u-t1' });
    await expect(assertActorCanManageStudent(s, { userPublicId: 'u-t1', role: 'TUTOR' })).resolves.toBeUndefined();
    await expect(assertActorCanManageStudent(s, { userPublicId: 'u-t2', role: 'TUTOR' })).rejects.toBeInstanceOf(NotFoundError);
  });
  it('principal only for own tutors', async () => {
    await expect(assertActorCanManageStudent(student(), { userPublicId: 'p1', role: 'PRINCIPAL' })).resolves.toBeUndefined();
    await expect(assertActorCanManageStudent(student(), { userPublicId: 'p2', role: 'PRINCIPAL' })).rejects.toBeInstanceOf(NotFoundError);
  });
  it('rejects other roles', async () => {
    await expect(assertActorCanManageStudent(student(), { userPublicId: 'x', role: 'PARENT' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('transfer scope', () => {
  beforeEach(() => {
    jest.spyOn(studentRepository, 'findByPublicId').mockResolvedValue(student());
    jest.spyOn(studentRepository, 'update').mockResolvedValue({ publicId: 's1' } as never);
    jest.spyOn(tutorRepository, 'incrementStats').mockResolvedValue(undefined);
  });
  it('tutor may transfer within same principal only', async () => {
    const actor = { userPublicId: 'u-t1', role: 'TUTOR' };
    await expect(studentService.transfer('s1', { newTutorPublicId: 't2' }, actor)).resolves.toBeDefined();
    await expect(studentService.transfer('s1', { newTutorPublicId: 't3' }, actor)).rejects.toBeInstanceOf(NotFoundError);
  });
  it('principal only to own tutors', async () => {
    const actor = { userPublicId: 'p1', role: 'PRINCIPAL' };
    await expect(studentService.transfer('s1', { newTutorPublicId: 't3' }, actor)).rejects.toBeInstanceOf(NotFoundError);
  });
  it('unknown target tutor is NotFound even for admin', async () => {
    await expect(studentService.transfer('s1', { newTutorPublicId: 'nope' }, { userPublicId: 'a', role: 'ADMIN' })).rejects.toBeInstanceOf(NotFoundError);
  });
});
