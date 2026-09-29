jest.mock('../../modules/schedules/schedule.model', () => ({ ScheduledClassModel: { findOne: jest.fn() } }));
jest.mock('../../modules/tutors/tutor.model', () => ({ TutorProfileModel: { findOne: jest.fn() } }));
jest.mock('../../modules/students/student.model', () => ({ StudentProfileModel: { findOne: jest.fn() } }));

import { assertClassParty } from '../../modules/classes/class-access';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { StudentProfileModel } from '../../modules/students/student.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const cls = { tutorPublicId: 't1', studentPublicId: 's1' };

describe('assertClassParty', () => {
  beforeEach(() => jest.resetAllMocks());

  it('lets admins through without lookups', async () => {
    await expect(assertClassParty({ publicId: 'a', role: 'ADMIN' }, 'c1', { allowStudent: false })).resolves.toBeUndefined();
    expect(ScheduledClassModel.findOne).not.toHaveBeenCalled();
  });

  it('lets the class tutor through', async () => {
    (ScheduledClassModel.findOne as jest.Mock).mockReturnValue(lean(cls));
    (TutorProfileModel.findOne as jest.Mock).mockReturnValue(lean({ publicId: 't1' }));
    await expect(assertClassParty({ publicId: 'u', role: 'TUTOR' }, 'c1', { allowStudent: false })).resolves.toBeUndefined();
  });

  it('rejects an unrelated tutor with 404', async () => {
    (ScheduledClassModel.findOne as jest.Mock).mockReturnValue(lean(cls));
    (TutorProfileModel.findOne as jest.Mock).mockReturnValue(lean({ publicId: 'other' }));
    await expect(assertClassParty({ publicId: 'u', role: 'TUTOR' }, 'c1', { allowStudent: false })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lets a principal through only for their own tutor', async () => {
    (ScheduledClassModel.findOne as jest.Mock).mockReturnValue(lean(cls));
    (TutorProfileModel.findOne as jest.Mock)
      .mockReturnValueOnce(lean(null))
      .mockReturnValueOnce(lean({ principalPublicId: 'p1' }));
    await expect(assertClassParty({ publicId: 'p1', role: 'PRINCIPAL' }, 'c1', { allowStudent: false })).resolves.toBeUndefined();

    (TutorProfileModel.findOne as jest.Mock)
      .mockReturnValueOnce(lean(null))
      .mockReturnValueOnce(lean({ principalPublicId: 'someone-else' }));
    await expect(assertClassParty({ publicId: 'p1', role: 'PRINCIPAL' }, 'c1', { allowStudent: false })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('only lets the student through when allowed', async () => {
    (ScheduledClassModel.findOne as jest.Mock).mockReturnValue(lean(cls));
    (TutorProfileModel.findOne as jest.Mock).mockReturnValue(lean(null));
    (StudentProfileModel.findOne as jest.Mock).mockReturnValue(lean({ publicId: 's1' }));
    await expect(assertClassParty({ publicId: 'u', role: 'STUDENT' }, 'c1', { allowStudent: false })).rejects.toMatchObject({ statusCode: 404 });
    await expect(assertClassParty({ publicId: 'u', role: 'STUDENT' }, 'c1', { allowStudent: true })).resolves.toBeUndefined();
  });

  it('404s when the class does not exist', async () => {
    (ScheduledClassModel.findOne as jest.Mock).mockReturnValue(lean(null));
    await expect(assertClassParty({ publicId: 'u', role: 'TUTOR' }, 'nope', { allowStudent: true })).rejects.toMatchObject({ statusCode: 404 });
  });
});
