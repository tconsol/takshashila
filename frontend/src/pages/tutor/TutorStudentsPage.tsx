import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { AttendanceSheet } from '../../components/shared/AttendanceSheet';
import { useMyClassesAsTutor } from '../../hooks/use-classes';
import { useQuery } from '@tanstack/react-query';
import { attendanceService } from '../../services/attendance.service';
import { studentsService } from '../../services/students.service';
import { format } from 'date-fns';
import type { ClassRecord } from '../../services/classes.service';
import { useStartConversation } from '../../features/chat/use-chat';

export function TutorStudentsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useMyClassesAsTutor({ status: 'COMPLETED', limit: '100' });
  const [selectedClass, setSelectedClass] = useState<ClassRecord | null>(null);
  const { mutateAsync: startConversation } = useStartConversation();

  const handleMessage = async (studentPublicId: string) => {
    const conv = await startConversation({ recipientPublicId: studentPublicId, recipientRole: 'STUDENT' });
    navigate(`/chat/${conv.publicId}`);
  };

  const { data: attendanceRecords = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance', selectedClass?.publicId],
    queryFn: () => attendanceService.getByClass(selectedClass!.publicId),
    enabled: !!selectedClass,
  });

  const { data: myStudents } = useQuery({
    queryKey: ['students', 'my-tutor'],
    queryFn: () => studentsService.getMyStudentsAsTutor({ limit: '100' }),
  });
  const studentNameMap = new Map(
    (myStudents?.items ?? []).map((s) => [s.publicId, s.displayName || `${s.firstName} ${s.lastName}`.trim()]),
  );

  const uniqueStudentIds = [...new Set((data?.items ?? []).map((c) => c.studentPublicId))];
  const completedClasses = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Students"
        subtitle={`${uniqueStudentIds.length} student${uniqueStudentIds.length !== 1 ? 's' : ''} across all completed classes`}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400">
          Completed Classes
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : completedClasses.length === 0 ? (
          <div className="py-10 text-center text-gray-400 dark:text-gray-500 text-sm">
            No completed classes yet
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {completedClasses.map((cls) => {
              const studentName = studentNameMap.get(cls.studentPublicId) ?? cls.studentPublicId.slice(0, 8);
              return (
              <button
                key={cls.publicId}
                onClick={() => setSelectedClass(cls)}
                className="w-full px-5 py-3 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
              >
                <Avatar name={studentName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {cls.subject}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{studentName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {cls.scheduledStartUTC ? format(new Date(cls.scheduledStartUTC), 'MMM d, yyyy') : '—'}
                  </p>
                </div>
                <Badge variant="success">Completed</Badge>
                <button
                  onClick={(e) => { e.stopPropagation(); handleMessage(cls.studentPublicId); }}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Message
                </button>
                <span className="text-xs text-indigo-600 dark:text-indigo-400">View Attendance →</span>
              </button>
              );})}
          </div>
        )}
      </div>

      <Modal
        open={!!selectedClass}
        onClose={() => setSelectedClass(null)}
        title={selectedClass ? `${selectedClass.subject} ${studentNameMap.get(selectedClass.studentPublicId) ?? 'Student'}` : ''}
        size="lg"
      >
        {selectedClass && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedClass.scheduledStartUTC ? format(new Date(selectedClass.scheduledStartUTC), 'EEE, MMM d yyyy · h:mm a') : '—'}
            </p>
            <AttendanceSheet
              classPublicId={selectedClass.publicId}
              records={attendanceRecords}
              loading={loadingAttendance}
              canOverride
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
