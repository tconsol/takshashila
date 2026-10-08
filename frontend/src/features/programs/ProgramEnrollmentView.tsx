// frontend/src/features/programs/ProgramEnrollmentView.tsx
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loading';
import { useEnrollmentStructure } from '../../hooks/use-programs';
import { CourseStructureTree } from '../courses/CourseStructureTree';
import { ProgramScheduleForm } from './ProgramScheduleForm';
import { categoryLabel, levelLabel } from '../../constants/programs';
import { formatCurrency } from '../../utils/currency';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUS_BADGE = {
  ACTIVE: <Badge variant="success" tone="soft">Active</Badge>,
  COMPLETED: <Badge variant="info" tone="soft">Completed</Badge>,
  CANCELLED: <Badge variant="default" tone="soft">Cancelled</Badge>,
} as const;
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">{children}</dd>
    </div>
  );
}

export function ProgramEnrollmentView({ enrollmentPublicId, backTo, backLabel, actions }: {
  enrollmentPublicId?: string;
  backTo: string;
  backLabel: string;
  actions?: ReactNode;
}) {
  const { data, isLoading, isError } = useEnrollmentStructure(enrollmentPublicId);
  const [scheduling, setScheduling] = useState(false);
  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (isError || !data) {
    return <div className="py-16 text-center text-sm text-gray-500">Enrollment not found. <Link to={backTo} className="text-brand-600 hover:underline">{backLabel}</Link></div>;
  }
  const { enrollment, program, topics, otherClasses, viewerRole } = data;
  const showStatus = viewerRole === 'STUDENT' || viewerRole === 'PARENT';
  const canSchedule = viewerRole === 'TUTOR' && enrollment.status === 'ACTIVE' && enrollment.sessionsScheduledCount < enrollment.sessionCount;
  const pct = enrollment.sessionCount ? Math.round((enrollment.sessionsCompletedCount / enrollment.sessionCount) * 100) : 0;
  const who = viewerRole === 'TUTOR' ? `for ${enrollment.studentName}` : `with ${enrollment.tutorName}`;

  return (
    <div className="animate-fade-in">
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </Link>
      <PageHeader
        eyebrow="Skill program"
        title={program.title}
        description={`${categoryLabel(program.category)} · ${levelLabel(program.level)} · ${who}`}
        icon={<Sparkles className="h-5 w-5" />}
        actions={actions}
      />
      <Card className="mb-4">
        <CardContent>
          <div className="mb-3">{STATUS_BADGE[enrollment.status]}</div>
          {program.description && <p className="mb-3 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{program.description}</p>}
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Tutor">{enrollment.tutorName}</Detail>
            <Detail label="Student">{enrollment.studentName}</Detail>
            <Detail label="Enrolled on">{fmtDate(enrollment.createdAt)}</Detail>
            <Detail label="Category · level">{categoryLabel(program.category)} · {levelLabel(program.level)}</Detail>
            <Detail label="Sessions">{enrollment.sessionCount} × {program.sessionMinutes} min</Detail>
            <Detail label="Scheduled / completed">{enrollment.sessionsScheduledCount} scheduled · {enrollment.sessionsCompletedCount} completed</Detail>
            <Detail label="Program price">{formatCurrency(enrollment.priceCentsPaid)}{enrollment.billing === 'HELD' ? ' (held, charged per session)' : ''}</Detail>
            <Detail label="Preferred availability">
              {enrollment.availabilityWindow.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ') || '—'}
              {' · '}{enrollment.availabilityWindow.startLocalTime}–{enrollment.availabilityWindow.endLocalTime} ({enrollment.availabilityWindow.ianaTimezone})
            </Detail>
          </dl>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...program.modules].sort((a, b) => a.order - b.order).map((m) => (
              <Badge key={m.publicId} variant="default" tone="soft">{m.title}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-gray-900 dark:text-white">
              {enrollment.sessionsCompletedCount}/{enrollment.sessionCount} sessions completed
            </span>
            <span className="text-xs text-gray-500">{enrollment.sessionsScheduledCount} scheduled · {enrollment.status.toLowerCase()}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden>
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
        </CardContent>
      </Card>
      {canSchedule && (
        <Card className="mb-4">
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {enrollment.sessionCount - enrollment.sessionsScheduledCount} of {enrollment.sessionCount} sessions still to schedule.
              </p>
              <Button size="sm" variant="outline" onClick={() => setScheduling((v) => !v)}>
                <CalendarPlus className="h-3.5 w-3.5" /> Schedule next session
              </Button>
            </div>
            {scheduling && (
              <ProgramScheduleForm
                enrollmentPublicId={enrollment.publicId}
                availabilityWindow={enrollment.availabilityWindow}
                modules={program.modules}
                sessionMinutes={program.sessionMinutes}
                programTitle={program.title}
              />
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent>
          <CourseStructureTree topics={topics} otherClasses={otherClasses} showStatus={showStatus} viewerRole={viewerRole} hideMaterials onOpenMaterial={() => undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
