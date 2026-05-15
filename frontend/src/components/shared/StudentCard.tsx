import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { StudentProfile } from '../../services/students.service';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const statusVariant: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  PENDING_APPROVAL: 'warning',
  SUSPENDED: 'danger',
  INACTIVE: 'default',
  INVITED: 'info',
  TRANSFERRED: 'default',
};

interface StudentCardProps {
  student: StudentProfile;
  onApprove?: (student: StudentProfile) => void;
  onSuspend?: (student: StudentProfile) => void;
  onView?: (student: StudentProfile) => void;
  onMessage?: (student: StudentProfile) => void;
}

export function StudentCard({ student, onApprove, onSuspend, onView, onMessage }: StudentCardProps) {
  const attendancePct = Math.round(student.attendanceRate);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex gap-4">
      <Avatar name={student.displayName} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 dark:text-white truncate">{student.displayName}</p>
          <Badge variant={statusVariant[student.status] ?? 'default'}>{student.status.replace('_', ' ')}</Badge>
        </div>
        {student.grade && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Grade: {student.grade}</p>
        )}
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{student.totalClassesAttended} attended</span>
          <span>{student.demoClassesUsed}/3 demos used</span>
          <span
            className={`font-medium ${
              attendancePct >= 75
                ? 'text-green-600 dark:text-green-400'
                : attendancePct >= 50
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-500'
            }`}
          >
            {attendancePct}% attendance
          </span>
        </div>
        {(student.subjects?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {(student.subjects ?? []).slice(0, 4).map((s) => (
              <span key={s} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md px-2 py-0.5">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 flex-shrink-0">
        {onView && (
          <Button size="sm" variant="ghost" onClick={() => onView(student)}>View</Button>
        )}
        {onMessage && (
          <Button size="sm" variant="outline" onClick={() => onMessage(student)}>Message</Button>
        )}
        {onApprove && student.status === 'PENDING_APPROVAL' && (
          <Button size="sm" onClick={() => onApprove(student)}>Approve</Button>
        )}
        {onSuspend && student.status === 'ACTIVE' && (
          <Button size="sm" variant="danger" onClick={() => onSuspend(student)}>Suspend</Button>
        )}
      </div>
    </div>
  );
}
