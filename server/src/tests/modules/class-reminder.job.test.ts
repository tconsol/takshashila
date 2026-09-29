import { sendClassReminders } from '../../jobs/class-reminder.job';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { notificationService } from '../../modules/notifications/notification.service';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('class reminder job', () => {
  afterEach(() => jest.restoreAllMocks());

  const arrange = (claim: unknown) => {
    jest.spyOn(ScheduledClassModel, 'find').mockReturnValue({ limit: () => lean([{ publicId: 'c1' }]) } as never);
    const claimSpy = jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean(claim) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'tu' }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'su' }) as never);
    const create = jest.spyOn(notificationService, 'create').mockResolvedValue({} as never);
    return { claimSpy, create };
  };

  it('notifies tutor and student user ids once after claiming the class', async () => {
    const { claimSpy, create } = arrange({
      publicId: 'c1', title: 'Math', tutorPublicId: 'tp', studentPublicId: 'sp', startUTC: new Date(Date.now() + 25 * 60_000),
    });
    expect(await sendClassReminders()).toBe(1);
    expect(claimSpy.mock.calls[0][0]).toMatchObject({ publicId: 'c1', reminderSentAt: { $exists: false } });
    expect(create.mock.calls.map((c) => c[0].recipientPublicId).sort()).toEqual(['su', 'tu']);
    expect(create.mock.calls[0][0]).toMatchObject({ type: 'CLASS_REMINDER', data: { classPublicId: 'c1' } });
  });

  it('sends nothing when another run already claimed the class', async () => {
    const { create } = arrange(null);
    expect(await sendClassReminders()).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });
});
