import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import {
  ArrowLeft, Video, Clock, CalendarDays, User, CheckCircle2, XCircle,
  LogIn, CreditCard, RotateCcw, FileText,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { classesService } from '../../services/classes.service';
import { studentsService } from '../../services/students.service';
import { useAuthStore } from '../../stores/auth.store';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'purple';
const statusVariant: Record<string, BadgeVariant> = {
  COMPLETED: 'success', LIVE: 'warning', CANCELLED: 'danger', SCHEDULED: 'info',
};

function Row({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className={`text-sm font-medium text-slate-800 dark:text-slate-200 ${valueClass ?? ''}`}>{value}</p>
      </div>
    </div>
  );
}

export function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const tz = useAuthStore((s) => s.user?.timezone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data: cls, isLoading } = useQuery({
    queryKey: ['classes', 'detail', classId],
    queryFn: () => classesService.getById(classId!),
    enabled: !!classId,
  });

  // Resolve the student's name (tutor's roster).
  const { data: studentsData } = useQuery({
    queryKey: ['students', 'my-tutor', 'roster'],
    queryFn: () => studentsService.getMyStudentsAsTutor({ limit: '200' }),
  });
  const studentName = studentsData?.items?.find((s) => s.publicId === cls?.studentPublicId);
  const studentLabel = studentName
    ? (studentName.displayName || `${studentName.firstName} ${studentName.lastName}`.trim())
    : cls?.studentPublicId ? `Student ${cls.studentPublicId.slice(0, 6)}` : '—';

  const fmt = (d?: string) => (d ? formatInTimeZone(new Date(d), tz, 'EEE, MMM d yyyy · h:mm a zzz') : '—');

  if (isLoading) {
    return <div className="flex justify-center py-24"><Spinner /></div>;
  }
  if (!cls) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <p className="text-center text-slate-400 py-16">Class not found.</p>
      </div>
    );
  }

  const attended = !!cls.studentJoinedAt;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <Video className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{cls.subject || 'Class'}</h1>
            <p className="text-sm text-slate-500">{cls.classType.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant[cls.status] ?? 'default'}>{cls.status}</Badge>
          {cls.isRefunded && <Badge variant="danger"><RotateCcw className="h-3 w-3" /> Refunded</Badge>}
        </div>
      </div>

      {/* Attendance highlight */}
      <div className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${
        attended
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/20'
          : 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-900/20'
      }`}>
        {attended
          ? <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          : <XCircle className="h-6 w-6 text-rose-500" />}
        <div>
          <p className={`text-sm font-semibold ${attended ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
            {attended ? 'Student attended' : 'Student did not join'}
          </p>
          {attended && (
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
              Joined at {fmt(cls.studentJoinedAt)}
            </p>
          )}
        </div>
      </div>

      {/* Details grid */}
      <Card>
        <div className="grid gap-x-8 sm:grid-cols-2 divide-y divide-slate-100 dark:divide-slate-800 sm:divide-y-0">
          <Row icon={<User className="h-4 w-4" />} label="Student" value={studentLabel} />
          <Row
            icon={<LogIn className="h-4 w-4" />}
            label="Student joined at"
            value={attended ? fmt(cls.studentJoinedAt) : 'Did not join'}
            valueClass={attended ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}
          />
          <Row icon={<CalendarDays className="h-4 w-4" />} label="Scheduled start" value={fmt(cls.scheduledStartUTC)} />
          <Row icon={<CalendarDays className="h-4 w-4" />} label="Scheduled end" value={fmt(cls.scheduledEndUTC)} />
          <Row icon={<Clock className="h-4 w-4" />} label="Duration" value={cls.durationMinutes ? `${cls.durationMinutes} min` : '—'} />
          <Row
            icon={<CreditCard className="h-4 w-4" />}
            label="Billing"
            value={cls.classType === 'DEMO' ? 'Demo (10 credits)' : cls.costCents > 0 ? `${cls.costCents / 100} credits` : 'Free'}
          />
          {cls.isRefunded && (
            <Row icon={<RotateCcw className="h-4 w-4" />} label="Refunded at" value={fmt(cls.refundedAt)} valueClass="text-rose-500" />
          )}
          {cls.notes && (
            <Row icon={<FileText className="h-4 w-4" />} label="Notes" value={cls.notes} />
          )}
        </div>
      </Card>
    </div>
  );
}
