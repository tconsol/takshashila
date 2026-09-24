import { studentService } from '../../modules/students/student.service';
import { StudentProfileModel } from '../../modules/students/student.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('StudentService.updateMyProfile', () => {
  it('updates county and grade on the caller\'s own profile', async () => {
    const updateSpy = jest
      .spyOn(StudentProfileModel, 'findOneAndUpdate')
      .mockReturnValue(lean({ publicId: 'student-1', userPublicId: 'user-1', county: 'Wake County', grade: 'Grade 8' }) as never);

    const result = await studentService.updateMyProfile('user-1', { country: 'US', state: 'NC', countyFips: '37183', grade: 'Grade 8' });

    expect(updateSpy).toHaveBeenCalledWith(
      { userPublicId: 'user-1', isDeleted: false },
      { $set: { country: 'US', state: 'NC', countyFips: '37183', county: 'Wake County', grade: 'Grade 8' } },
      { new: true },
    );
    expect(result.county).toBe('Wake County');
  });
});
