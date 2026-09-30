/* A tutor cannot publish an availability slot the platform would refuse to book. */
import { scheduleService } from '../../modules/schedules/schedule.service';
import { AvailabilitySlotModel } from '../../modules/schedules/schedule.model';
import { settingsService } from '../../modules/settings/settings.service';
import { domainEvents } from '../../events/event-emitter';

const HOUR = 3_600_000;

describe('ScheduleService.createSlots length limits', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(settingsService, 'get').mockResolvedValue({ minClassDurationMinutes: 30, maxClassDurationMinutes: 180 } as never);
  });

  const slot = (minutes: number) => {
    const start = Date.now() + 48 * HOUR;
    return {
      startUTC: new Date(start).toISOString(),
      endUTC: new Date(start + minutes * 60_000).toISOString(),
      ianaTimezone: 'UTC',
      isRecurring: false,
    };
  };

  it('rejects a slot longer than the maximum class length', async () => {
    const create = jest.spyOn(AvailabilitySlotModel, 'create');
    await expect(scheduleService.createSlot('tp-1', slot(240) as never)).rejects.toMatchObject({ statusCode: 422 });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a slot shorter than the minimum class length', async () => {
    const create = jest.spyOn(AvailabilitySlotModel, 'create');
    await expect(scheduleService.createSlot('tp-1', slot(20) as never)).rejects.toMatchObject({ statusCode: 422 });
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts a slot exactly at the maximum', async () => {
    jest.spyOn(scheduleService as never, 'assertNoConflict').mockResolvedValue(undefined as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    const create = jest.spyOn(AvailabilitySlotModel, 'create').mockResolvedValue({ toObject: () => ({ publicId: 's1' }) } as never);
    await expect(scheduleService.createSlot('tp-1', slot(180) as never)).resolves.toMatchObject({ publicId: 's1' });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
