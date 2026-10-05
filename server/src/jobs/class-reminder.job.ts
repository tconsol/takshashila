import { ScheduledClassModel } from '../modules/schedules/schedule.model';
import { ClassStatus } from '../modules/schedules/schedule.types';
import { StudentProfileModel } from '../modules/students/student.model';
import { TutorProfileModel } from '../modules/tutors/tutor.model';
import { notificationService } from '../modules/notifications/notification.service';
import { NotificationType } from '../modules/notifications/notification.types';
import { logger } from '../lib/logger';

const INTERVAL_MS = 3 * 60_000; // every 3 minutes
const LEAD_MS = 30 * 60_000; // remind ~30 minutes ahead

/**
 * Finds SCHEDULED classes starting within the next 30 minutes and reminds both
 * parties once. The claim is a findOneAndUpdate guarded on `reminderSentAt` not
 * existing, so overlapping runs / multiple instances can never double-send.
 */
export async function sendClassReminders(now: Date = new Date()): Promise<number> {
  const horizon = new Date(now.getTime() + LEAD_MS);
  const candidates = await ScheduledClassModel.find(
    {
      status: ClassStatus.SCHEDULED,
      isDeleted: false,
      startUTC: { $gt: now, $lte: horizon },
      reminderSentAt: { $exists: false },
      // A request the student has not accepted is not a commitment to remind anyone about.
      requestStatus: { $ne: 'PENDING' },
    },
    { publicId: 1 },
  ).limit(500).lean();

  let sent = 0;
  for (const c of candidates) {
    const claimed = await ScheduledClassModel.findOneAndUpdate(
      { publicId: c.publicId, status: ClassStatus.SCHEDULED, reminderSentAt: { $exists: false } },
      { $set: { reminderSentAt: new Date() } },
      { new: true },
    ).lean();
    if (!claimed) continue; // another run got it

    try {
      const [tutor, student] = await Promise.all([
        TutorProfileModel.findOne({ publicId: claimed.tutorPublicId }, { userPublicId: 1 }).lean(),
        StudentProfileModel.findOne({ publicId: claimed.studentPublicId }, { userPublicId: 1 }).lean(),
      ]);
      const minutes = Math.max(1, Math.round((claimed.startUTC.getTime() - Date.now()) / 60_000));
      const body = `"${claimed.title}" starts in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
      for (const uid of [tutor?.userPublicId, student?.userPublicId]) {
        if (!uid) continue;
        await notificationService.create({
          recipientPublicId: uid,
          type: NotificationType.CLASS_REMINDER,
          title: 'Class starting soon',
          body,
          data: { classPublicId: claimed.publicId },
        });
      }
      sent++;
    } catch (err) {
      logger.warn('[class-reminder] notify failed', { classPublicId: c.publicId, err: String(err) });
    }
  }
  if (sent > 0) logger.info(`[class-reminder] Reminded ${sent} class(es)`);
  return sent;
}

export function startClassReminderJob(): void {
  sendClassReminders().catch((err) => logger.error('[class-reminder] Initial run failed', { err }));
  setInterval(() => {
    sendClassReminders().catch((err) => logger.error('[class-reminder] Run failed', { err }));
  }, INTERVAL_MS);
  logger.info(`[class-reminder] Job started checking every ${INTERVAL_MS / 60_000}min, lead ${LEAD_MS / 60_000}min`);
}
