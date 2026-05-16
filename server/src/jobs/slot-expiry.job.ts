import { AvailabilitySlotModel } from '../modules/schedules/schedule.model';
import { AvailabilityStatus } from '../modules/schedules/schedule.types';
import { TutorProfileModel } from '../modules/tutors/tutor.model';
import { domainEvents } from '../events/event-emitter';
import { DomainEvent } from '../constants/events';
import { logger } from '../lib/logger';

const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
const INTERVAL_MS = 60_000; // run every 60 seconds

async function expireStaleSlots(): Promise<void> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);

  // Find all AVAILABLE slots whose start time has passed the grace period
  const expired = await AvailabilitySlotModel.find({
    status: AvailabilityStatus.AVAILABLE,
    startUTC: { $lte: cutoff },
    isDeleted: false,
  }, { publicId: 1, tutorPublicId: 1 }).lean();

  if (expired.length === 0) return;

  const publicIds = expired.map((s) => s.publicId);

  await AvailabilitySlotModel.updateMany(
    { publicId: { $in: publicIds } },
    { $set: { status: AvailabilityStatus.BLOCKED } },
  );

  logger.info(`[slot-expiry] Blocked ${expired.length} expired slot(s)`);

  // Notify each affected tutor so their schedule page updates in real-time
  const tutorPublicIds = [...new Set(expired.map((s) => s.tutorPublicId))];
  const tutors = await TutorProfileModel.find(
    { publicId: { $in: tutorPublicIds }, isDeleted: false },
    { userPublicId: 1 },
  ).lean();

  for (const tutor of tutors) {
    domainEvents.emit(DomainEvent.SLOT_EXPIRED, {
      tutorUserPublicId: tutor.userPublicId,
    });
  }
}

export function startSlotExpiryJob(): void {
  // Run once immediately on startup, then on interval
  expireStaleSlots().catch((err) => logger.error('[slot-expiry] Initial run failed', { err }));
  setInterval(() => {
    expireStaleSlots().catch((err) => logger.error('[slot-expiry] Run failed', { err }));
  }, INTERVAL_MS);

  logger.info(`[slot-expiry] Job started — checking every ${INTERVAL_MS / 1000}s, grace period ${GRACE_PERIOD_MS / 60000}min`);
}
