import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Mail, BookOpen, Users, BarChart3, MessageSquare } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { usePendingStudents, useStudentList, useApproveStudent, useSuspendStudent } from '../../hooks/use-students';
import type { StudentProfile } from '../../services/students.service';
import { useStartConversation } from '../../features/chat/use-chat';

const TABS = [
  { key: 'pending', label: 'Pending Approval' },
  { key: 'all', label: 'All Students' },
];

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  PENDING_APPROVAL: 'warning',
  SUSPENDED: 'danger',
  INACTIVE: 'default',
  TRANSFERRED: 'default',
};

export function PrincipalStudentsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');
  const [suspendTarget, setSuspendTarget] = useState<StudentProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);

  const { data: pending = [], isLoading: pendingLoading } = usePendingStudents();
  const { data: allStudents, isLoading: allLoading } = useStudentList();
  const { mutateAsync: approve, isPending: approving } = useApproveStudent();
  const { mutateAsync: suspend, isPending: suspending } = useSuspendStudent();
  const { mutateAsync: startConversation } = useStartConversation();

  const displayList = activeTab === 'pending' ? pending : (allStudents?.items ?? []);
  const isLoading = activeTab === 'pending' ? pendingLoading : allLoading;

  const handleMessage = async (student: StudentProfile) => {
    const conv = await startConversation({ recipientPublicId: student.userPublicId, recipientRole: 'STUDENT' });
    navigate(`/chat/${conv.publicId}`);
  };

  const handleApprove = async (student: StudentProfile) => {
    await approve(student.publicId);
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    await suspend({ publicId: suspendTarget.publicId, reason: suspendReason });
    setSuspendTarget(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Students" subtitle="Review and manage student accounts" />

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayList.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <GraduationCap className="h-7 w-7 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeTab === 'pending' ? 'No students pending approval' : 'No students found'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-5 py-3 w-10" />
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3 py-3">Student</th>
                <th className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3 py-3 w-24">Grade</th>
                <th className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3 py-3 w-28">Attendance</th>
                <th className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3 py-3 w-32">Status</th>
                <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-5 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {displayList.map((student) => {
                const name = student.displayName || `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || 'Student';
                const attendancePct = Math.round(student.attendanceRate ?? 0);
                return (
                  <tr
                    key={student.publicId}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <td className="px-5 py-3.5">
                      <Avatar name={name} size="sm" />
                    </td>
                    <td className="px-3 py-3.5 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{name}</p>
                      {student.email && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">{student.email}</p>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{student.grade ?? '—'}</span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className={`text-sm font-medium ${
                        attendancePct >= 75 ? 'text-green-600 dark:text-green-400'
                        : attendancePct >= 50 ? 'text-yellow-600 dark:text-yellow-400'
                        : attendancePct === 0 ? 'text-gray-400' : 'text-red-500'
                      }`}>
                        {student.totalClassesAttended > 0 ? `${attendancePct}%` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Badge variant={STATUS_VARIANT[student.status] ?? 'default'}>
                        {student.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {student.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleMessage(student)}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
                          >
                            Message
                          </button>
                        )}
                        {student.status === 'PENDING_APPROVAL' && (
                          <Button size="sm" onClick={() => handleApprove(student)} loading={approving}>
                            Approve
                          </Button>
                        )}
                        {student.status === 'ACTIVE' && (
                          <button
                            onClick={() => { setSuspendTarget(student); setSuspendReason(''); }}
                            className="text-xs text-red-500 hover:underline whitespace-nowrap"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Detail Modal */}
      <Modal
        open={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        title="Student Details"
        size="md"
        footer={
          <div className="flex gap-2">
            {selectedStudent?.status === 'ACTIVE' && (
              <>
                <Button variant="danger" onClick={() => { setSuspendTarget(selectedStudent); setSelectedStudent(null); setSuspendReason(''); }}>
                  Suspend
                </Button>
                <Button variant="outline" onClick={() => { handleMessage(selectedStudent); setSelectedStudent(null); }}>
                  <MessageSquare className="h-4 w-4 mr-1.5" /> Message
                </Button>
              </>
            )}
            {selectedStudent?.status === 'PENDING_APPROVAL' && (
              <Button onClick={() => { handleApprove(selectedStudent); setSelectedStudent(null); }} loading={approving}>
                Approve
              </Button>
            )}
            <Button variant="ghost" onClick={() => setSelectedStudent(null)}>Close</Button>
          </div>
        }
      >
        {selectedStudent && <StudentDetailView student={selectedStudent} />}
      </Modal>

      {/* Suspend Modal */}
      <Modal open={!!suspendTarget} onClose={() => setSuspendTarget(null)} title="Suspend Student" size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleSuspend} loading={suspending} disabled={!suspendReason.trim()}>Suspend</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Suspending <strong>{suspendTarget?.displayName}</strong> will block their access.
          </p>
          <Input label="Reason" placeholder="Reason for suspension…" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

function StudentDetailView({ student }: { student: StudentProfile }) {
  const name = student.displayName || `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || 'Student';
  const attendancePct = Math.round(student.attendanceRate ?? 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={name} size="lg" />
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{name}</h3>
          {student.email && (
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
              <Mail className="h-3.5 w-3.5" /> {student.email}
            </p>
          )}
          <div className="mt-1">
            <Badge variant={STATUS_VARIANT[student.status] ?? 'default'}>{student.status.replace('_', ' ')}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: BookOpen, color: 'indigo', label: 'Classes Attended', value: student.totalClassesAttended },
          { icon: BarChart3, color: 'green', label: 'Attendance Rate', value: student.totalClassesAttended > 0 ? `${attendancePct}%` : 'N/A' },
          { icon: Users, color: 'amber', label: 'Demos Used', value: `${student.demoClassesUsed}/3` },
          { icon: GraduationCap, color: 'rose', label: 'Grade', value: student.grade ?? '—' },
        ].map(({ icon: Icon, color, label, value }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${color}-50 dark:bg-${color}-900/20`}>
                <Icon className={`h-4 w-4 text-${color}-600 dark:text-${color}-400`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {student.notes && (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Notes</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{student.notes}</p>
        </div>
      )}
    </div>
  );
}
