import { zonedTimeToUtc, utcToZonedTime, format as tzFormat } from 'date-fns-tz';
import { addMinutes, isBefore, isAfter, areIntervalsOverlapping } from 'date-fns';

export function toUTC(localDate: Date, ianaTimezone: string): Date {
  return zonedTimeToUtc(localDate, ianaTimezone);
}

export function fromUTC(utcDate: Date, ianaTimezone: string): Date {
  return utcToZonedTime(utcDate, ianaTimezone);
}

export function formatInTimezone(utcDate: Date, ianaTimezone: string, fmt: string): string {
  return tzFormat(utcToZonedTime(utcDate, ianaTimezone), fmt, { timeZone: ianaTimezone });
}

export function nowUTC(): Date {
  return new Date();
}

export function addMinutesToUTC(utcDate: Date, minutes: number): Date {
  return addMinutes(utcDate, minutes);
}

export function isSlotInPast(startUTC: Date): boolean {
  return isBefore(startUTC, nowUTC());
}

export function doSlotsOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): boolean {
  return areIntervalsOverlapping(
    { start: a.start, end: a.end },
    { start: b.start, end: b.end },
  );
}

export function isValidIANATimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
