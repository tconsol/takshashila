import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, Mail, BookOpen, Users, BarChart3, MessageSquare,
  UserPlus, Send, ArrowRightLeft, Search, X, Eye,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import {
  usePendingStudents,
  useStudentList,
  useApproveStudent,
  useSuspendStudent,
  useMyStudentsAsPrincipal,
  useCreateStudentByPrincipal,
  useInviteExistingByPrincipal,
  useTransferStudent,
} from '../../hooks/use-students';
import { useMyTutors } from '../../hooks/use-tutors';
import type { StudentProfile } from '../../services/students.service';
import { useStartConversation } from '../../features/chat/use-chat';

const TABS = [
  { key: 'my', label: 'My Students' },
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
  INVITED: 'warning',
};

const GRADE_LIST = [
  'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
  'Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12',
];

export function PrincipalStudentsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('my');
  const [suspendTarget, setSuspendTarget] = useState<StudentProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [assignTarget, setAssignTarget] = useState<StudentProfile | null>(null);

  const { data: principalStudents, isLoading: myLoading } = useMyStudentsAsPrincipal();
  const { data: pending = [], isLoading: pendingLoading } = usePendingStudents();
  const { data: allStudents, isLoading: allLoading } = useStudentList();
  const { data: myTutorsData } = useMyTutors({ limit: '100' });
  const myTutors = myTutorsData?.items ?? [];

  const { mutateAsync: approve, isPending: approving } = useApproveStudent();
  const { mutateAsync: suspend, isPending: suspending } = useSuspendStudent();
  const { mutateAsync: createStudent, isPending: creating } = useCreateStudentByPrincipal();
  const { mutateAsync: inviteStudent, isPending: inviting } = useInviteExistingByPrincipal();
  const { mutateAsync: transferStudent, isPending: transferring } = useTransferStudent();
  const { mutateAsync: startConversation } = useStartConversation();

  const displayList =
    activeTab === 'pending'
      ? pending
      : activeTab === 'my'
      ? (principalStudents?.items ?? [])
      : (allStudents?.items ?? []);

  const isLoading =
    activeTab === 'pending' ? pendingLoading : activeTab === 'my' ? myLoading : allLoading;

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
      <PageHeader
        title="Students"
        description="Create, invite, and manage students across your organization"
        icon={<GraduationCap className="h-6 w-6" />}
        eyebrow="MANAGEMENT"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInvite(true)}
            >
              <Send className="h-4 w-4 mr-1.5" /> Invite Existing
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
            >
              <UserPlus className="h-4 w-4 mr-1.5" /> Create Student
            </Button>
          </div>
        }
      />

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-clay-green border-t-transparent" />
        </div>
      ) : displayList.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-8 w-8" />}
          title={activeTab === 'pending' ? 'No students pending approval' : activeTab === 'my' ? 'No students yet' : 'No students found'}
          description={activeTab === 'my' ? 'Create or invite students to assign them to your tutors.' : undefined}
          action={
            activeTab === 'my' ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowInvite(true)}>
                  <Send className="h-4 w-4 mr-1.5" /> Invite Existing
                </Button>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <UserPlus className="h-4 w-4 mr-1.5" /> Create Student
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-[28px] border-2.5 border-clay-ink bg-clay-surface shadow-clay overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-dashed border-clay-ink/20 bg-clay-bg/40">
                <th className="w-10 px-5 py-3" />
                <th className="px-3 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-clay-muted">Student</th>
                <th className="hidden w-24 px-3 py-3 text-center text-xs font-extrabold uppercase tracking-wider text-clay-muted sm:table-cell">Grade</th>
                <th className="hidden w-28 px-3 py-3 text-center text-xs font-extrabold uppercase tracking-wider text-clay-muted md:table-cell">Attendance</th>
                <th className="w-32 px-3 py-3 text-center text-xs font-extrabold uppercase tracking-wider text-clay-muted">Status</th>
                <th className="w-36 px-5 py-3 text-right text-xs font-extrabold uppercase tracking-wider text-clay-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((student) => {
                const name = student.displayName || `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || 'Student';
                const attendancePct = Math.round(student.attendanceRate ?? 0);
                return (
                  <tr
                    key={student.publicId}
                    className="cursor-pointer border-b border-dashed border-clay-ink/10 transition-colors last:border-0 hover:bg-clay-mint/10"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <td className="px-5 py-3.5">
                      <Avatar name={name} size="sm" />
                    </td>
                    <td className="min-w-0 px-3 py-3.5">
                      <p className="text-sm font-bold text-clay-ink">{name}</p>
                      {student.email && (
                        <p className="max-w-xs truncate text-xs text-clay-muted">{student.email}</p>
                      )}
                    </td>
                    <td className="hidden px-3 py-3.5 text-center sm:table-cell">
                      <span className="text-sm text-clay-muted">{student.grade ?? '—'}</span>
                    </td>
                    <td className="hidden px-3 py-3.5 text-center md:table-cell">
                      <span
                        className={`text-sm font-bold ${
                          attendancePct >= 75
                            ? 'text-clay-green-dark'
                            : attendancePct >= 50
                            ? 'text-amber-500'
                            : attendancePct === 0
                            ? 'text-clay-muted'
                            : 'text-red-500'
                        }`}
                      >
                        {student.totalClassesAttended > 0 ? `${attendancePct}%` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Badge variant={STATUS_VARIANT[student.status] ?? 'default'}>
                        {student.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="rounded-lg border border-clay-ink/20 p-1.5 text-clay-muted hover:bg-clay-bg hover:text-clay-ink transition-colors"
                          title="View details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {student.status === 'ACTIVE' && (
                          <>
                            <button
                              onClick={() => handleMessage(student)}
                              className="rounded-lg border border-clay-ink/20 p-1.5 text-clay-muted hover:bg-clay-sky/40 hover:text-clay-ink transition-colors"
                              title="Message"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => { setAssignTarget(student); }}
                              className="rounded-lg border border-clay-ink/20 p-1.5 text-clay-muted hover:bg-clay-purple/40 hover:text-clay-ink transition-colors"
                              title="Assign to tutor"
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {student.status === 'PENDING_APPROVAL' && (
                          <Button size="sm" onClick={() => handleApprove(student)} loading={approving}>
                            Approve
                          </Button>
                        )}
                        {student.status === 'ACTIVE' && (
                          <button
                            onClick={() => { setSuspendTarget(student); setSuspendReason(''); }}
                            className="rounded-lg border border-clay-coral-strong/40 px-2 py-1 text-xs font-bold text-red-500 hover:bg-clay-coral/30 transition-colors"
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

      {/* Create Student Modal */}
      <CreateStudentModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        tutors={myTutors}
        onCreate={async (data) => {
          await createStudent(data);
          setShowCreate(false);
        }}
        loading={creating}
      />

      {/* Invite Existing Student Modal */}
      <InviteStudentModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        tutors={myTutors}
        onInvite={async (data) => {
          await inviteStudent(data);
          setShowInvite(false);
        }}
        loading={inviting}
      />

      {/* Assign Tutor Modal */}
      <AssignTutorModal
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        student={assignTarget}
        tutors={myTutors}
        onAssign={async (newTutorPublicId) => {
          if (!assignTarget) return;
          await transferStudent({ studentPublicId: assignTarget.publicId, newTutorPublicId });
          setAssignTarget(null);
        }}
        loading={transferring}
      />

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
                <Button
                  variant="danger"
                  onClick={() => { setSuspendTarget(selectedStudent); setSelectedStudent(null); setSuspendReason(''); }}
                >
                  Suspend
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setAssignTarget(selectedStudent); setSelectedStudent(null); }}
                >
                  <ArrowRightLeft className="h-4 w-4 mr-1.5" /> Reassign Tutor
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { handleMessage(selectedStudent); setSelectedStudent(null); }}
                >
                  <MessageSquare className="h-4 w-4 mr-1.5" /> Message
                </Button>
              </>
            )}
            {selectedStudent?.status === 'PENDING_APPROVAL' && (
              <Button
                onClick={() => { handleApprove(selectedStudent); setSelectedStudent(null); }}
                loading={approving}
              >
                Approve
              </Button>
            )}
            <Button variant="ghost" onClick={() => setSelectedStudent(null)}>Close</Button>
          </div>
        }
      >
        {selectedStudent && <StudentDetailView student={selectedStudent} tutors={myTutors} />}
      </Modal>

      {/* Suspend Modal */}
      <Modal
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        title="Suspend Student"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={handleSuspend}
              loading={suspending}
              disabled={!suspendReason.trim()}
            >
              Suspend
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-clay-muted">
            Suspending <strong className="text-clay-ink">{suspendTarget?.displayName}</strong> will block their access.
          </p>
          <Input
            label="Reason"
            placeholder="Reason for suspension…"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}

// ─── Create Student Modal ─────────────────────────────────────────────────────

interface TutorOption {
  publicId: string;
  displayName: string;
  totalStudents: number;
  status: string;
}

function CreateStudentModal({
  open,
  onClose,
  tutors,
  onCreate,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  tutors: TutorOption[];
  onCreate: (data: { firstName: string; lastName: string; email: string; password: string; tutorPublicId: string; grade?: string; notes?: string }) => Promise<void>;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', tutorPublicId: '', grade: '', notes: '',
  });
  const [error, setError] = useState('');

  const activeTutors = tutors.filter((t) => t.status === 'ACTIVE');

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.tutorPublicId) { setError('Select a tutor'); return; }
    try {
      await onCreate({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        tutorPublicId: form.tutorPublicId,
        grade: form.grade || undefined,
        notes: form.notes || undefined,
      });
      setForm({ firstName: '', lastName: '', email: '', password: '', tutorPublicId: '', grade: '', notes: '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create student');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Student" size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="create-student-form" type="submit" loading={loading}>
            <UserPlus className="h-4 w-4 mr-1.5" /> Create Student
          </Button>
        </>
      }
    >
      <form id="create-student-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-2xl border-2 border-clay-ink bg-clay-coral px-4 py-3 text-sm font-semibold text-clay-ink shadow-clay-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="First Name" value={form.firstName} onChange={set('firstName')} required />
          <Input label="Last Name" value={form.lastName} onChange={set('lastName')} required />
        </div>

        <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
        <Input label="Password" type="password" value={form.password} onChange={set('password')} required />

        {/* Tutor selector */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-clay-muted mb-1.5">
            Assign to Tutor <span className="text-red-500">*</span>
          </label>
          <select
            value={form.tutorPublicId}
            onChange={set('tutorPublicId')}
            required
            className="w-full rounded-2xl border-2.5 border-clay-ink bg-clay-surface px-4 py-2.5 text-sm font-semibold text-clay-ink shadow-clay-sm focus:outline-none focus:bg-clay-bg/60 focus:shadow-clay"
          >
            <option value="">Select a tutor…</option>
            {activeTutors.map((t) => (
              <option key={t.publicId} value={t.publicId}>
                {t.displayName} ({t.totalStudents} students)
              </option>
            ))}
          </select>
          {activeTutors.length === 0 && (
            <p className="mt-1 text-xs text-clay-muted">No active tutors. Invite tutors first.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-clay-muted mb-1.5">Grade</label>
            <select
              value={form.grade}
              onChange={set('grade')}
              className="w-full rounded-2xl border-2.5 border-clay-ink bg-clay-surface px-4 py-2.5 text-sm font-semibold text-clay-ink shadow-clay-sm focus:outline-none focus:bg-clay-bg/60"
            >
              <option value="">Select grade…</option>
              {GRADE_LIST.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <Input label="Notes (optional)" value={form.notes} onChange={set('notes')} />
        </div>
      </form>
    </Modal>
  );
}

// ─── Invite Existing Student Modal ───────────────────────────────────────────

function InviteStudentModal({
  open,
  onClose,
  tutors,
  onInvite,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  tutors: TutorOption[];
  onInvite: (data: { email?: string; phone?: string; tutorPublicId: string }) => Promise<void>;
  loading: boolean;
}) {
  const [searchBy, setSearchBy] = useState<'email' | 'phone'>('email');
  const [value, setValue] = useState('');
  const [tutorPublicId, setTutorPublicId] = useState('');
  const [error, setError] = useState('');

  const activeTutors = tutors.filter((t) => t.status === 'ACTIVE');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!tutorPublicId) { setError('Select a tutor'); return; }
    try {
      await onInvite({
        [searchBy]: value,
        tutorPublicId,
      });
      setValue('');
      setTutorPublicId('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite Existing Student" size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="invite-student-form" type="submit" loading={loading}>
            <Send className="h-4 w-4 mr-1.5" /> Send Invite
          </Button>
        </>
      }
    >
      <form id="invite-student-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-2xl border-2 border-clay-ink bg-clay-coral px-4 py-3 text-sm font-semibold text-clay-ink shadow-clay-sm">
            {error}
          </div>
        )}

        <p className="text-sm text-clay-muted">
          Invite an existing student account to be assigned to one of your tutors.
        </p>

        {/* Search by toggle */}
        <div className="flex gap-2">
          {(['email', 'phone'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { setSearchBy(opt); setValue(''); }}
              className={`flex-1 rounded-xl border-2 py-2 text-xs font-extrabold uppercase tracking-wider transition-colors ${
                searchBy === opt
                  ? 'border-clay-ink bg-clay-mint text-clay-ink shadow-clay-sm'
                  : 'border-clay-ink/20 bg-clay-surface text-clay-muted hover:bg-clay-bg'
              }`}
            >
              {opt === 'email' ? 'By Email' : 'By Phone'}
            </button>
          ))}
        </div>

        <Input
          label={searchBy === 'email' ? 'Student Email' : 'Student Phone'}
          type={searchBy === 'email' ? 'email' : 'tel'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={searchBy === 'email' ? 'student@example.com' : '+1234567890'}
          leftIcon={searchBy === 'email' ? <Mail className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          required
        />

        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-clay-muted mb-1.5">
            Assign to Tutor <span className="text-red-500">*</span>
          </label>
          <select
            value={tutorPublicId}
            onChange={(e) => setTutorPublicId(e.target.value)}
            required
            className="w-full rounded-2xl border-2.5 border-clay-ink bg-clay-surface px-4 py-2.5 text-sm font-semibold text-clay-ink shadow-clay-sm focus:outline-none focus:bg-clay-bg/60 focus:shadow-clay"
          >
            <option value="">Select a tutor…</option>
            {activeTutors.map((t) => (
              <option key={t.publicId} value={t.publicId}>
                {t.displayName} ({t.totalStudents} students)
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}

// ─── Assign Tutor Modal ───────────────────────────────────────────────────────

function AssignTutorModal({
  open,
  onClose,
  student,
  tutors,
  onAssign,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  tutors: TutorOption[];
  onAssign: (newTutorPublicId: string) => Promise<void>;
  loading: boolean;
}) {
  const [newTutorPublicId, setNewTutorPublicId] = useState('');
  const [error, setError] = useState('');

  const activeTutors = tutors.filter(
    (t) => t.status === 'ACTIVE' && t.publicId !== student?.tutorPublicId,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newTutorPublicId) { setError('Select a tutor'); return; }
    try {
      await onAssign(newTutorPublicId);
      setNewTutorPublicId('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to assign tutor');
    }
  };

  const name = student
    ? student.displayName || `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || 'Student'
    : '';

  return (
    <Modal open={open} onClose={onClose} title="Reassign Tutor" size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="assign-tutor-form" type="submit" loading={loading}>
            <ArrowRightLeft className="h-4 w-4 mr-1.5" /> Reassign
          </Button>
        </>
      }
    >
      <form id="assign-tutor-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-2xl border-2 border-clay-ink bg-clay-coral px-4 py-3 text-sm font-semibold text-clay-ink shadow-clay-sm">
            {error}
          </div>
        )}

        <p className="text-sm text-clay-muted">
          Reassigning <strong className="text-clay-ink">{name}</strong> to a new tutor will transfer their history.
        </p>

        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-clay-muted mb-1.5">
            New Tutor <span className="text-red-500">*</span>
          </label>
          <select
            value={newTutorPublicId}
            onChange={(e) => setNewTutorPublicId(e.target.value)}
            required
            className="w-full rounded-2xl border-2.5 border-clay-ink bg-clay-surface px-4 py-2.5 text-sm font-semibold text-clay-ink shadow-clay-sm focus:outline-none focus:bg-clay-bg/60 focus:shadow-clay"
          >
            <option value="">Select tutor…</option>
            {activeTutors.map((t) => (
              <option key={t.publicId} value={t.publicId}>
                {t.displayName} ({t.totalStudents} students)
              </option>
            ))}
          </select>
          {activeTutors.length === 0 && (
            <p className="mt-1 text-xs text-clay-muted">No other active tutors available.</p>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ─── Student Detail View ──────────────────────────────────────────────────────

function StudentDetailView({ student, tutors }: { student: StudentProfile; tutors: TutorOption[] }) {
  const name = student.displayName || `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || 'Student';
  const attendancePct = Math.round(student.attendanceRate ?? 0);
  const assignedTutor = tutors.find((t) => t.publicId === student.tutorPublicId);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={name} size="lg" />
        <div>
          <h3 className="text-lg font-black text-clay-ink">{name}</h3>
          {student.email && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-clay-muted">
              <Mail className="h-3.5 w-3.5" /> {student.email}
            </p>
          )}
          {assignedTutor && (
            <p className="mt-0.5 text-xs font-semibold text-clay-green-dark">
              Tutor: {assignedTutor.displayName}
            </p>
          )}
          <div className="mt-1.5">
            <Badge variant={STATUS_VARIANT[student.status] ?? 'default'}>
              {student.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: BookOpen, label: 'Classes Attended', value: student.totalClassesAttended, color: 'bg-clay-sky' },
          { icon: BarChart3, label: 'Attendance Rate', value: student.totalClassesAttended > 0 ? `${attendancePct}%` : 'N/A', color: 'bg-clay-mint' },
          { icon: Users, label: 'Demos Used', value: `${student.demoClassesUsed}/3`, color: 'bg-clay-yellow' },
          { icon: GraduationCap, label: 'Grade', value: student.grade ?? '—', color: 'bg-clay-purple' },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 border-clay-ink ${color}`}>
                <Icon className="h-4 w-4 text-clay-ink" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-clay-muted">{label}</p>
                <p className="text-sm font-black text-clay-ink">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {student.notes && (
        <div className="rounded-2xl border-2 border-dashed border-clay-ink/30 bg-clay-bg px-4 py-3">
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-clay-muted">Notes</p>
          <p className="text-sm text-clay-ink">{student.notes}</p>
        </div>
      )}
    </div>
  );
}
