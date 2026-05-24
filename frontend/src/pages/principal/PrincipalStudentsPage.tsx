import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, Mail, BookOpen, Users, BarChart3, MessageSquare,
  UserPlus, Send, ArrowRightLeft, Search, Eye, EyeOff, Trash2, Copy, Check, CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import {
  usePendingStudents,
  useStudentList,
  useApproveStudent,
  useSuspendStudent,
  useMyStudentsAsPrincipal,
  useCreateStudentByPrincipal,
  useInviteExistingByPrincipal,
  useTransferStudent,
  useUnlinkStudent,
} from '../../hooks/use-students';
import { useMyTutors } from '../../hooks/use-tutors';
import type { StudentProfile, ParentChildResult } from '../../services/students.service';
import { studentsService } from '../../services/students.service';
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
  const [unlinkTarget, setUnlinkTarget] = useState<StudentProfile | null>(null);
  const [createdInfo, setCreatedInfo] = useState<{ studentId: string; firstName: string; contactEmail?: string } | null>(null);

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
  const { mutateAsync: unlinkStudent, isPending: unlinking } = useUnlinkStudent();
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
    try {
      const conv = await startConversation({ recipientPublicId: student.userPublicId, recipientRole: 'STUDENT' });
      navigate(`/chat/${conv.publicId}`);
    } catch (e) {
      console.error('Failed to start conversation', e);
    }
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
                        <button
                          onClick={() => setUnlinkTarget(student)}
                          className="rounded-lg border border-clay-ink/20 p-1.5 text-clay-muted hover:border-red-400 hover:bg-clay-coral/20 hover:text-red-500 transition-colors"
                          title="Unlink student"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Student — success screen */}
      {createdInfo && (
        <Modal open={showCreate} onClose={() => { setCreatedInfo(null); setShowCreate(false); }} title="Student Account Created!" size="sm"
          footer={<Button onClick={() => { setCreatedInfo(null); setShowCreate(false); }}>Done</Button>}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-clay-green-dark">
              <CheckCircle2 className="h-5 w-5" /> Account created for {createdInfo.firstName}
            </div>
            <div className="rounded-2xl border-2.5 border-clay-ink bg-clay-mint p-4 space-y-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-clay-muted mb-1">Student ID (login)</p>
                <StudentIdCopy value={createdInfo.studentId} />
              </div>
              <p className="text-xs font-semibold text-clay-ink/70">
                Student uses this ID + their password to log in.
                {createdInfo.contactEmail && ` Credentials sent to ${createdInfo.contactEmail}.`}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Student Modal */}
      {!createdInfo && (
        <CreateStudentModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          tutors={myTutors}
          onCreate={async (data) => {
            const result = await createStudent(data) as unknown as { studentId?: string; firstName?: string };
            setCreatedInfo({
              studentId: result?.studentId ?? '—',
              firstName: data.firstName,
              contactEmail: data.contactEmail,
            });
          }}
          loading={creating}
        />
      )}

      {/* Invite Existing Student Modal */}
      <InviteStudentModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        tutors={myTutors}
        onInvite={async (data) => {
          await inviteStudent(data as Parameters<typeof inviteStudent>[0]);
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

      {/* Unlink Confirm */}
      <Modal
        open={!!unlinkTarget}
        onClose={() => setUnlinkTarget(null)}
        title="Unlink Student"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setUnlinkTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={unlinking} onClick={async () => { await unlinkStudent(unlinkTarget!.publicId); setUnlinkTarget(null); }}>
              Unlink
            </Button>
          </>
        }
      >
        <p className="text-sm text-clay-muted">
          Unlink <strong className="text-clay-ink">{unlinkTarget?.displayName}</strong> from your organization?
          Their account won't be deleted — they can be re-linked later.
        </p>
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

// ─── StudentId copy chip ──────────────────────────────────────────────────────
function StudentIdCopy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-clay-ink/20 bg-clay-bg px-2.5 py-1.5 font-mono text-sm font-bold text-clay-ink hover:bg-clay-mint/20 transition-colors"
    >
      {value}
      {copied ? <Check className="h-3.5 w-3.5 text-clay-green-dark" /> : <Copy className="h-3.5 w-3.5 text-clay-muted" />}
    </button>
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
  onCreate: (data: { firstName: string; lastName: string; contactEmail?: string; password: string; tutorPublicId: string; customStudentId?: string; grade?: string; notes?: string }) => Promise<void>;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', contactEmail: '', password: '', tutorPublicId: '', customStudentId: '', grade: '', notes: '',
  });
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);

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
        contactEmail: form.contactEmail || undefined,
        password: form.password,
        tutorPublicId: form.tutorPublicId,
        customStudentId: form.customStudentId || undefined,
        grade: form.grade || undefined,
        notes: form.notes || undefined,
      });
      setForm({ firstName: '', lastName: '', contactEmail: '', password: '', tutorPublicId: '', customStudentId: '', grade: '', notes: '' });
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
          <div className="rounded-2xl border-2 border-clay-ink bg-clay-coral px-4 py-3 text-sm font-semibold text-clay-ink shadow-clay-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="First Name" value={form.firstName} onChange={set('firstName')} required />
          <Input label="Last Name" value={form.lastName} onChange={set('lastName')} required />
        </div>

        <Input
          label="Contact Email (optional — login credentials will be sent here)"
          type="email"
          placeholder="parent@example.com"
          value={form.contactEmail}
          onChange={set('contactEmail')}
        />

        <Input
          label="Password"
          type={showPwd ? 'text' : 'password'}
          value={form.password}
          onChange={set('password')}
          required
          rightIcon={
            <button type="button" onClick={() => setShowPwd((p) => !p)} className="text-clay-muted hover:text-clay-ink">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <Select
          label="Assign to Tutor *"
          options={activeTutors.map((t) => ({ value: t.publicId, label: `${t.displayName} (${t.totalStudents} students)` }))}
          placeholder="Select a tutor…"
          value={form.tutorPublicId}
          onChange={set('tutorPublicId')}
        />
        {activeTutors.length === 0 && <p className="text-xs text-clay-muted">No active tutors. Invite tutors first.</p>}

        <Select
          label="Grade (optional)"
          options={GRADE_LIST.map((g) => ({ value: g, label: g }))}
          placeholder="Select grade…"
          value={form.grade}
          onChange={set('grade')}
        />

        <Input
          label="Custom Student ID (optional)"
          placeholder="e.g. stujs1234 — leave blank to auto-generate"
          value={form.customStudentId}
          onChange={set('customStudentId')}
        />
      </form>
    </Modal>
  );
}

