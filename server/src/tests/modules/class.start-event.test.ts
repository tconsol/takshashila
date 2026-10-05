/* When the tutor starts a class, the CLASS_STARTED event must name the student,
   otherwise nobody is notified that the class is live. */
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('ClassService.startClass event', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('includes the student user id and marks the class as newly live', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(
      lean({ publicId: 'c1', billingMode: 'STUDENT_REQUESTED' }) as never,
    );
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(
      lean({ publicId: 'c1', studentPublicId: 'sp1', tutorPublicId: 'tp1' }) as never,
    );
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'su1' }) as never);
    const emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

    await classService.startClass('c1', 'tu1');

    expect(emit).toHaveBeenCalledWith(DomainEvent.CLASS_STARTED, expect.objectContaining({
      classPublicId: 'c1',
      tutorUserPublicId: 'tu1',
      studentUserPublicId: 'su1',
      startedBy: 'TUTOR',
      wentLive: true,
    }));
  });
});
