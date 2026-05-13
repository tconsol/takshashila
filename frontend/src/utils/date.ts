import { format, formatDistanceToNow, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy');
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy, hh:mm a');
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'hh:mm a');
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function friendlyDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isToday(d)) return `Today at ${formatTime(d)}`;
  if (isTomorrow(d)) return `Tomorrow at ${formatTime(d)}`;
  return formatDateTime(d);
}

export function isOverdue(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isPast(d);
}

export function toUTCISOString(date: Date): string {
  return date.toISOString();
}