// ─── Invite Existing Student Modal ───────────────────────────────────────────

type SearchMode = 'email' | 'phone' | 'studentId' | 'parentEmail';

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
  onInvite: (data: { email?: string; phone?: string; studentId?: string; studentPublicId?: string; tutorPublicId: string }) => Promise<void>;
  loading: boolean;
}) {
  const [searchBy, setSearchBy] = useState<SearchMode>('email');
  const [value, setValue] = useState('');
  const [tutorPublicId, setTutorPublicId] = useState('');
  const [error, setError] = useState('');

  // Parent email search state
  const [parentSearchResult, setParentSearchResult] = useState<{ parentName: string; children: ParentChildResult[] } | null>(null);
  const [parentSearchLoading, setParentSearchLoading] = useState(false);
  const [selectedChild, setSelectedChild] = useState<ParentChildResult | null>(null);

  const activeTutors = tutors.filter((t) => t.status === 'ACTIVE');

  const reset = () => {
    setValue(''); setTutorPublicId(''); setError('');
    setParentSearchResult(null); setSelectedChild(null); setParentSearchLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleParentSearch = async () => {
    if (!value.trim()) return;
    setParentSearchLoading(true); setError(''); setParentSearchResult(null); setSelectedChild(null);
    try {
      const result = await studentsService.searchParentByEmail(value.trim());
      setParentSearchResult(result);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message ?? e.message ?? 'Parent not found');
    } finally { setParentSearchLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!tutorPublicId) { setError('Select a tutor'); return; }

    if (searchBy === 'parentEmail') {
      if (!selectedChild) { setError('Select a student from the list'); return; }
      try {
        await onInvite({ studentPublicId: selectedChild.publicId, tutorPublicId });
        reset();
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setError(e.response?.data?.message ?? e.message ?? 'Failed to send invite');
      }
      return;
    }

    if (searchBy === 'studentId') {
      if (!value.trim()) { setError('Enter a Student ID or UUID'); return; }
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
      try {
        await onInvite({
          ...(isUUID ? { studentPublicId: value.trim() } : { studentId: value.trim() }),
          tutorPublicId,
        });
        reset();
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setError(e.response?.data?.message ?? e.message ?? 'Failed to send invite');
      }
      return;
    }

    try {
      await onInvite({ [searchBy]: value.trim(), tutorPublicId } as Parameters<typeof onInvite>[0]);
      reset();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message ?? e.message ?? 'Failed to send invite');
    }
  };

  const MODES: { key: SearchMode; label: string }[] = [
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'studentId', label: 'Student ID' },
    { key: 'parentEmail', label: 'Parent Email' },
  ];

  return (
    <Modal open={open} onClose={handleClose} title="Invite Existing Student" size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button form="invite-student-form" type="submit" loading={loading}>
            <Send className="h-4 w-4 mr-1.5" /> Send Invite
          </Button>
        </>
      }
    >
      <form id="invite-student-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-2xl border-2 border-clay-ink bg-clay-coral px-4 py-3 text-sm font-semibold text-clay-ink shadow-clay-sm">{error}</div>
        )}

        {/* Mode tabs */}
        <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-clay-surface border-2.5 border-clay-ink rounded-2xl shadow-clay-sm">
          {MODES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setSearchBy(key); setValue(''); setParentSearchResult(null); setSelectedChild(null); setError(''); }}
              className={`py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                searchBy === key
                  ? 'bg-clay-green text-white border-2 border-clay-ink'
                  : 'text-clay-muted hover:text-clay-ink hover:bg-clay-bg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search input */}
        {searchBy === 'email' && (
          <Input label="Student Email" type="email" value={value} onChange={(e) => setValue(e.target.value)}
            placeholder="student@example.com" leftIcon={<Mail className="h-4 w-4" />} required />
        )}
        {searchBy === 'phone' && (
          <Input label="Student Phone" type="tel" value={value} onChange={(e) => setValue(e.target.value)}
            placeholder="+1234567890" leftIcon={<Search className="h-4 w-4" />} required />
        )}
        {searchBy === 'studentId' && (
          <Input
            label="Student ID or Profile UUID"
            placeholder="stujs4821  or  3f9a2b1c-…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            hint="Enter the student's login ID (e.g. stujs4821) or their Profile UUID"
            required
          />
        )}
        {searchBy === 'parentEmail' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                label="Parent Email"
                type="email"
                value={value}
                onChange={(e) => { setValue(e.target.value); setParentSearchResult(null); setSelectedChild(null); }}
                placeholder="parent@example.com"
                leftIcon={<Mail className="h-4 w-4" />}
              />
              <div className="mt-7">
                <Button type="button" variant="outline" size="sm" onClick={handleParentSearch} loading={parentSearchLoading}>
                  Search
                </Button>
              </div>
            </div>

            {parentSearchResult && (
              <div className="space-y-2">
                <p className="text-xs font-extrabold uppercase tracking-wider text-clay-muted">
                  Children under {parentSearchResult.parentName}
                </p>
                {parentSearchResult.children.length === 0 ? (
                  <p className="text-sm text-clay-muted">No children linked to this parent.</p>
                ) : (
                  <div className="space-y-2">
                    {parentSearchResult.children.map((child) => {
                      const name = `${child.firstName} ${child.lastName}`.trim();
                      const isSelected = selectedChild?.publicId === child.publicId;
                      return (
                        <button
                          key={child.publicId}
                          type="button"
                          onClick={() => setSelectedChild(isSelected ? null : child)}
                          className={`w-full flex items-center gap-3 rounded-2xl border-2.5 p-3 text-left transition-all ${
                            isSelected
                              ? 'border-clay-ink bg-clay-mint shadow-clay-sm'
                              : 'border-clay-ink/20 bg-clay-surface hover:bg-clay-bg'
                          }`}
                        >
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border-2 border-clay-ink bg-clay-purple text-sm font-black text-clay-ink">
                            {name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-clay-ink">{name}</p>
                            <p className="text-xs text-clay-muted">{child.grade ?? 'No grade'} · {child.status.replace(/_/g, ' ')}</p>
                            {child.studentId && <p className="text-xs font-mono text-clay-muted">{child.studentId}</p>}
                          </div>
                          {child.alreadyLinked && <span className="text-[10px] font-extrabold text-clay-muted uppercase">Linked</span>}
                          {isSelected && <Check className="h-4 w-4 text-clay-green-dark flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tutor selector */}
        <Select
          label="Assign to Tutor *"
          options={activeTutors.map((t) => ({ value: t.publicId, label: `${t.displayName} (${t.totalStudents} students)` }))}
          placeholder="Select a tutor…"
          value={tutorPublicId}
          onChange={(e) => setTutorPublicId(e.target.value)}
        />
        {activeTutors.length === 0 && <p className="text-xs text-clay-muted">No active tutors. Invite tutors first.</p>}
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
  const showEmail = student.email && !student.email.endsWith('@student.internal');

  const stats = [
    { icon: BookOpen, label: 'Classes Attended', value: student.totalClassesAttended, color: 'bg-clay-sky/30' },
    { icon: BarChart3, label: 'Attendance Rate', value: student.totalClassesAttended > 0 ? `${attendancePct}%` : 'N/A', color: 'bg-clay-mint/30' },
    { icon: Users, label: 'Demos Used', value: `${student.demoClassesUsed}/3`, color: 'bg-clay-yellow/30' },
    { icon: GraduationCap, label: 'Grade', value: student.grade ?? '—', color: 'bg-clay-purple/30' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl border-2 border-clay-ink/10 bg-clay-bg px-4 py-3">
        <Avatar name={name} size="lg" />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-black text-clay-ink">{name}</h3>
          {showEmail && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-clay-muted truncate">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" /> {student.email}
            </p>
          )}
          {assignedTutor && (
            <p className="mt-0.5 text-xs font-bold text-clay-green-dark">
              Tutor: {assignedTutor.displayName}
            </p>
          )}
          <div className="mt-2">
            <Badge variant={STATUS_VARIANT[student.status] ?? 'default'}>
              {student.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className={`flex items-center gap-3 rounded-2xl border-2 border-clay-ink/20 ${color} p-3`}>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 border-clay-ink/30 bg-white/50">
              <Icon className="h-4 w-4 text-clay-ink" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-clay-muted">{label}</p>
              <p className="text-sm font-black text-clay-ink">{value}</p>
            </div>
          </div>
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
