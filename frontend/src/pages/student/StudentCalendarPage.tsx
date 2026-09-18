import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  isSameDay,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ChevronLeft, ChevronRight, Globe, Clock, Video, GraduationCap, X } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { useMyClassesAsStudent } from '../../hooks/use-classes';
import type { ClassRecord } from '../../services/classes.service';

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED:   'bg-indigo-500 hover:bg-indigo-600',
  LIVE:        'bg-rose-500 hover:bg-rose-600',
  COMPLETED:   'bg-emerald-500 hover:bg-emerald-600',
  CANCELLED:   'bg-gray-400 hover:bg-gray-500',
  MISSED:      'bg-gray-400 hover:bg-gray-500',
  RESCHEDULED: 'bg-amber-500 hover:bg-amber-600',
  FAILED:      'bg-red-500 hover:bg-red-600',
};

const STATUS_LEGEND: Array<{ key: string; label: string }> = [
  { key: 'SCHEDULED', label: 'Upcoming' },
  { key: 'LIVE',       label: 'Live now' },
  { key: 'COMPLETED',  label: 'Completed' },
  { key: 'CANCELLED',  label: 'Cancelled / Missed' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Same window as the dashboard's Join button: 15 minutes either side of start.
function isJoinable(cls: ClassRecord): boolean {
  const startsAt = new Date(cls.scheduledStartUTC).getTime();
  const now = Date.now();
  return now >= startsAt - 15 * 60_000 && now <= startsAt + 15 * 60_000;
}

export function StudentCalendarPage() {
  const userTimezone = useAuthStore((s) => s.user?.timezone);
  const defaultTz = userTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const navigate = useNavigate();

  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedClass, setSelectedClass] = useState<ClassRecord | null>(null);

  const calStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
  const calEnd   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 0 });
  const calDays  = eachDayOfInterval({ start: calStart, end: calEnd });
  const rowCount = calDays.length / 7;

  const { data, isLoading } = useMyClassesAsStudent({
    from: calStart.toISOString(),
    to: calEnd.toISOString(),
    limit: '100',
  });
  const classes = data?.items ?? [];

  const isThisMonth = format(currentMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  return (
    <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900" style={{ minHeight: 620 }}>

      {/* ── Left sidebar ── */}
      <aside className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col gap-5 p-4 bg-white dark:bg-gray-900">
        <MiniCalendar
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          classes={classes}
        />

        <div className="mt-auto space-y-1.5">
          {STATUS_LEGEND.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_COLORS[key].split(' ')[0]}`} />
              {label}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main calendar area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 w-40">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m, -1))}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {!isThisMonth && (
            <button
              onClick={() => setCurrentMonth(startOfMonth(new Date()))}
              className="px-3 py-1 text-sm rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Today
            </button>
          )}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Globe size={12} />
            <span>{defaultTz} (UTC{formatInTimeZone(new Date(), defaultTz, 'xxx')})</span>
          </div>
          {isLoading && (
            <div className="ml-2 w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {DAY_LABELS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          className="flex-1 grid grid-cols-7"
          style={{ gridTemplateRows: `repeat(${rowCount}, minmax(90px, 1fr))` }}
        >
          {calDays.map((day) => {
            const dayClasses = classes.filter((c) => isSameDay(new Date(c.scheduledStartUTC), day));
            const inMonth    = isSameMonth(day, currentMonth);
            const today      = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`
                  border-b border-r border-gray-100 dark:border-gray-800
                  p-1 transition-colors
                  ${!inMonth ? 'bg-gray-50 dark:bg-gray-900/60' : 'bg-white dark:bg-gray-900'}
                `}
              >
                <div className="flex items-center justify-center mb-1">
                  <span
                    className={`
                      w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium leading-none
                      ${today
                        ? 'bg-blue-600 text-white'
                        : inMonth
                          ? 'text-gray-800 dark:text-gray-100'
                          : 'text-gray-400 dark:text-gray-600'
                      }
                    `}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                <div className="space-y-0.5">
                  {dayClasses.slice(0, 3).map((cls) => (
                    <ClassPill
                      key={cls.publicId}
                      cls={cls}
                      userTimezone={defaultTz}
                      onClick={(c) => setSelectedClass(c)}
                    />
                  ))}
                  {dayClasses.length > 3 && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 pl-1">
                      +{dayClasses.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Class Detail Panel ── */}
      {selectedClass && (
        <ClassDetailPanel
          cls={selectedClass}
          userTimezone={defaultTz}
          onClose={() => setSelectedClass(null)}
          onJoin={() => navigate(`/class/${selectedClass.publicId}`)}
        />
      )}
    </div>
  );
}

// ── Mini calendar in sidebar ────────────────────────────────────────
function MiniCalendar({
  currentMonth,
  onMonthChange,
  classes,
}: {
  currentMonth: Date;
  onMonthChange: (d: Date) => void;
  classes: ClassRecord[];
}) {
  const calStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
  const calEnd   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 0 });
  const days     = eachDayOfInterval({ start: calStart, end: calEnd });

  const dotColor = (day: Date) => {
    const dayClasses = classes.filter((c) => isSameDay(new Date(c.scheduledStartUTC), day));
    if (dayClasses.some((c) => c.status === 'LIVE'))      return 'bg-rose-500';
    if (dayClasses.some((c) => c.status === 'SCHEDULED')) return 'bg-indigo-500';
    if (dayClasses.some((c) => c.status === 'COMPLETED')) return 'bg-emerald-500';
    if (dayClasses.length > 0)                            return 'bg-gray-400';
    return null;
  };

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {format(currentMonth, 'MMM yyyy')}
        </span>
        <div className="flex gap-0.5">
          <button
            onClick={() => onMonthChange(addMonths(currentMonth, -1))}
            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-0.5">
        {['S','M','T','W','T','F','S'].map((l, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 py-0.5">
            {l}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentMonth);
          const today   = isToday(day);
          const dot     = dotColor(day);
          return (
            <div
              key={day.toISOString()}
              className={`
                relative flex items-center justify-center rounded-full
                w-6 h-6 mx-auto my-px text-[11px]
                ${today
                  ? 'bg-blue-600 text-white font-bold'
                  : inMonth
                    ? 'text-gray-700 dark:text-gray-200'
                    : 'text-gray-300 dark:text-gray-600'
                }
              `}
            >
              {format(day, 'd')}
              {dot && !today && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${dot}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Class event pill in the grid ─────────────────────────────────────
function ClassPill({
  cls,
  userTimezone,
  onClick,
}: {
  cls: ClassRecord;
  userTimezone: string;
  onClick: (cls: ClassRecord) => void;
}) {
  const timeLabel = formatInTimeZone(new Date(cls.scheduledStartUTC), userTimezone, 'h:mm a');

  return (
    <button
      type="button"
      className={`w-full text-left rounded px-1.5 py-0.5 text-[11px] font-medium text-white truncate transition-opacity ${
        cls.status === 'CANCELLED' || cls.status === 'MISSED' ? 'opacity-60 line-through' : ''
      } ${STATUS_COLORS[cls.status] ?? STATUS_COLORS.SCHEDULED}`}
      onClick={(e) => { e.stopPropagation(); onClick(cls); }}
      title={cls.subject}
    >
      {timeLabel} · {cls.subject}
    </button>
  );
}

// ── Class Detail Panel ────────────────────────────────────────────
const DETAIL_STATUS_CONFIG: Record<string, { text: string; dot: string; label: string }> = {
  SCHEDULED:   { text: 'text-indigo-700 dark:text-indigo-300',   dot: 'bg-indigo-500',  label: 'Upcoming' },
  LIVE:        { text: 'text-rose-700 dark:text-rose-300',       dot: 'bg-rose-500',    label: 'Live now' },
  COMPLETED:   { text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', label: 'Completed' },
  CANCELLED:   { text: 'text-gray-600 dark:text-gray-300',       dot: 'bg-gray-500',    label: 'Cancelled' },
  MISSED:      { text: 'text-gray-600 dark:text-gray-300',       dot: 'bg-gray-500',    label: 'Missed' },
  RESCHEDULED: { text: 'text-amber-700 dark:text-amber-300',     dot: 'bg-amber-500',   label: 'Rescheduled' },
  FAILED:      { text: 'text-red-600 dark:text-red-400',         dot: 'bg-red-500',     label: 'Failed' },
};

function ClassDetailPanel({
  cls,
  userTimezone,
  onClose,
  onJoin,
}: {
  cls: ClassRecord;
  userTimezone: string;
  onClose: () => void;
  onJoin: () => void;
}) {
  const cfg = DETAIL_STATUS_CONFIG[cls.status] ?? DETAIL_STATUS_CONFIG.SCHEDULED;
  const dayOfWeek = formatInTimeZone(new Date(cls.scheduledStartUTC), userTimezone, 'EEEE');
  const dateStr   = formatInTimeZone(new Date(cls.scheduledStartUTC), userTimezone, 'MMMM d, yyyy');
  const startTime = formatInTimeZone(new Date(cls.scheduledStartUTC), userTimezone, 'h:mm a');
  const endTime   = cls.scheduledEndUTC
    ? formatInTimeZone(new Date(cls.scheduledEndUTC), userTimezone, 'h:mm a')
    : null;
  const joinable  = (cls.status === 'SCHEDULED' || cls.status === 'LIVE') && isJoinable(cls);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Gradient header ── */}
        <div className="relative bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 px-7 pt-7 pb-7">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/35 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white mb-4">
            <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </div>

          <p className="text-white/70 text-sm font-medium tracking-wide">{dayOfWeek}</p>
          <p className="text-white text-2xl font-bold tracking-tight mt-1 truncate">{cls.subject}</p>
          <p className="text-white/80 text-sm mt-1">{dateStr}</p>

          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 shrink-0">
              <Clock size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white text-base font-bold">
                {startTime}{endTime ? ` – ${endTime}` : ''}
              </p>
              <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1">
                <Globe size={10} />
                {userTimezone}
              </p>
            </div>
          </div>
        </div>

        {/* ── Info ── */}
        <div className="mx-6 mt-5 flex items-center gap-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-4 py-3.5">
          <GraduationCap size={16} className="text-gray-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {cls.tutorName ?? 'Tutor'}
            </p>
            <p className="text-xs text-gray-400">{cls.classType}</p>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="px-6 pt-5 pb-6 space-y-3">
          {joinable ? (
            <button
              onClick={onJoin}
              className="flex w-full items-center gap-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] px-5 py-4 text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-500/25"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 shrink-0">
                <Video size={15} />
              </span>
              <span className="text-base">Join Class</span>
              <ChevronRight size={16} className="ml-auto opacity-60" />
            </button>
          ) : (
            <p className="text-center text-xs text-gray-400 px-2">
              {cls.status === 'SCHEDULED' || cls.status === 'LIVE'
                ? 'Join opens 15 minutes before the scheduled time.'
                : 'This class is no longer active.'}
            </p>
          )}

          <button
            onClick={onClose}
            className="w-full rounded-2xl py-3 text-sm font-medium text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
