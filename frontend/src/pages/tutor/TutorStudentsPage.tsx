import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { PageHeader } from '../../components/shared/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { AttendanceSheet } from '../../components/shared/AttendanceSheet';
import { useMyClassesAsTutor } from '../../hooks/use-classes';
import { useMyStudentsAsTutor, useCreateStudent, useInviteExistingStudent, useUnlinkStudent } from '../../hooks/use-students';
import { studentsService } from '../../services/students.service';
import type { StudentLookupResult } from '../../services/students.service';
import { useQuery } from '@tanstack/react-query';
import { attendanceService } from '../../services/attendance.service';
import { formatInTimeZone } from 'date-fns-tz';
import type { ClassRecord } from '../../services/classes.service';
import { useStartConversation } from '../../features/chat/use-chat';
import {
  UserPlus, GraduationCap, BookOpen, Eye, EyeOff, Search,
  Trash2, Copy, Check, CheckCircle2,
} from 'lucide-react';
import { GRADE_OPTIONS, GRADE_LIST } from '../../constants/grades';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'default' | 'danger'> = {
  ACTIVE:           'success',
  PENDING_APPROVAL: 'warning',
  SUSPENDED:        'danger',
  INACTIVE:         'default',
  TRANSFERRED:      'default',
};

// ─── Copy chip ────────────────────────────────────────────────────────────────
function CopyValue({ value }: { value: string }) {
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

// ─── Page ────────────────────────────────────────────────────────────────────
export function TutorStudentsPage() {
  const navigate = useNavigate();
  const userTimezone =
    useAuthStore((s) => s.user?.timezone) ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [tab, setTab]             = useState<'students' | 'classes'>('students');
  const [showCreate, setShowCreate]   = useState(false);
  const [showInvite, setShowInvite]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassRecord | null>(null);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteMode, setInviteMode]   = useState<'email' | 'phone'>('email');
  const [lookupResult, setLookupResult] = useState<StudentLookupResult | null>(null);
  const [lookupError, setLookupError]   = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [unlinkTarget, setUnlinkTarget]   = useState<string | null>(null);
  const [createdInfo, setCreatedInfo]     = useState<{ studentId: string; firstName: string; contactEmail?: string } | null>(null);

  // form state
  const [form, setForm] = useState({
    firstName: '', lastName: '', contactEmail: '', phone: '',
    password: '', grade: '', customStudentId: '', notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── data ──
  const { data: studentsPage, isLoading: studentsLoading } = useMyStudentsAsTutor({ limit: '200' });
  const students = studentsPage?.items ?? [];

  const { data: classData, isLoading: classesLoading } = useMyClassesAsTutor({ status: 'COMPLETED', limit: '100' });
  const completedClasses = classData?.items ?? [];

  const { data: attendanceRecords = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance', selectedClass?.publicId],
    queryFn:  () => attendanceService.getByClass(selectedClass!.publicId),
    enabled:  !!selectedClass,
  });

  const { mutateAsync: startConversation } = useStartConversation();
  const { mutateAsync: createStudent, isPending: creating } = useCreateStudent();
  const { mutateAsync: inviteExisting, isPending: inviting } = useInviteExistingStudent();
  const { mutateAsync: unlinkStudent, isPending: unlinking } = useUnlinkStudent();

  const handleMessage = async (userPublicId: string) => {
    const conv = await startConversation({ recipientPublicId: userPublicId, recipientRole: 'STUDENT' });
    navigate(`/chat/${conv.publicId}`);
  };

  const handleLookup = async () => {
    setLookupError(null); setLookupResult(null);
    if (!inviteQuery.trim()) return;
    setLookupLoading(true);
    try {
      const params = inviteMode === 'email' ? { email: inviteQuery.trim() } : { phone: inviteQuery.trim() };
      setLookupResult(await studentsService.lookupStudent(params));
    } catch (e: unknown) {
      setLookupError(e instanceof Error ? e.message : 'Student not found');
    } finally { setLookupLoading(false); }
  };

  const handleSendInvite = async () => {
    if (!lookupResult) return;
    setLookupError(null);
    try {
      const params = inviteMode === 'email' ? { email: inviteQuery.trim() } : { phone: inviteQuery.trim() };
      await inviteExisting(params);
      setShowInvite(false); setInviteQuery(''); setLookupResult(null);
    } catch (e: unknown) {
      setLookupError(e instanceof Error ? e.message : 'Failed to send invite');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      const result = await createStudent({
        firstName: form.firstName,
        lastName: form.lastName,
        contactEmail: form.contactEmail || undefined,
        phone: form.phone || undefined,
        password: form.password,
        grade: form.grade as typeof GRADE_LIST[number] || undefined,
        customStudentId: form.customStudentId || undefined,
        notes: form.notes || undefined,
      }) as unknown as { studentId?: string };
      setCreatedInfo({
        studentId: (result as { studentId: string }).studentId ?? form.customStudentId ?? '—',
        firstName: form.firstName,
        contactEmail: form.contactEmail || undefined,
      });
      setForm({ firstName: '', lastName: '', contactEmail: '', phone: '', password: '', grade: '', customStudentId: '', notes: '' });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setFormError(err.response?.data?.message ?? err.message ?? 'Failed to create student');
    }
  };

  const resetCreate = () => { setCreatedInfo(null); setFormError(null); setShowCreate(false); };

  const studentNameMap = new Map(
    students.map((s) => [s.publicId, s.displayName || `${s.firstName} ${s.lastName}`.trim()]),
  );

  const tabs = [
    { key: 'students' as const, label: 'Students', icon: GraduationCap },
    { key: 'classes' as const,  label: 'Completed Classes', icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="My Students"
          subtitle={`${students.length} student${students.length !== 1 ? 's' : ''} linked`}
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowInvite(true)}>
            <Search size={15} className="mr-1.5" /> Find & Invite
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <UserPlus size={15} className="mr-1.5" /> Create New
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1.5 p-1.5 bg-clay-surface border-2.5 border-clay-ink rounded-2xl w-fit shadow-clay-sm">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
              tab === key
                ? 'bg-clay-green text-white border-2 border-clay-ink'
                : 'text-clay-muted hover:text-clay-ink hover:bg-clay-bg'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── Students tab ── */}
      {tab === 'students' && (
        <div className="rounded-[28px] border-2.5 border-clay-ink bg-clay-surface shadow-clay overflow-hidden">
          {studentsLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-2 border-clay-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-clay-purple">
                <GraduationCap size={28} className="text-clay-ink" />
              </div>
              <p className="text-sm font-bold text-clay-muted">No students yet</p>
              <Button size="sm" onClick={() => setShowCreate(true)}>Add your first student</Button>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-dashed border-clay-ink/20 bg-clay-bg">
                  <th className="px-5 py-3 w-10" />
                  <th className="text-left text-[11px] font-extrabold uppercase tracking-wider text-clay-muted px-3 py-3">Student</th>
                  <th className="text-center text-[11px] font-extrabold uppercase tracking-wider text-clay-muted px-3 py-3 w-24">Grade</th>
                  <th className="text-center text-[11px] font-extrabold uppercase tracking-wider text-clay-muted px-3 py-3 w-28">Attendance</th>
                  <th className="text-center text-[11px] font-extrabold uppercase tracking-wider text-clay-muted px-3 py-3 w-32">Status</th>
                  <th className="text-right text-[11px] font-extrabold uppercase tracking-wider text-clay-muted px-5 py-3 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay-ink/10">
                {students.map((student) => {
                  const name = student.displayName || `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || 'Student';
                  const attendancePct = Math.round(student.attendanceRate ?? 0);
                  return (
                    <tr key={student.publicId} className="hover:bg-clay-bg/50 transition-colors">
                      <td className="px-5 py-3.5"><Avatar name={name} size="sm" /></td>
                      <td className="px-3 py-3.5 min-w-0">
                        <p className="text-sm font-bold text-clay-ink">{name}</p>
                        {student.notes && (
                          <p className="text-xs text-clay-muted truncate max-w-xs mt-0.5 italic">{student.notes}</p>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="text-sm font-semibold text-clay-muted">{student.grade ?? '—'}</span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className={`text-sm font-extrabold ${
                          attendancePct >= 75 ? 'text-clay-green-dark'
                          : attendancePct >= 50 ? 'text-clay-yellow'
                          : attendancePct === 0 ? 'text-clay-muted' : 'text-clay-coral'
                        }`}>
                          {student.totalClassesAttended > 0 ? `${attendancePct}%` : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <Badge variant={STATUS_VARIANT[student.status] ?? 'default'}>
                          {student.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleMessage(student.userPublicId)}
                            className="text-xs font-extrabold text-clay-green-dark hover:underline whitespace-nowrap"
                          >
                            Message
                          </button>
                          <button
                            onClick={() => setUnlinkTarget(student.publicId)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-clay-ink/20 bg-clay-bg text-clay-muted hover:border-red-400 hover:bg-clay-coral/20 hover:text-red-500 transition-colors"
                            title="Remove student"
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
          )}
        </div>
      )}

      {/* ── Completed Classes tab ── */}
      {tab === 'classes' && (
        <div className="rounded-[28px] border-2.5 border-clay-ink bg-clay-surface shadow-clay overflow-hidden">
          {classesLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-2 border-clay-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : completedClasses.length === 0 ? (
            <div className="py-16 text-center text-sm font-bold text-clay-muted">No completed classes yet</div>
          ) : (
            <div className="divide-y divide-clay-ink/10">
              {completedClasses.map((cls) => {
                const studentName = studentNameMap.get(cls.studentPublicId) ?? cls.studentPublicId.slice(0, 8);
                return (
                  <button
                    key={cls.publicId}
                    onClick={() => setSelectedClass(cls)}
                    className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-clay-bg/50 transition-colors text-left"
                  >
                    <Avatar name={studentName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-clay-ink truncate">{cls.subject}</p>
                      <p className="text-xs font-semibold text-clay-muted">{studentName}</p>
                      {cls.scheduledStartUTC && (
                        <p className="text-xs text-clay-muted">
                          {formatInTimeZone(new Date(cls.scheduledStartUTC), userTimezone, 'MMM d, yyyy · h:mm a zzz')}
                        </p>
                      )}
                    </div>
                    <Badge variant="success">Completed</Badge>
                    <span className="text-xs font-extrabold text-clay-green-dark whitespace-nowrap">View →</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Attendance modal ── */}
      <Modal
        open={!!selectedClass}
        onClose={() => setSelectedClass(null)}
        title={selectedClass ? `${selectedClass.subject} — ${studentNameMap.get(selectedClass.studentPublicId) ?? 'Student'}` : ''}
        size="lg"
      >
        {selectedClass && (
          <div className="space-y-3">
            {selectedClass.scheduledStartUTC && (
              <p className="text-sm font-semibold text-clay-muted">
                {formatInTimeZone(new Date(selectedClass.scheduledStartUTC), userTimezone, 'EEE, MMM d yyyy · h:mm a zzz')}
              </p>
            )}
            <AttendanceSheet
              classPublicId={selectedClass.publicId}
              records={attendanceRecords}
              loading={loadingAttendance}
              canOverride
            />
          </div>
        )}
      </Modal>

      {/* ── Find & Invite modal ── */}
      <Modal
        open={showInvite}
        onClose={() => { setShowInvite(false); setInviteQuery(''); setLookupResult(null); setLookupError(null); }}
        title="Find & Invite Student"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
            {lookupResult && !lookupResult.alreadyLinked && (
              <Button onClick={handleSendInvite} loading={inviting}>Send Invite</Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-clay-ink/20 bg-clay-sky/20 px-4 py-3 text-sm font-semibold text-clay-ink/70">
            Search by email or phone. Student must accept the invite to appear in your list.
          </div>

          <div className="flex gap-1.5 p-1.5 bg-clay-surface border-2.5 border-clay-ink rounded-2xl w-fit shadow-clay-sm">
            {(['email', 'phone'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setInviteMode(mode); setInviteQuery(''); setLookupResult(null); setLookupError(null); }}
                className={`px-4 py-1.5 rounded-xl text-sm font-extrabold transition-all ${
                  inviteMode === mode ? 'bg-clay-green text-white border-2 border-clay-ink' : 'text-clay-muted hover:text-clay-ink'
                }`}
              >
                {mode === 'email' ? 'Email' : 'Phone'}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              type={inviteMode === 'email' ? 'email' : 'tel'}
              value={inviteQuery}
              onChange={(e) => { setInviteQuery(e.target.value); setLookupResult(null); setLookupError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              placeholder={inviteMode === 'email' ? 'student@example.com' : '+91 98765 43210'}
            />
            <Button type="button" variant="outline" onClick={handleLookup} loading={lookupLoading}>Search</Button>
          </div>

          {lookupError && (
            <div className="rounded-2xl border-2 border-clay-ink bg-clay-coral px-4 py-3 text-sm font-semibold text-clay-ink">{lookupError}</div>
          )}

          {lookupResult && (
            <div className={`rounded-2xl border-2.5 border-clay-ink p-4 flex items-center gap-3 ${
              lookupResult.alreadyLinked ? 'bg-clay-yellow/30' : 'bg-clay-mint/30'
            }`}>
              <Avatar name={`${lookupResult.firstName} ${lookupResult.lastName}`} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-clay-ink">{lookupResult.firstName} {lookupResult.lastName}</p>
                <p className="text-xs text-clay-muted truncate">{lookupResult.email}</p>
              </div>
              <span className={`text-xs font-extrabold ${lookupResult.alreadyLinked ? 'text-clay-muted' : 'text-clay-green-dark'}`}>
                {lookupResult.alreadyLinked ? 'Already linked' : 'Found'}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Create Student modal ── */}
      {createdInfo ? (
        <Modal
          open={showCreate}
          onClose={resetCreate}
          title="Student Account Created!"
          size="sm"
          footer={<Button onClick={resetCreate}>Done</Button>}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-clay-green-dark">
              <CheckCircle2 className="h-5 w-5" />
              Account created for {createdInfo.firstName}
            </div>
            <div className="rounded-2xl border-2.5 border-clay-ink bg-clay-mint p-4 space-y-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-clay-muted mb-1">Student ID (login)</p>
                <CopyValue value={createdInfo.studentId} />
              </div>
              <p className="text-xs font-semibold text-clay-ink/70">
                Student uses this ID + their password to log in.
                {createdInfo.contactEmail && ` Login details sent to ${createdInfo.contactEmail}.`}
              </p>
            </div>
          </div>
        </Modal>
      ) : (
        <Modal
          open={showCreate}
          onClose={resetCreate}
          title="Create New Student"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={resetCreate}>Cancel</Button>
              <Button form="tutor-create-student" type="submit" loading={creating}>
                <UserPlus className="h-4 w-4 mr-1.5" /> Create Student
              </Button>
            </>
          }
        >
          <form id="tutor-create-student" onSubmit={handleCreate} className="space-y-4">
            {formError && (
              <div className="rounded-2xl border-2 border-clay-ink bg-clay-coral px-4 py-3 text-sm font-semibold text-clay-ink">{formError}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" placeholder="Priya" value={form.firstName} onChange={set('firstName')} required />
              <Input label="Last Name" placeholder="Sharma" value={form.lastName} onChange={set('lastName')} required />
            </div>

            <Input
              label="Contact Email (optional — for login details)"
              type="email"
              placeholder="parent@example.com"
              value={form.contactEmail}
              onChange={set('contactEmail')}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min 8 characters"
              value={form.password}
              onChange={set('password')}
              required
              rightIcon={
                <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-clay-muted hover:text-clay-ink">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <Select
              label="Grade (optional)"
              options={GRADE_OPTIONS}
              placeholder="Select grade"
              value={form.grade}
              onChange={set('grade')}
            />

            <Input
              label="Custom Student ID (optional)"
              placeholder="e.g. stujs1234 — leave blank to auto-generate"
              value={form.customStudentId}
              onChange={set('customStudentId')}
            />

            <div>
              <label className="block text-sm font-extrabold text-clay-ink mb-2">Notes (optional)</label>
              <textarea
                rows={2}
                placeholder="Learning goals, requirements…"
                value={form.notes}
                onChange={set('notes')}
                className="w-full rounded-2xl border-2.5 border-clay-ink bg-clay-surface px-4 py-3 text-sm font-semibold text-clay-ink shadow-clay-sm focus:outline-none focus:bg-clay-bg/60 resize-none"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ── Unlink confirm ── */}
      <Modal
        open={!!unlinkTarget}
        onClose={() => setUnlinkTarget(null)}
        title="Remove Student"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setUnlinkTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={unlinking}
              onClick={async () => { await unlinkStudent(unlinkTarget!); setUnlinkTarget(null); }}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-clay-muted">
          Remove this student from your account? Their account won't be deleted — they can be re-linked later.
        </p>
      </Modal>
    </div>
  );
}
