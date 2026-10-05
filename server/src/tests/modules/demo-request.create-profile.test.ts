/* A demo request is attached to the student profile tied to that tutor, not the student's first profile. */
import { demoRequestService } from '../../modules/demo-requests/demo-request.service';
import { DemoRequestModel } from '../../modules/demo-requests/demo-request.model';
import { studentService } from '../../modules/students/student.service';
import { studentRepository } from '../../modules/students/student.repository';
import { scheduleService } from '../../modules/schedules/schedule.service';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { domainEvents } from '../../events/event-emitter';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const dto = { tutorPublicId: 't-2', availabilitySlotPublicId: 'slot-1', preferredSubject: 'Maths' } as never;

describe('DemoRequestService.create picks the right student profile', () => {
  let create: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'first-profile' } as never);
    jest.spyOn(scheduleService, 'getSlotByPublicId').mockResolvedValue({ tutorPublicId: 't-2', status: 'AVAILABLE' } as never);
    jest.spyOn(DemoRequestModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'tu-2' }) as never);
    create = jest.spyOn(DemoRequestModel, 'create').mockImplementation((async (d: object) => ({ toObject: () => d })) as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  });

  it('uses the profile already linked to the requested tutor', async () => {
    jest.spyOn(studentRepository, 'findByUserAndTutor').mockResolvedValue({ publicId: 'linked-profile' } as never);
    await demoRequestService.create('u1', dto);
    expect(create.mock.calls[0][0]).toMatchObject({ studentPublicId: 'linked-profile' });
  });

  it('falls back to the first profile when none is linked to that tutor', async () => {
    jest.spyOn(studentRepository, 'findByUserAndTutor').mockResolvedValue(null as never);
    await demoRequestService.create('u1', dto);
    expect(create.mock.calls[0][0]).toMatchObject({ studentPublicId: 'first-profile' });
  });
});
