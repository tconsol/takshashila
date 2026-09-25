// server/src/shared/availability.ts
export interface AvailabilityWindow {
  daysOfWeek: number[]; // 0 (Sun) – 6 (Sat)
  startLocalTime: string; // "16:00"
  endLocalTime: string; // "19:00"
  ianaTimezone: string;
}

/** Minutes since local midnight and weekday of `at` in `ianaTimezone`. */
function localMinutesOfDay(at: Date, ianaTimezone: string): { minutes: number; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { minutes: hour * 60 + minute, dayOfWeek: dayMap[weekday] ?? 0 };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** True when [start, end] falls on an allowed weekday inside the window, in its timezone. */
export function isWithinAvailability(window: AvailabilityWindow, start: Date, end: Date): boolean {
  const { minutes: startMinutes, dayOfWeek } = localMinutesOfDay(start, window.ianaTimezone);
  const { minutes: endMinutes } = localMinutesOfDay(end, window.ianaTimezone);
  const windowStart = toMinutes(window.startLocalTime);
  const windowEnd = toMinutes(window.endLocalTime);
  return window.daysOfWeek.includes(dayOfWeek) && startMinutes >= windowStart && startMinutes <= windowEnd && endMinutes <= windowEnd;
}
