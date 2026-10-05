/**
 * Pure attendance maths for a live class. No database access, so the rules are
 * easy to test: how heartbeats merge into "present" intervals, and how much of
 * the scheduled class a person was present for.
 */

export interface PresenceInterval {
  start: Date;
  end: Date;
}

/**
 * Record that a person was seen at `now`. A gap up to `graceMs` since they were
 * last seen counts as present (the interval is extended across it); a longer gap
 * starts a new interval, so the time away is not counted.
 */
export function applyHeartbeat(
  intervals: readonly PresenceInterval[],
  now: Date,
  graceMs: number,
): PresenceInterval[] {
  const out = intervals.map((i) => ({ start: new Date(i.start), end: new Date(i.end) }));
  const last = out[out.length - 1];
  if (last && now.getTime() - last.end.getTime() <= graceMs) {
    // Never move an end backwards: a late-arriving older heartbeat changes nothing.
    if (now.getTime() > last.end.getTime()) last.end = new Date(now);
  } else {
    out.push({ start: new Date(now), end: new Date(now) });
  }
  return out;
}

/** Milliseconds of `intervals` that fall inside the scheduled class window. */
export function attendedMs(
  intervals: readonly PresenceInterval[],
  windowStart: Date,
  windowEnd: Date,
): number {
  const ws = windowStart.getTime();
  const we = windowEnd.getTime();
  let total = 0;
  for (const i of intervals) {
    const from = Math.max(new Date(i.start).getTime(), ws);
    const to = Math.min(new Date(i.end).getTime(), we);
    if (to > from) total += to - from;
  }
  return total;
}

/**
 * Whole minutes a person must attend: the required percentage of the class
 * length, rounded up (83% of 60 min is 50, of 30 min is 25).
 */
export function requiredAttendanceMinutes(durationMinutes: number, percent: number): number {
  return Math.max(1, Math.ceil((durationMinutes * percent) / 100));
}
