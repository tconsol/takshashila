import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, Users, Plus, PenLine } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { attendanceService } from '../../services/attendance.service';
import { studentsService } from '../../services/students.service';
import { api } from '../../lib/axios';

type AttVariant = 'success' | 'danger' | 'warning' | 'default';

const statusVariant: Record<string, AttVariant> = {
  PRESENT: 'success',
  ABSENT: 'danger',
  PARTIAL: 'warning',
  EXCUSED: 'default',
};

interface CompletedClass {
  publicId: string;
  title: string;
  studentPublicId: string;
  startUTC: string;
  durationMinutes: number;
  status: string;
}

function MarkAttendanceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [status, setStatus] = useState('PRESENT');
  const [duration, setDuration] = useState('');
  const [remarks, setRemarks] = useState('');

  const { data: completedClasses = [] } = useQuery<CompletedClass[]>({
    queryKey: ['classes', 'tutor', 'completed-recent'],
    queryFn: async () => {
      const { data } = await api.get('/classes/my/tutor', { params: { status: 'COMPLETED', limit: 50 } });
      return data?.data?.items ?? [];
    },
    enabled: open,
  });

  const { data: myStudents } = useQuery({
    queryKey: ['students', 'my-tutor'],
    queryFn: () => studentsService.getMyStudentsAsTutor({ limit: '200' }),
    enabled: open,
  });

  const selectedClass = completedClasses.find((c) => c.publicId === classId);

  const classOptions = [
    { value: '', label: 'Select a completed class…' },
    ...completedClasses.map((c) => ({
      value: c.publicId,
      label: `${c.title} — ${format(new Date(c.startUTC), 'MMM d, h:mm a')}`,
    })),
  ];

  const studentOptions = [
    { value: '', label: 'Select student…' },
    ...(myStudents?.items ?? []).map((s) => ({
      value: s.publicId,
      label: `${s.firstName} ${s.lastName}`.trim(),
    })),
  ];

  const { mutateAsync: markAttendance, isPending } = useMutation({
    mutationFn: () =>
      attendanceService.markAttendance({
        classPublicId: classId,
        studentPublicId: studentId,
        status,
        durationPresentMinutes: duration ? parseInt(duration) : (selectedClass?.durationMinutes ?? 0),
        remarks: remarks || undefined,
      }),
    onSuccess: () => {
      toast.success('Attendance marked');
      qc.invalidateQueries({ queryKey: ['attendance', 'tutor', 'my'] });
      setClassId(''); setStudentId(''); setStatus('PRESENT'); setDuration(''); setRemarks('');
      onClose();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e.response?.data?.message ?? e.message ?? 'Failed to mark attendance');
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Mark Attendance">
      <div className="flex flex-col gap-4">
        <Select
          label="Class"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          options={classOptions}
        />
        <Select
          label="Student"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          options={studentOptions}
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: 'PRESENT', label: 'Present' },
            { value: 'ABSENT', label: 'Absent' },
            { value: 'PARTIAL', label: 'Partial' },
            { value: 'EXCUSED', label: 'Excused' },
          ]}
        />
        <Input
          label="Duration Present (minutes)"
          type="number"
          placeholder={selectedClass?.durationMinutes ? String(selectedClass.durationMinutes) : 'e.g. 60'}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <Input
          label="Remarks (optional)"
          placeholder="Any notes…"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1"
            disabled={!classId || !studentId || isPending}
            loading={isPending}
            onClick={() => markAttendance()}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />Mark Attendance
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function OverrideModal({
  record,
  onClose,
}: {
  record: { publicId: string; status: string; remarks?: string };
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState(record.status);
  const [remarks, setRemarks] = useState(record.remarks ?? '');

  const { mutateAsync: override, isPending } = useMutation({
    mutationFn: () => attendanceService.overrideAttendance(record.publicId, { status, remarks }),
    onSuccess: () => {
      toast.success('Attendance updated');
      qc.invalidateQueries({ queryKey: ['attendance', 'tutor', 'my'] });
      onClose();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e.response?.data?.message ?? e.message ?? 'Failed to update');
    },
  });

  return (
    <Modal open onClose={onClose} title="Edit Attendance">
      <div className="flex flex-col gap-4">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: 'PRESENT', label: 'Present' },
            { value: 'ABSENT', label: 'Absent' },
            { value: 'PARTIAL', label: 'Partial' },
            { value: 'EXCUSED', label: 'Excused' },
          ]}
        />
        <Input
          label="Remarks"
          placeholder="Reason for change…"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" loading={isPending} onClick={() => override()}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function TutorAttendancePage() {
  const [markOpen, setMarkOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<{ publicId: string; status: string; remarks?: string } | null>(null);

  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['attendance', 'tutor', 'my'],
    queryFn: () => attendanceService.getMyHistoryAsTutor({ limit: 100 }),
  });

  const { data: myStudents } = useQuery({
    queryKey: ['students', 'my-tutor'],
    queryFn: () => studentsService.getMyStudentsAsTutor({ limit: '200' }),
  });

  const records = attendanceData?.items ?? [];

  const studentNameMap = new Map(
    (myStudents?.items ?? []).map((s) => [
      s.publicId,
      s.displayName || `${s.firstName} ${s.lastName}`.trim(),
    ]),
  );

  const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'PARTIAL').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  const excused = records.filter((r) => r.status === 'EXCUSED').length;
  const avgDuration =
    present > 0
      ? Math.round(
          records
            .filter((r) => r.status === 'PRESENT' || r.status === 'PARTIAL')
            .reduce((s, r) => s + r.durationPresentMinutes, 0) / present,
        )
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Records"
        subtitle="Attendance history across all your classes"
        actions={
          <Button size="sm" onClick={() => setMarkOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Mark Attendance
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Records"
          value={isLoading ? '—' : records.length}
          icon={<Users className="h-5 w-5 text-brand-600" />}
        />
        <StatsCard
          title="Present"
          value={isLoading ? '—' : present}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50 dark:bg-green-900/20"
          change={records.length > 0 ? { value: `${Math.round((present / records.length) * 100)}%`, positive: true } : undefined}
        />
        <StatsCard
          title="Absent"
          value={isLoading ? '—' : absent}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50 dark:bg-red-900/20"
          change={records.length > 0 ? { value: `${Math.round((absent / records.length) * 100)}%`, positive: false } : undefined}
        />
        <StatsCard
          title="Avg Duration"
          value={isLoading ? '—' : `${avgDuration} min`}
          icon={<Clock className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50 dark:bg-violet-900/20"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">All Attendance Records</h3>
          {excused > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{excused} excused</span>
          )}
        </div>
        <div className="p-4">
          <Table
            columns={[
              {
                key: 'createdAt',
                header: 'Date',
                render: (r) => (
                  <span className="text-sm">{format(new Date(r.createdAt), 'EEE, MMM d yyyy')}</span>
                ),
              },
              {
                key: 'studentPublicId',
                header: 'Student',
                render: (r) => (
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {studentNameMap.get(r.studentPublicId) ?? `…${r.studentPublicId.slice(-6)}`}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => (
                  <Badge variant={statusVariant[r.status] ?? 'default'}>{r.status}</Badge>
                ),
              },
              {
                key: 'durationPresentMinutes',
                header: 'Duration',
                render: (r) => `${r.durationPresentMinutes} min`,
              },
              {
                key: 'source',
                header: 'Source',
                render: (r) => (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {r.source === 'MANUAL_OVERRIDE' ? 'Manual' : 'Auto'}
                  </span>
                ),
              },
              {
                key: 'remarks',
                header: 'Remarks',
                render: (r) => (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{r.remarks ?? '—'}</span>
                ),
              },
              {
                key: 'publicId',
                header: '',
                render: (r) => (
                  <button
                    onClick={() => setOverrideTarget({ publicId: r.publicId, status: r.status, remarks: r.remarks })}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <PenLine className="h-3.5 w-3.5" />Edit
                  </button>
                ),
              },
            ]}
            data={records}
            keyField="publicId"
            loading={isLoading}
            emptyMessage="No attendance records yet"
          />
        </div>
      </div>

      <MarkAttendanceModal open={markOpen} onClose={() => setMarkOpen(false)} />
      {overrideTarget && (
        <OverrideModal record={overrideTarget} onClose={() => setOverrideTarget(null)} />
      )}
    </div>
  );
}
