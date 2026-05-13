import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, startOfWeek } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { useMySlots, useCreateSlot, useDeleteSlot } from '../../hooks/use-schedules';
import { TIMEZONE_OPTIONS } from '../../constants/timezones';
import type { AvailabilitySlot } from '../../services/schedules.service';

const slotSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  timezone: z.string().default('UTC'),
}).refine((d) => d.startTime < d.endTime, { message: 'End time must be after start time', path: ['endTime'] });

type SlotForm = z.infer<typeof slotSchema>;

const statusVariant: Record<string, 'success' | 'warning' | 'default'> = {
  AVAILABLE: 'success',
  BOOKED: 'warning',
  BLOCKED: 'default',
};

export function TutorSchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
  const from = weekStart.toISOString();
  const to = addDays(weekStart, 7).toISOString();

  const { data: slots = [], isLoading } = useMySlots({ from, to });
  const { mutateAsync: createSlot, isPending: creating } = useCreateSlot();
  const { mutateAsync: deleteSlot } = useDeleteSlot();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<SlotForm>({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  const onSubmit = async (data: SlotForm) => {
    setError(null);
    try {
      const startUTC = new Date(`${data.date}T${data.startTime}`).toISOString();
      const endUTC = new Date(`${data.date}T${data.endTime}`).toISOString();
      await createSlot({ startUTC, endUTC, timezone: data.timezone });
      reset();
      setShowCreate(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create slot');
    }
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Availability Schedule"
          subtitle="Manage your bookable time slots"
        />
        <Button onClick={() => setShowCreate(true)}>+ Add Slot</Button>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset((p) => p - 1)}>← Prev</Button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[200px] text-center">
          {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset((p) => p + 1)}>Next →</Button>
        {weekOffset !== 0 && (
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const daySlots = slots.filter(
              (s) => format(new Date(s.startUTC), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'),
            );
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            return (
              <div key={day.toISOString()} className="min-h-[120px]">
                <div className={`text-center py-2 text-xs font-medium rounded-t-lg ${
                  isToday
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  <div>{format(day, 'EEE')}</div>
                  <div className="text-base font-bold">{format(day, 'd')}</div>
                </div>
                <div className="space-y-1 p-1 bg-gray-50 dark:bg-gray-900 rounded-b-lg min-h-[80px]">
                  {daySlots.map((slot) => (
                    <SlotChip key={slot.publicId} slot={slot} onDelete={deleteSlot} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
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
            <Input label="End Time" type="time" error={errors.endTime?.message} {...register('endTime')} />
          </div>
          <Select
            label="Timezone"
            options={TIMEZONE_OPTIONS}
            placeholder="Select timezone"
            {...register('timezone')}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}

function SlotChip({ slot, onDelete }: { slot: AvailabilitySlot; onDelete: (id: string) => void }) {
  return (
    <div className="group relative rounded-md px-1.5 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
      <div className="flex items-center justify-between gap-1">
        <Badge variant={statusVariant[slot.status] ?? 'default'} className="text-[10px] px-1 py-0">
          {slot.status}
        </Badge>
        {slot.status === 'AVAILABLE' && (
          <button
            onClick={() => onDelete(slot.publicId)}
            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity text-[10px]"
          >
            ✕
          </button>
        )}
      </div>
      <p className="text-gray-600 dark:text-gray-400 mt-0.5">
        {format(new Date(slot.startUTC), 'h:mm')}–{format(new Date(slot.endUTC), 'h:mm a')}
      </p>
    </div>
  );
}
