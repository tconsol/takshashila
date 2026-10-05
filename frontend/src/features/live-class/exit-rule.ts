import type { PresenceProgress } from '../../services/classes.service';

/** How often the room page tells the server "I am here". */
export const PRESENCE_HEARTBEAT_MS = 30_000;

/**
 * Whether leaving now could cost this person: they have not yet attended the required
 * minutes, and the class is still running so there is time left to reach them.
 */
export function isUnderRequired(progress: PresenceProgress | null, classEndMs: number | null, nowMs = Date.now()): boolean {
  if (!progress) return false;
  if (classEndMs !== null && nowMs >= classEndMs) return false;
  return progress.attendedMinutes < progress.requiredMinutes;
}

/** Whole minutes still needed to reach the requirement (at least 1 while under it). */
export function minutesStillNeeded(progress: PresenceProgress): number {
  return Math.max(1, Math.ceil(progress.requiredMinutes - progress.attendedMinutes));
}

/** Text for the "leave early?" confirmation, worded for who is leaving. */
export function leaveWarning(progress: PresenceProgress, isTutor: boolean): { title: string; message: string } {
  const attended = Math.floor(progress.attendedMinutes);
  const need = minutesStillNeeded(progress);
  const so_far = `You have attended ${attended} of the ${progress.requiredMinutes} minutes this class needs, so you need ${need} more minute${need === 1 ? '' : 's'}.`;
  const awayNote = 'A short disconnect is fine, but time away for longer than a few minutes does not count.';
  if (isTutor) {
    return {
      title: 'Leave the class early?',
      message: `${so_far} If you do not reach it, the class is marked incomplete: students are not charged and you are not paid. ${awayNote} You can rejoin until the class ends.`,
    };
  }
  return {
    title: 'Leave the class early?',
    message: `${so_far} If you attend less than that and your tutor stays, you are still charged for this class. ${awayNote} You can rejoin until the class ends.`,
  };
}
