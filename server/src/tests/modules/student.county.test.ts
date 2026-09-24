import { studentService } from '../../modules/students/student.service';
import { StudentProfileModel } from '../../modules/students/student.model';
import { updateMyStudentProfileSchema } from '../../modules/students/student.validators';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('StudentService.updateMyProfile', () => {
  afterEach(() => jest.restoreAllMocks());

  it('county without a district sets the county and clears any old district', async () => {
    const updateSpy = jest
      .spyOn(StudentProfileModel, 'findOneAndUpdate')
      .mockReturnValue(lean({ publicId: 'student-1', county: 'Wake County', grade: 'Grade 8' }) as never);

    const result = await studentService.updateMyProfile('user-1', { country: 'US', state: 'NC', countyFips: '37183', grade: 'Grade 8' });

    expect(updateSpy).toHaveBeenCalledWith(
      { userPublicId: 'user-1', isDeleted: false },
      {
        $set: { country: 'US', state: 'NC', countyFips: '37183', county: 'Wake County', grade: 'Grade 8' },
        $unset: { districtId: '', district: '' },
      },
      { new: true },
    );
    expect(result.county).toBe('Wake County');
  });

  it('a district derives state, county and district name', async () => {
    const updateSpy = jest.spyOn(StudentProfileModel, 'findOneAndUpdate').mockReturnValue(lean({ publicId: 'student-1' }) as never);

    await studentService.updateMyProfile('user-1', { districtId: '3704720' });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.anything(),
      {
        $set: {
          country: 'US', state: 'NC', countyFips: '37183', county: 'Wake County',
          districtId: '3704720', district: 'Wake County Schools',
        },
      },
      { new: true },
    );
  });

  it('grade-only update touches nothing else', async () => {
    const updateSpy = jest.spyOn(StudentProfileModel, 'findOneAndUpdate').mockReturnValue(lean({}) as never);
    await studentService.updateMyProfile('user-1', { grade: 'Grade 9' });
    expect(updateSpy).toHaveBeenCalledWith(expect.anything(), { $set: { grade: 'Grade 9' } }, { new: true });
  });
});

describe('updateMyStudentProfileSchema', () => {
  it('rejects a district that is not in the sent county', () => {
    const r = updateMyStudentProfileSchema.safeParse({ state: 'VA', countyFips: '51059', districtId: '3704720' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === 'districtId')).toBe(true);
  });

  it('accepts a matching county + district, or a district alone', () => {
    expect(updateMyStudentProfileSchema.safeParse({ state: 'NC', countyFips: '37183', districtId: '3704720' }).success).toBe(true);
    expect(updateMyStudentProfileSchema.safeParse({ districtId: '3704720' }).success).toBe(true);
  });
});
