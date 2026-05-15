import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sparkles, Video } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useTutorSlots } from '../../hooks/use-schedules';
import { useBookClass } from '../../hooks/use-classes';
import { useCreateDemoRequest } from '../../hooks/use-demo-requests';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuthStore } from '../../stores/auth.store';
import type { TutorProfile } from '../../services/tutors.service';

const schema = z.object({
  slotPublicId: z.string().min(1, 'Select a time slot'),
  classType: z.enum(['DEMO', 'ONE_ON_ONE', 'GROUP', 'RECURRING']),
  subject: z.string().min(1, 'Subject is required'),
  notes: z.string().max(500).optional(),
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
  const { mutateAsync: bookClass, isPending: isBooking } = useBookClass();
  const { mutateAsync: createDemoRequest, isPending: isRequesting } = useCreateDemoRequest();

  const isPending = isBooking || isRequesting;

  const availableSlots = slots.filter((s) => s.status === 'AVAILABLE');

  const { register, handleSubmit, watch, control, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { classType: 'DEMO', subject: tutor.subjects[0] ?? '' },
  });

  const classType = watch('classType');
  const isDemo = classType === 'DEMO';

  const slotOptions = availableSlots.map((s) => ({
    value: s.publicId,
    label: `${formatInTimeZone(new Date(s.startUTC), userTimezone, 'EEE MMM d, h:mm a')} – ${formatInTimeZone(new Date(s.endUTC), userTimezone, 'h:mm a')}`,
  }));

  const subjectOptions = tutor.subjects.map((s) => ({ value: s, label: s }));

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      if (data.classType === 'DEMO') {
        await createDemoRequest({
          tutorPublicId: tutor.publicId,
          availabilitySlotPublicId: data.slotPublicId,
          preferredSubject: data.subject,
          message: data.notes,
        });
      } else {
        await bookClass({
          tutorPublicId: tutor.publicId,
          availabilitySlotPublicId: data.slotPublicId,
          classType: data.classType,
          title: data.subject,
          description: data.notes,
          idempotencyKey: crypto.randomUUID(),
        });
      }
      reset();
      onSuccess?.();
      onClose();
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (e as any)?.response?.data?.message ?? (e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setError(msg);
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
          <Button onClick={handleSubmit(onSubmit)} loading={isPending}>
            {isDemo ? 'Send Demo Request' : 'Confirm Booking'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {/* Class type selector */}
        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={control}
            name="classType"
            render={({ field }) => (
              <>
                <button
                  type="button"
                  onClick={() => field.onChange('DEMO')}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all ${
                    field.value === 'DEMO'
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <Sparkles className={`h-5 w-5 ${field.value === 'DEMO' ? 'text-brand-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${field.value === 'DEMO' ? 'text-brand-700 dark:text-brand-300' : 'text-gray-600 dark:text-gray-400'}`}>
                    Free Demo
                  </span>
                  <span className="text-[11px] text-gray-400">Tutor reviews & accepts</span>
                </button>
                <button
                  type="button"
                  onClick={() => field.onChange('ONE_ON_ONE')}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all ${
                    field.value === 'ONE_ON_ONE'
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <Video className={`h-5 w-5 ${field.value === 'ONE_ON_ONE' ? 'text-violet-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${field.value === 'ONE_ON_ONE' ? 'text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-gray-400'}`}>
                    1-on-1 Class
                  </span>
                  <span className="text-[11px] text-gray-400">Instant confirmation</span>
                </button>
              </>
            )}
          />
        </div>

        {isDemo && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 dark:bg-amber-900/20 dark:border-amber-800/40">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>Free demo:</strong> Your request goes to the tutor. Once they accept, a class is scheduled automatically.
            </p>
          </div>
        )}

        {slotsLoading ? (
          <p className="text-sm text-gray-500">Loading available slots…</p>
        ) : availableSlots.length === 0 ? (
          <p className="text-sm text-gray-500 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-3">
            No available slots right now. Check back later.
          </p>
        ) : (
          <Select
            label="Preferred Time Slot"
            options={slotOptions}
            placeholder="Select a slot"
            error={errors.slotPublicId?.message}
            {...register('slotPublicId')}
          />
        )}

        <Controller
          control={control}
          name="subject"
          render={({ field }) => (
            <Select
              label="Subject"
              options={subjectOptions}
              placeholder="Select subject"
              error={errors.subject?.message}
              {...field}
            />
          )}
        />

        <Input
          label={isDemo ? 'Message to tutor (optional)' : 'Notes (optional)'}
          placeholder={isDemo ? 'What do you want to learn in the demo?' : 'Any special requirements…'}
          {...register('notes')}
        />

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
        )}
      </form>
    </Modal>
  );
}
