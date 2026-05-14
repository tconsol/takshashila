import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useTutorSlots } from '../../hooks/use-schedules';
import { useBookClass } from '../../hooks/use-classes';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuthStore } from '../../stores/auth.store';
import type { TutorProfile } from '../../services/tutors.service';

const schema = z.object({
  slotPublicId: z.string().min(1, 'Select a time slot'),
  classType: z.enum(['DEMO', 'REGULAR', 'INTENSIVE']),
  subject: z.string().min(1, 'Subject is required'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface BookClassModalProps {
  open: boolean;
  onClose: () => void;
  tutor: TutorProfile;
  onSuccess?: () => void;
}

export function BookClassModal({ open, onClose, tutor, onSuccess }: BookClassModalProps) {
  const [error, setError] = useState<string | null>(null);
  const userTimezone = useAuthStore((s) => s.user?.timezone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data: slots = [], isLoading: slotsLoading } = useTutorSlots(tutor.publicId);
  const { mutateAsync: bookClass, isPending } = useBookClass();

  const availableSlots = slots.filter((s) => s.status === 'AVAILABLE');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { classType: 'REGULAR', subject: tutor.subjects[0] ?? '' },
  });

  const slotOptions = availableSlots.map((s) => ({
    value: s.publicId,
    label: `${formatInTimeZone(new Date(s.startUTC), userTimezone, 'EEE MMM d, h:mm a')} – ${formatInTimeZone(new Date(s.endUTC), userTimezone, 'h:mm a')} (${userTimezone.split('/').pop()?.replace('_', ' ')})`,
  }));

  const subjectOptions = tutor.subjects.map((s) => ({ value: s, label: s }));

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await bookClass({ tutorPublicId: tutor.publicId, ...data });
      reset();
      onSuccess?.();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to book class');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Book a class with ${tutor.displayName}`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isPending}>Confirm Booking</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {slotsLoading ? (
          <p className="text-sm text-gray-500">Loading available slots…</p>
        ) : availableSlots.length === 0 ? (
          <p className="text-sm text-gray-500">No available slots for this tutor.</p>
        ) : (
          <Select
            label="Time Slot"
            options={slotOptions}
            placeholder="Select a slot"
            error={errors.slotPublicId?.message}
            {...register('slotPublicId')}
          />
        )}

        <Select
          label="Class Type"
          options={[
            { value: 'DEMO', label: 'Demo (Free)' },
            { value: 'REGULAR', label: 'Regular' },
            { value: 'INTENSIVE', label: 'Intensive' },
          ]}
          error={errors.classType?.message}
          {...register('classType')}
        />

        <Select
          label="Subject"
          options={subjectOptions}
          placeholder="Select subject"
          error={errors.subject?.message}
          {...register('subject')}
        />

        <Input
          label="Notes (optional)"
          placeholder="Any special requirements…"
          {...register('notes')}
        />

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
        )}
      </form>
    </Modal>
  );
}
