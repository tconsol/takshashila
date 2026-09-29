import { ParentService } from '../../modules/parents/parent.service';
import { StudentProfileModel } from '../../modules/students/student.model';
import { WorksheetModel, WorksheetSubmissionModel } from '../../modules/worksheets/worksheet.model';

const chain = (rows: unknown[]) => {
  const c: Record<string, unknown> = {};
  c.sort = () => c; c.skip = () => c; c.limit = () => c;
  c.lean = () => Promise.resolve(rows);
  return c as never;
};

describe('ParentService.getChildWorksheets', () => {
  afterEach(() => jest.restoreAllMocks());

  it('filters on assignedToStudentPublicIds / tutor-unassigned and attaches submission', async () => {
    const svc = new ParentService();
    jest.spyOn(svc, 'assertChildAccess').mockResolvedValue();
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue({ lean: () => Promise.resolve({ tutorPublicId: 'T1' }) } as never);
    const find = jest.spyOn(WorksheetModel, 'find').mockReturnValue(chain([{ publicId: 'w1' }, { publicId: 'w2' }]));
    jest.spyOn(WorksheetModel, 'countDocuments').mockResolvedValue(2 as never);
    jest.spyOn(WorksheetSubmissionModel, 'find').mockReturnValue({
      lean: () => Promise.resolve([{ worksheetPublicId: 'w1', studentPublicId: 'S1', score: 80 }]),
    } as never);

    const res = await svc.getChildWorksheets('p', 'S1', {} as never);
    const filter = JSON.stringify((find.mock.calls as unknown[][])[0][0]);
    expect(filter).toContain('assignedToStudentPublicIds');
    expect(filter).not.toContain('sharedWith');
    expect(filter).toContain('T1');
    const items = res.items as Array<{ publicId: string; mySubmission?: { score: number } }>;
    expect(items[0].mySubmission?.score).toBe(80);
    expect(items[1].mySubmission).toBeUndefined();
  });
});
