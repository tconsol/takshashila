import { adjustCountersForStatusChange, studentService } from '../../modules/students/student.service';
import { studentRepository } from '../../modules/students/student.repository';
import { tutorRepository } from '../../modules/tutors/tutor.repository';
import { PrincipalProfileModel } from '../../modules/principals/principal.model';
import { StudentStatus } from '../../modules/students/student.types';

const S = StudentStatus;

describe('adjustCountersForStatusChange', () => {
  let tutorInc: jest.SpyInstance;
  let principalInc: jest.SpyInstance;
  beforeEach(() => {
    tutorInc = jest.spyOn(tutorRepository, 'incrementStats').mockResolvedValue(undefined);
    principalInc = jest.spyOn(PrincipalProfileModel, 'updateOne').mockResolvedValue({} as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('increments both when a student becomes counted', async () => {
    await adjustCountersForStatusChange(S.PENDING_APPROVAL, S.ACTIVE, 't1', 'p1');
    expect(tutorInc).toHaveBeenCalledWith('t1', { totalStudents: 1 });
    expect(principalInc).toHaveBeenCalledWith({ userPublicId: 'p1', isDeleted: false }, { $inc: { totalStudents: 1 } });
  });

  it('decrements when a student stops being counted', async () => {
    await adjustCountersForStatusChange(S.ACTIVE, S.INACTIVE, 't1', 'p1');
    expect(tutorInc).toHaveBeenCalledWith('t1', { totalStudents: -1 });
    expect(principalInc).toHaveBeenCalledWith(expect.anything(), { $inc: { totalStudents: -1 } });
  });

  it('does nothing when counted-ness is unchanged', async () => {
    await adjustCountersForStatusChange(S.ACTIVE, S.SUSPENDED, 't1', 'p1');
    await adjustCountersForStatusChange(S.INACTIVE, S.PENDING_APPROVAL, 't1', 'p1');
    await adjustCountersForStatusChange(undefined, S.INACTIVE, 't1', 'p1');
    expect(tutorInc).not.toHaveBeenCalled();
    expect(principalInc).not.toHaveBeenCalled();
  });

  it('logs instead of throwing when a counter write fails', async () => {
    tutorInc.mockRejectedValue(new Error('db down'));
    await expect(adjustCountersForStatusChange(undefined, S.ACTIVE, 't1', 'p1')).resolves.toBeUndefined();
    expect(principalInc).toHaveBeenCalled();
  });
});

describe('StudentService.transfer counters', () => {
  let tutorInc: jest.SpyInstance;
  let principalInc: jest.SpyInstance;
  const setup = (status: StudentStatus, principals: Record<string, string | undefined>) => {
    jest.spyOn(studentRepository, 'findByPublicId').mockResolvedValue({
      publicId: 's1', tutorPublicId: 'old', previousTutorPublicIds: [], status,
    } as never);
    const update = jest.spyOn(studentRepository, 'update').mockResolvedValue({ publicId: 's1' } as never);
    jest.spyOn(tutorRepository, 'findByPublicId').mockImplementation(
      (async (id: string) => ({ publicId: id, principalPublicId: principals[id] })) as never,
    );
    return update;
  };
  beforeEach(() => {
    tutorInc = jest.spyOn(tutorRepository, 'incrementStats').mockResolvedValue(undefined);
    principalInc = jest.spyOn(PrincipalProfileModel, 'updateOne').mockResolvedValue({} as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('ACTIVE student: moves tutor counters, principal net-zero within one org', async () => {
    const update = setup(S.ACTIVE, { old: 'p1', new: 'p1' });
    await studentService.transfer('s1', { newTutorPublicId: 'new' } as never, { userPublicId: 'admin', role: 'ADMIN' });
    expect(update.mock.calls[0][1]).toMatchObject({ status: S.ACTIVE });
    expect(tutorInc).toHaveBeenCalledWith('old', { totalStudents: -1 });
    expect(tutorInc).toHaveBeenCalledWith('new', { totalStudents: 1 });
    expect(principalInc).not.toHaveBeenCalled();
  });

  it('cross-org transfer shifts principal counters', async () => {
    setup(S.ACTIVE, { old: 'p1', new: 'p2' });
    await studentService.transfer('s1', { newTutorPublicId: 'new' } as never, { userPublicId: 'admin', role: 'ADMIN' });
    expect(principalInc).toHaveBeenCalledWith({ userPublicId: 'p1', isDeleted: false }, { $inc: { totalStudents: -1 } });
    expect(principalInc).toHaveBeenCalledWith({ userPublicId: 'p2', isDeleted: false }, { $inc: { totalStudents: 1 } });
  });

  it.each([S.PENDING_APPROVAL, S.INACTIVE])('%s student keeps its status and touches no counter', async (status) => {
    const update = setup(status, { old: 'p1', new: 'p2' });
    await studentService.transfer('s1', { newTutorPublicId: 'new' } as never, { userPublicId: 'admin', role: 'ADMIN' });
    expect(update.mock.calls[0][1]).toMatchObject({ status });
    expect(tutorInc).not.toHaveBeenCalled();
    expect(principalInc).not.toHaveBeenCalled();
  });
});

describe('StudentService.suspend / reject counters', () => {
  afterEach(() => jest.restoreAllMocks());

  it('suspend of an ACTIVE student leaves counters alone; reject of ACTIVE decrements', async () => {
    const tutorInc = jest.spyOn(tutorRepository, 'incrementStats').mockResolvedValue(undefined);
    jest.spyOn(PrincipalProfileModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(tutorRepository, 'findByPublicId').mockResolvedValue({ publicId: 't1', principalPublicId: 'p1' } as never);
    jest.spyOn(studentRepository, 'findByPublicId').mockResolvedValue({ publicId: 's1', tutorPublicId: 't1', status: S.ACTIVE } as never);
    jest.spyOn(studentRepository, 'update').mockResolvedValue({ publicId: 's1' } as never);

    await studentService.suspend('s1', { userPublicId: 'a', role: 'ADMIN' });
    expect(tutorInc).not.toHaveBeenCalled();

    await studentService.reject('s1', { userPublicId: 'a', role: 'ADMIN' });
    expect(tutorInc).toHaveBeenCalledWith('t1', { totalStudents: -1 });
  });
});
