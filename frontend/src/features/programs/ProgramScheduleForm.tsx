// frontend/src/features/programs/ProgramScheduleForm.tsx
import { useState } from 'react';
import { zonedTimeToUtc } from 'date-fns-tz';
import { CalendarPlus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useScheduleSession } from '../../hooks/use-programs';
import type { ProgramModule } from '../../services/programs.service';
import type { AvailabilityWindow } from '../../services/courses.service';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Tutor form that books the next session of a program enrollment. Used on the program page and the enrollment page. */
export function ProgramScheduleForm({ enrollmentPublicId, availabilityWindow: w, modules, sessionMinutes, programTitle }: {
  enrollmentPublicId: string;
  availabilityWindow: AvailabilityWindow;
  modules: ProgramModule[];
  sessionMinutes: number;
  programTitle: string;
}) {
  const [start, setStart] = useState('');
  const [moduleId, setModuleId] = useState('');
  const { mutate: schedule, isPending } = useScheduleSession();
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
      <p className="text-xs text-gray-500">
        Available {w.daysOfWeek.map((d) => DAYS[d]).join(', ')} · {w.startLocalTime}–{w.endLocalTime} ({w.ianaTimezone}) · {sessionMinutes} min sessions.
        {' '}Enter the time in the student's timezone ({w.ianaTimezone}).
      </p>
      <div className="flex flex-wrap gap-2">
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
        <select required value={moduleId} onChange={(e) => setModuleId(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900">
          <option value="" disabled>Chapter this session covers *</option>
          {[...modules].sort((a, b) => a.order - b.order).map((m) => <option key={m.publicId} value={m.publicId}>{m.title}</option>)}
        </select>
        <Button size="sm" variant="gradient" loading={isPending} disabled={!start || !moduleId}
          onClick={() => {
            // The input is read in the student's timezone, not the tutor's browser timezone.
            const s = zonedTimeToUtc(start, w.ianaTimezone);
            const e = new Date(s.getTime() + sessionMinutes * 60_000);
            const title = `${programTitle} — ${modules.find((m) => m.publicId === moduleId)?.title ?? 'Session'}`;
            schedule({ enrollmentId: enrollmentPublicId, dto: { startUTC: s.toISOString(), endUTC: e.toISOString(), title, programModulePublicId: moduleId } });
          }}>
          <CalendarPlus className="h-3.5 w-3.5" /> Schedule session
        </Button>
      </div>
      {(!start || !moduleId) && (
        <p className="mt-1 text-xs text-gray-500">
          Choose {[!start && 'a start time', !moduleId && 'the chapter this session covers'].filter(Boolean).join(' and ')} to schedule.
        </p>
      )}
    </div>
  );
}
