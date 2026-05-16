import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '../../components/shared/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { AttendanceSheet } from '../../components/shared/AttendanceSheet';
import { useMyClassesAsTutor } from '../../hooks/use-classes';
import { useMyStudentsAsTutor, useCreateStudent, useInviteExistingStudent } from '../../hooks/use-students';
import { studentsService } from '../../services/students.service';
import type { StudentLookupResult } from '../../services/students.service';
import { useQuery } from '@tanstack/react-query';
import { attendanceService } from '../../services/attendance.service';
import { formatInTimeZone } from 'date-fns-tz';
import type { ClassRecord } from '../../services/classes.service';
import { useStartConversation } from '../../features/chat/use-chat';
import { UserPlus, GraduationCap, BookOpen, Eye, EyeOff, Search } from 'lucide-react';
import { GRADE_OPTIONS, GRADE_LIST } from '../../constants/grades';

// ── Create-student form schema ───────────────────────────────────────
const createStudentSchema = z.object({
  firstName:       z.string().min(1, 'First name is required').max(50),
  lastName:        z.string().min(1, 'Last name is required').max(50),
  email:           z.string().email('Invalid email'),
  phone:           z.string().optional(),
  password:        z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm password'),
  grade:           z.enum(GRADE_LIST).optional(),
  notes:           z.string().optional(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type CreateStudentForm = z.infer<typeof createStudentSchema>;

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'default' | 'danger'> = {
  ACTIVE:           'success',
  PENDING_APPROVAL: 'warning',
  SUSPENDED:        'danger',
  INACTIVE:         'default',
  TRANSFERRED:      'default',
};

// ── Page ────────────────────────────────────────────────────────────
export function TutorStudentsPage() {
  const navigate = useNavigate();
  const userTimezone =
    useAuthStore((s) => s.user?.timezone) ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [tab, setTab]                   = useState<'students' | 'classes'>('students');
  const [showCreate, setShowCreate]         = useState(false);
  const [showInvite, setShowInvite]         = useState(false);
  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [formError, setFormError]           = useState<string | null>(null);
  const [selectedClass, setSelectedClass]   = useState<ClassRecord | null>(null);
  const [inviteQuery, setInviteQuery]       = useState('');
  const [inviteMode, setInviteMode]         = useState<'email' | 'phone'>('email');
  const [lookupResult, setLookupResult]     = useState<StudentLookupResult | null>(null);
  const [lookupError, setLookupError]       = useState<string | null>(null);
  const [lookupLoading, setLookupLoading]   = useState(false);

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

  // ── form ──
  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<CreateStudentForm>({ resolver: zodResolver(createStudentSchema) });

  const handleMessage = async (userPublicId: string) => {
    const conv = await startConversation({ recipientPublicId: userPublicId, recipientRole: 'STUDENT' });
    navigate(`/chat/${conv.publicId}`);
  };

  const handleLookup = async () => {
    setLookupError(null);
    setLookupResult(null);
    if (!inviteQuery.trim()) return;
    setLookupLoading(true);
    try {
      const params = inviteMode === 'email' ? { email: inviteQuery.trim() } : { phone: inviteQuery.trim() };
      const result = await studentsService.lookupStudent(params);
      setLookupResult(result);
    } catch (e: unknown) {
      setLookupError(e instanceof Error ? e.message : 'Student not found');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!lookupResult) return;
    setLookupError(null);
    try {
      const params = inviteMode === 'email' ? { email: inviteQuery.trim() } : { phone: inviteQuery.trim() };
      await inviteExisting(params);
      setShowInvite(false);
      setInviteQuery('');
      setLookupResult(null);
    } catch (e: unknown) {
      setLookupError(e instanceof Error ? e.message : 'Failed to send invite');
    }
  };

  const onSubmit = async (data: CreateStudentForm) => {
    setFormError(null);
    try {
      const { confirmPassword, ...dto } = data;
      await createStudent(dto);
      reset();
      setShowCreate(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to create student');
    }
  };

  const studentNameMap = new Map(
    students.map((s) => [s.publicId, s.displayName || `${s.firstName} ${s.lastName}`.trim()]),
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="My Students"
          subtitle={`${students.length} student${students.length !== 1 ? 's' : ''} linked to your account`}
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowInvite(true)}>
            <Search size={16} className="mr-1.5" />
            Find & Invite
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <UserPlus size={16} className="mr-1.5" />
            Create New
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {([
          { key: 'students', label: 'Students', icon: GraduationCap },
          { key: 'classes',  label: 'Completed Classes', icon: BookOpen },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Students tab ── */}
      {tab === 'students' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {studentsLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                <GraduationCap size={28} className="text-indigo-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">No students yet</p>
              <Button size="sm" onClick={() => setShowCreate(true)}>Add your first student</Button>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-5 py-3 w-10" />
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3 py-3">Student</th>
                  <th className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3 py-3 w-24">Grade</th>
                  <th className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3 py-3 w-28">Attendance</th>
                  <th className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3 py-3 w-32">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-5 py-3 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {students.map((student) => {
                  const name = student.displayName || `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || 'Student';
                  const attendancePct = Math.round(student.attendanceRate ?? 0);
                  return (
                    <tr key={student.publicId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <Avatar name={name} size="sm" />
                      </td>
                      <td className="px-3 py-3.5 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{name}</p>
                        {student.email && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">{student.email}</p>
                        )}
                        {student.notes && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs mt-0.5 italic">{student.notes}</p>
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
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleMessage(student.userPublicId)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
                        >
                          Message
                        </button>
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
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {classesLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : completedClasses.length === 0 ? (
            <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">
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
                    className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
                  >
                    <Avatar name={studentName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{cls.subject}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{studentName}</p>
                      {cls.scheduledStartUTC && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {formatInTimeZone(new Date(cls.scheduledStartUTC), userTimezone, 'MMM d, yyyy · h:mm a zzz')}
                        </p>
                      )}
                    </div>
                    <Badge variant="success">Completed</Badge>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      View Attendance →
                    </span>
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
              <p className="text-sm text-gray-500 dark:text-gray-400">
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

      {/* ── Find & Invite existing student modal ── */}
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
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
            Search for an existing student account by email or phone. An invite will be sent — the student must accept to appear in your students list.
          </div>

          {/* Toggle email / phone */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
            {(['email', 'phone'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setInviteMode(mode); setInviteQuery(''); setLookupResult(null); setLookupError(null); }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  inviteMode === mode ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {mode === 'email' ? 'Email' : 'Phone'}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type={inviteMode === 'email' ? 'email' : 'tel'}
              value={inviteQuery}
              onChange={(e) => { setInviteQuery(e.target.value); setLookupResult(null); setLookupError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              placeholder={inviteMode === 'email' ? 'student@example.com' : '+91 98765 43210'}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button type="button" variant="outline" onClick={handleLookup} loading={lookupLoading}>
              Search
            </Button>
          </div>

          {lookupError && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{lookupError}</p>
          )}

          {lookupResult && (
            <div className={`rounded-xl border p-4 flex items-center gap-3 ${
              lookupResult.alreadyLinked
                ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
            }`}>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white dark:bg-gray-800 font-semibold text-indigo-600 text-sm ring-1 ring-indigo-200">
                {lookupResult.firstName[0]}{lookupResult.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {lookupResult.firstName} {lookupResult.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{lookupResult.email}</p>
              </div>
              {lookupResult.alreadyLinked ? (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Already linked</span>
              ) : (
                <span className="text-xs font-medium text-green-700 dark:text-green-400">Found</span>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Create Student modal ── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setFormError(null); reset(); }}
        title="Add New Student"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={creating}>Create Student</Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {/* Info banner */}
          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-4 py-3 text-sm text-indigo-700 dark:text-indigo-300">
            The student account will be created and immediately linked to your profile. They can log in right away and change their password after signing in.
          </div>

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              placeholder="e.g. Priya"
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <Input
              label="Last Name"
              placeholder="e.g. Sharma"
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>

          <Input
            label="Email"
            type="email"
            placeholder="student@example.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Phone (optional)"
            type="tel"
            placeholder="+91 98765 43210"
            error={errors.phone?.message}
            {...register('phone')}
          />

          {/* Password row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <Input
                label="Confirm Password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat password"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Select
            label="Grade (optional)"
            options={GRADE_OPTIONS}
            placeholder="Select grade"
            error={errors.grade?.message}
            {...register('grade')}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Any special requirements, learning goals…"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              {...register('notes')}
            />
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{formError}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}
