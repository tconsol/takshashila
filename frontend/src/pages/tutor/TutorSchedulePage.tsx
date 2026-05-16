import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../stores/auth.store';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { zonedTimeToUtc, formatInTimeZone } from 'date-fns-tz';
import { ChevronLeft, ChevronRight, Plus, Globe, Pencil, Trash2, AlertTriangle, Clock, CalendarDays } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useMySlots, useCreateSlot, useCancelSlot, useRescheduleSlot } from '../../hooks/use-schedules';
import type { AvailabilitySlot } from '../../services/schedules.service';

const slotSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
}).refine((d) => d.startTime < d.endTime, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

type SlotForm = z.infer<typeof slotSchema>;

const SLOT_COLORS: Record<string, string> = {
  AVAILABLE:  'bg-emerald-500 hover:bg-emerald-600',
  BOOKED:     'bg-amber-500 hover:bg-amber-600',
  BLOCKED:    'bg-gray-400 hover:bg-gray-500',
  CANCELLED:  'bg-red-400 hover:bg-red-500',
};

const SLOT_LEGEND: Array<{ key: string; label: string }> = [
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'BOOKED',    label: 'Booked' },
  { key: 'BLOCKED',   label: 'Blocked' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TutorSchedulePage() {
  const userTimezone = useAuthStore((s) => s.user?.timezone);
  const defaultTz = userTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [showCreate, setShowCreate] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Slot detail popup (click on pill)
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);

  // Reschedule modal state
  const [rescheduleSlot, setRescheduleSlot] = useState<AvailabilitySlot | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Cancel confirm state
  const [cancelTarget, setCancelTarget] = useState<AvailabilitySlot | null>(null);

  const calStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
  const calEnd   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 0 });
  const calDays  = eachDayOfInterval({ start: calStart, end: calEnd });
  const rowCount = calDays.length / 7;

  const { data: slots = [], isLoading } = useMySlots({
    from: calStart.toISOString(),
    to:   calEnd.toISOString(),
  });

  const { mutateAsync: createSlot, isPending: creating } = useCreateSlot();
  const { mutateAsync: cancelSlot, isPending: cancelling } = useCancelSlot();
  const { mutateAsync: rescheduleSlotMutation, isPending: rescheduling } = useRescheduleSlot();

  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<SlotForm>({
    resolver: zodResolver(slotSchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd') },
  });

  const rescheduleForm = useForm<SlotForm>({
    resolver: zodResolver(slotSchema),
  });

  const openCreate = useCallback((date?: Date) => {
    if (date) setValue('date', format(date, 'yyyy-MM-dd'));
    setFormError(null);
    setShowCreate(true);
  }, [setValue]);

  const openReschedule = useCallback((slot: AvailabilitySlot) => {
    const startLocal = formatInTimeZone(new Date(slot.startUTC), defaultTz, 'yyyy-MM-dd');
    const startTime  = formatInTimeZone(new Date(slot.startUTC), defaultTz, 'HH:mm');
    const endTime    = formatInTimeZone(new Date(slot.endUTC),   defaultTz, 'HH:mm');
    rescheduleForm.reset({ date: startLocal, startTime, endTime });
    setRescheduleError(null);
    setSelectedSlot(null);
    setRescheduleSlot(slot);
  }, [defaultTz, rescheduleForm]);

  const onSubmit = async (data: SlotForm) => {
    setFormError(null);
    try {
      const startUTC = zonedTimeToUtc(new Date(`${data.date}T${data.startTime}`), defaultTz).toISOString();
      const endUTC   = zonedTimeToUtc(new Date(`${data.date}T${data.endTime}`),   defaultTz).toISOString();
      await createSlot({ startUTC, endUTC, ianaTimezone: defaultTz });
      reset({ date: format(new Date(), 'yyyy-MM-dd') });
      setShowCreate(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to create slot');
    }
  };

  const onReschedule = async (data: SlotForm) => {
    if (!rescheduleSlot) return;
    setRescheduleError(null);
    try {
      const startUTC = zonedTimeToUtc(new Date(`${data.date}T${data.startTime}`), defaultTz).toISOString();
      const endUTC   = zonedTimeToUtc(new Date(`${data.date}T${data.endTime}`),   defaultTz).toISOString();
      await rescheduleSlotMutation({ slotPublicId: rescheduleSlot.publicId, startUTC, endUTC });
      setRescheduleSlot(null);
    } catch (e: unknown) {
      setRescheduleError(e instanceof Error ? e.message : 'Failed to reschedule slot');
    }
  };

  const openCancel = useCallback((slot: AvailabilitySlot) => {
    setSelectedSlot(null);
    setCancelTarget(slot);
  }, []);

  const onConfirmCancel = async () => {
    if (!cancelTarget) return;
    await cancelSlot(cancelTarget.publicId);
    setCancelTarget(null);
  };

  const isThisMonth = format(currentMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  return (
    <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900" style={{ minHeight: 620 }}>

      {/* ── Left sidebar ── */}
      <aside className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col gap-5 p-4 bg-white dark:bg-gray-900">
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-700 hover:to-violet-700 active:scale-[0.98] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 transition-all"
        >
          <Plus size={18} />
          Add Slot
        </button>

        <MiniCalendar
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onDateClick={openCreate}
          slots={slots}
        />

        <div className="mt-auto space-y-1.5">
          {SLOT_LEGEND.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className={`w-2.5 h-2.5 rounded-sm ${SLOT_COLORS[key].split(' ')[0]}`} />
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
            const daySlots  = slots.filter((s) => isSameDay(new Date(s.startUTC), day));
            const inMonth   = isSameMonth(day, currentMonth);
            const today     = isToday(day);

            return (
              <div
                key={day.toISOString()}
                onClick={() => openCreate(day)}
                className={`
                  border-b border-r border-gray-100 dark:border-gray-800
                  p-1 cursor-pointer transition-colors
                  hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10
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
                  {daySlots.slice(0, 3).map((slot) => (
                    <SlotPill
                      key={slot.publicId}
                      slot={slot}
                      userTimezone={defaultTz}
                      onClick={(s) => setSelectedSlot(s)}
                    />
                  ))}
                  {daySlots.length > 3 && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 pl-1">
                      +{daySlots.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Add Slot Modal ── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setFormError(null); }}
        title="Add Availability Slot"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={creating}>Create Slot</Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Date" type="date" error={errors.date?.message} {...register('date')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Time" type="time" error={errors.startTime?.message} {...register('startTime')} />
            <Input label="End Time"   type="time" error={errors.endTime?.message}   {...register('endTime')} />
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-3 py-2 text-sm">
            <Globe size={14} className="text-indigo-500 shrink-0" />
            <span className="text-indigo-700 dark:text-indigo-300">
              Times are in <span className="font-medium">{defaultTz}</span>
              {' '}
              <span className="text-indigo-500">
                (UTC{formatInTimeZone(new Date(), defaultTz, 'xxx')})
              </span>
            </span>
          </div>
          {formError && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">{formError}</p>
          )}
        </form>
      </Modal>

      {/* ── Reschedule Modal ── */}
      <Modal
        open={!!rescheduleSlot}
        onClose={() => { setRescheduleSlot(null); setRescheduleError(null); }}
        title="Reschedule Slot"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRescheduleSlot(null)}>Cancel</Button>
            <Button onClick={rescheduleForm.handleSubmit(onReschedule)} loading={rescheduling}>Save Changes</Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={rescheduleForm.handleSubmit(onReschedule)}>
          <Input
            label="Date"
            type="date"
            error={rescheduleForm.formState.errors.date?.message}
            {...rescheduleForm.register('date')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Time"
              type="time"
              error={rescheduleForm.formState.errors.startTime?.message}
              {...rescheduleForm.register('startTime')}
            />
            <Input
              label="End Time"
              type="time"
              error={rescheduleForm.formState.errors.endTime?.message}
              {...rescheduleForm.register('endTime')}
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-3 py-2 text-sm">
            <Globe size={14} className="text-indigo-500 shrink-0" />
            <span className="text-indigo-700 dark:text-indigo-300">
              Times are in <span className="font-medium">{defaultTz}</span>
            </span>
          </div>
          {rescheduleError && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">{rescheduleError}</p>
          )}
        </form>
      </Modal>

      {/* ── Slot Detail Modal ── */}
      {selectedSlot && (
        <SlotDetailPanel
          slot={selectedSlot}
          userTimezone={defaultTz}
          onClose={() => setSelectedSlot(null)}
          onReschedule={() => openReschedule(selectedSlot)}
          onCancel={() => openCancel(selectedSlot)}
        />
      )}

      {/* ── Cancel Confirm Modal ── */}
      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Slot"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>Keep Slot</Button>
            <Button
              variant="danger"
              onClick={onConfirmCancel}
              loading={cancelling}
            >
              Yes, Cancel Slot
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Are you sure you want to cancel this slot?
            </p>
            {cancelTarget && (
              <p className="mt-1 text-xs text-gray-500">
                {formatInTimeZone(new Date(cancelTarget.startUTC), defaultTz, 'EEE, MMM d · h:mm a')}
                {' – '}
                {formatInTimeZone(new Date(cancelTarget.endUTC), defaultTz, 'h:mm a zzz')}
              </p>
            )}
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              The slot will remain visible on the calendar as Cancelled.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Mini calendar in sidebar ────────────────────────────────────────
function MiniCalendar({
  currentMonth,
  onMonthChange,
  onDateClick,
  slots,
}: {
  currentMonth: Date;
  onMonthChange: (d: Date) => void;
  onDateClick: (d: Date) => void;
  slots: AvailabilitySlot[];
}) {
  const calStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
  const calEnd   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 0 });
  const days     = eachDayOfInterval({ start: calStart, end: calEnd });

  const dotColor = (day: Date) => {
    const daySlots = slots.filter((s) => isSameDay(new Date(s.startUTC), day));
    if (daySlots.some((s) => s.status === 'AVAILABLE')) return 'bg-emerald-500';
    if (daySlots.some((s) => s.status === 'BOOKED'))    return 'bg-amber-500';
    if (daySlots.some((s) => s.status === 'BLOCKED'))   return 'bg-gray-400';
    if (daySlots.some((s) => s.status === 'CANCELLED')) return 'bg-red-400';
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
            <button
              key={day.toISOString()}
              onClick={() => onDateClick(day)}
              className={`
                relative flex items-center justify-center rounded-full
                w-6 h-6 mx-auto my-px text-[11px] transition-colors
                ${today
                  ? 'bg-blue-600 text-white font-bold'
                  : inMonth
                    ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    : 'text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                }
              `}
            >
              {format(day, 'd')}
              {dot && !today && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${dot}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Slot event pill in the grid ─────────────────────────────────────
function SlotPill({
  slot,
  userTimezone,
  onClick,
}: {
  slot: AvailabilitySlot;
  userTimezone: string;
  onClick: (slot: AvailabilitySlot) => void;
}) {
  const timeLabel =
    formatInTimeZone(new Date(slot.startUTC), userTimezone, 'h:mm') +
    ' – ' +
    formatInTimeZone(new Date(slot.endUTC), userTimezone, 'h:mm a');

  return (
    <button
      type="button"
      className={`w-full text-left rounded px-1.5 py-0.5 text-[11px] font-medium text-white truncate transition-opacity ${
        slot.status === 'CANCELLED' ? 'opacity-60 line-through' : ''
      } ${SLOT_COLORS[slot.status] ?? SLOT_COLORS.BLOCKED}`}
      onClick={(e) => { e.stopPropagation(); onClick(slot); }}
      title="Click to manage this slot"
    >
      {timeLabel}
    </button>
  );
}

// ── Slot Detail Panel (replaces generic modal) ───────────────────────
const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  AVAILABLE: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', label: 'Available' },
  BOOKED:    { bg: 'bg-amber-500/10 dark:bg-amber-500/20',   text: 'text-amber-700 dark:text-amber-300',   dot: 'bg-amber-500',   label: 'Booked' },
  BLOCKED:   { bg: 'bg-gray-500/10 dark:bg-gray-500/20',     text: 'text-gray-600 dark:text-gray-300',     dot: 'bg-gray-500',    label: 'Blocked' },
  CANCELLED: { bg: 'bg-red-500/10 dark:bg-red-500/20',       text: 'text-red-600 dark:text-red-400',       dot: 'bg-red-500',     label: 'Cancelled' },
};

function SlotDetailPanel({
  slot,
  userTimezone,
  onClose,
  onReschedule,
  onCancel,
}: {
  slot: AvailabilitySlot;
  userTimezone: string;
  onClose: () => void;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const cfg = STATUS_CONFIG[slot.status] ?? STATUS_CONFIG.BLOCKED;
  const dayOfWeek  = formatInTimeZone(new Date(slot.startUTC), userTimezone, 'EEEE');
  const dateStr    = formatInTimeZone(new Date(slot.startUTC), userTimezone, 'MMMM d, yyyy');
  const startTime  = formatInTimeZone(new Date(slot.startUTC), userTimezone, 'h:mm a');
  const endTime    = formatInTimeZone(new Date(slot.endUTC),   userTimezone, 'h:mm a');
  const isAvailable = slot.status === 'AVAILABLE';

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
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/35 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Status pill */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white mb-4">
            <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </div>

          {/* Day + date */}
          <p className="text-white/70 text-sm font-medium tracking-wide">{dayOfWeek}</p>
          <p className="text-white text-3xl font-bold tracking-tight mt-1">{dateStr}</p>

          {/* Time row inside header */}
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 shrink-0">
              <Clock size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white text-base font-bold">{startTime} – {endTime}</p>
              <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1">
                <Globe size={10} />
                {userTimezone}
              </p>
            </div>
          </div>
        </div>

        {/* ── Info banners ── */}
        {slot.status === 'BOOKED' && (
          <div className="mx-6 mt-5 flex items-start gap-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3.5">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
              This slot is booked. Cancel the class first to free it.
            </p>
          </div>
        )}
        {slot.status === 'CANCELLED' && (
          <div className="mx-6 mt-5 flex items-start gap-3 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3.5">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400 leading-relaxed">
              This slot is cancelled and no longer bookable.
            </p>
          </div>
        )}
        {slot.status === 'BLOCKED' && (
          <div className="mx-6 mt-5 flex items-start gap-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-4 py-3.5">
            <Clock size={16} className="text-gray-400 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              This slot expired without being booked and was automatically blocked.
            </p>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="px-6 pt-5 pb-6 space-y-3">
          {isAvailable && (
            <>
              <button
                onClick={onReschedule}
                className="flex w-full items-center gap-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] px-5 py-4 text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-500/25"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 shrink-0">
                  <Pencil size={15} />
                </span>
                <span className="text-base">Reschedule Slot</span>
                <ChevronRight size={16} className="ml-auto opacity-60" />
              </button>

              <button
                onClick={onCancel}
                className="flex w-full items-center gap-4 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 active:scale-[0.98] px-5 py-4 text-sm font-semibold text-red-600 dark:text-red-400 transition-all border border-red-200 dark:border-red-800"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40 shrink-0">
                  <Trash2 size={15} className="text-red-500" />
                </span>
                <span className="text-base">Cancel Slot</span>
                <ChevronRight size={16} className="ml-auto opacity-40" />
              </button>
            </>
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
