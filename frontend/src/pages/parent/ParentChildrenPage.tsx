import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Trash2, ArrowUpRight, Users, Link2, Copy, Check, Pencil, Eye, EyeOff } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Loading';
import { useParentChildren, useLinkChild, useUnlinkChild, useCreateChild, useUpdateChild } from '../../hooks/use-parent';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'default' | 'danger'> = {
  ACTIVE: 'success',
  PENDING_APPROVAL: 'warning',
  INVITED: 'warning',
  INACTIVE: 'default',
  SUSPENDED: 'danger',
};

const GRADE_LIST = [
  'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
  'Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12',
];

export function ParentChildrenPage() {
  const [mode, setMode] = useState<'create' | 'link' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{ publicId: string; firstName: string; lastName: string; grade?: string } | null>(null);

  const { data: children = [], isLoading } = useParentChildren();
  const { mutateAsync: createChild, isPending: creating } = useCreateChild();
  const { mutateAsync: linkChild, isPending: linking } = useLinkChild();
  const { mutateAsync: unlinkChild, isPending: unlinking } = useUnlinkChild();
  const { mutateAsync: updateChild, isPending: updating } = useUpdateChild();

  const handleRemove = async () => {
    if (!confirmRemove) return;
    try { await unlinkChild(confirmRemove); } finally { setConfirmRemove(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Children"
        description={`${children.length} child${children.length !== 1 ? 'ren' : ''} linked`}
        icon={<Users className="h-6 w-6" />}
        eyebrow="FAMILY"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setMode('link')}>
              <Link2 className="h-4 w-4 mr-1.5" /> Link Existing
            </Button>
            <Button size="sm" onClick={() => setMode('create')}>
              <UserPlus className="h-4 w-4 mr-1.5" /> Create Child
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : children.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No children yet"
          description="Create accounts for your children directly, or link an existing student account."
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMode('link')}>
                <Link2 className="h-4 w-4 mr-1.5" /> Link Existing
              </Button>
              <Button size="sm" onClick={() => setMode('create')}>
                <UserPlus className="h-4 w-4 mr-1.5" /> Create Child
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => {
            const fullName = `${child.firstName} ${child.lastName}`.trim() || 'Student';
            return (
              <div
                key={child.publicId}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={fullName} size="md" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{fullName}</p>
                      <p className="text-xs text-slate-500">{child.grade ?? 'No grade'}</p>
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[child.status] ?? 'default'}>
                    {child.status.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <StudentIdChip studentPublicId={child.publicId} />

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 py-2">
                    <p className="text-lg font-bold text-slate-900">{child.attendanceRate}%</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Attendance</p>
                  </div>
                  <div className="rounded-xl border border-sky-100 bg-sky-50 py-2">
                    <p className="text-lg font-bold text-slate-900">{child.totalClassesAttended}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Classes</p>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-dashed border-slate-100 pt-3">
                  <Link to={`/dashboard/parent/children/${child.publicId}`} className="flex-1">
                    <Button size="sm" variant="secondary" fullWidth>
                      View <ArrowUpRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditTarget({ publicId: child.publicId, firstName: child.firstName, lastName: child.lastName, grade: child.grade })}
                    className="text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmRemove(child.publicId)}
                    className="text-red-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Child Modal */}
      <CreateChildModal
        open={mode === 'create'}
        onClose={() => setMode(null)}
        onCreate={async (dto) => {
          await createChild(dto);
          setMode(null);
        }}
        loading={creating}
      />

      {/* Link Existing Modal */}
      <LinkChildModal
        open={mode === 'link'}
        onClose={() => setMode(null)}
        onLink={async (id) => {
          await linkChild(id);
          setMode(null);
        }}
        loading={linking}
      />

      {/* Edit Child Modal */}
      <EditChildModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        child={editTarget}
        onSave={async (dto) => {
          if (!editTarget) return;
          await updateChild({ studentPublicId: editTarget.publicId, ...dto });
          setEditTarget(null);
        }}
        loading={updating}
      />

      {/* Confirm Remove Modal */}
      <Modal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Remove Child"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleRemove} loading={unlinking}>Remove</Button>
          </>
        }
      >
        <p className="text-sm text-slate-500">
          Remove this child from your account? You can re-link them later with their Student ID.
        </p>
      </Modal>
    </div>
  );
}

// ─── StudentId chip with copy ─────────────────────────────────────────────────
function StudentIdChip({ studentPublicId }: { studentPublicId: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(studentPublicId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
    >
      <span className="truncate font-mono">{studentPublicId}</span>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" /> : <Copy className="h-3.5 w-3.5 flex-shrink-0" />}
    </button>
  );
}

// ─── Create Child Modal ───────────────────────────────────────────────────────
function CreateChildModal({
  open, onClose, onCreate, loading,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (dto: { firstName: string; lastName: string; password: string; customStudentId?: string; grade?: string }) => Promise<void>;
  loading: boolean;
}) {
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '', customStudentId: '', grade: '' });
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ studentId: string; firstName: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [idSuffix] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));
  const [idManuallyEdited, setIdManuallyEdited] = useState(false);

  const buildAutoId = (first: string, last: string) =>
    `stu${(first[0] ?? 'x').toLowerCase()}${(last[0] ?? 'x').toLowerCase()}${idSuffix}`;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setForm((f) => {
      const updated = { ...f, [k]: val };
      if ((k === 'firstName' || k === 'lastName') && !idManuallyEdited) {
        const fi = k === 'firstName' ? val : f.firstName;
        const li = k === 'lastName' ? val : f.lastName;
        if (fi || li) updated.customStudentId = buildAutoId(fi, li);
      }
      return updated;
    });
  };

  const setId = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIdManuallyEdited(true);
    setForm((f) => ({ ...f, customStudentId: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await onCreate({
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
        customStudentId: form.customStudentId || undefined,
        grade: form.grade || undefined,
      }) as unknown as { studentId?: string };
      setCreated({ studentId: (result as { studentId: string }).studentId ?? form.customStudentId ?? '—', firstName: form.firstName });
      setForm({ firstName: '', lastName: '', password: '', customStudentId: '', grade: '' });
      setIdManuallyEdited(false);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e2.response?.data?.message ?? e2.message ?? 'Failed to create child');
    }
  };

  const handleClose = () => { setCreated(null); setError(''); setIdManuallyEdited(false); onClose(); };

  if (created) {
    return (
      <Modal open={open} onClose={handleClose} title="Child Account Created!" size="sm"
        footer={<Button onClick={handleClose}>Done</Button>}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-slate-800">Share this Student ID with {created.firstName}:</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-lg font-bold tracking-widest text-slate-900">
                {created.studentId}
              </code>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Your child uses this Student ID + their password to log in. Save it somewhere safe.
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create Child Account" size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button form="create-child-form" type="submit" loading={loading}>
            <UserPlus className="h-4 w-4 mr-1.5" /> Create Account
          </Button>
        </>
      }
    >
      <form id="create-child-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="First Name" value={form.firstName} onChange={set('firstName')} required />
          <Input label="Last Name" value={form.lastName} onChange={set('lastName')} required />
        </div>

        <Input
          label="Password"
          type={showPwd ? 'text' : 'password'}
          value={form.password}
          onChange={set('password')}
          required
          rightIcon={
            <button type="button" onClick={() => setShowPwd((p) => !p)} className="text-slate-400 hover:text-slate-600">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <Select
          label="Grade"
          placeholder="Select grade…"
          value={form.grade}
          onChange={set('grade')}
          options={GRADE_LIST.map((g) => ({ value: g, label: g }))}
        />

        <Input
          label="Student ID (auto-generated — edit if needed)"
          placeholder="stuxx1234"
          value={form.customStudentId}
          onChange={setId}
          hint="Your child uses this ID + their password to log in."
        />
      </form>
    </Modal>
  );
}

// ─── Link Existing Modal ──────────────────────────────────────────────────────
function LinkChildModal({
  open, onClose, onLink, loading,
}: {
  open: boolean;
  onClose: () => void;
  onLink: (studentPublicId: string) => Promise<void>;
  loading: boolean;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleLink = async () => {
    setError('');
    if (!value.trim()) { setError('Please enter a Student Profile ID'); return; }
    try {
      await onLink(value.trim());
      setValue('');
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e2.response?.data?.message ?? e2.message ?? 'Failed to link child');
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { setValue(''); setError(''); onClose(); }}
      title="Link Existing Child"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleLink} loading={loading}>
            <Link2 className="h-4 w-4 mr-1.5" /> Link Child
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Enter your child's <strong className="text-slate-800">Student ID</strong> (e.g. <code className="font-mono text-slate-700">stujs4821</code>)
          or their <strong className="text-slate-800">Profile UUID</strong>. Both are shown on your child's profile page.
        </p>
        <Input
          label="Student ID or Profile UUID"
          placeholder="stujs4821 or 3f9a2b1c-…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error ?? undefined}
        />
      </div>
    </Modal>
  );
}

// ─── Edit Child Modal ─────────────────────────────────────────────────────────
function EditChildModal({
  open, onClose, child, onSave, loading,
}: {
  open: boolean;
  onClose: () => void;
  child: { publicId: string; firstName: string; lastName: string; grade?: string } | null;
  onSave: (dto: { firstName?: string; lastName?: string; grade?: string }) => Promise<void>;
  loading: boolean;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [grade, setGrade] = useState('');
  const [error, setError] = useState('');

  if (child && open && !firstName && child.firstName) {
    setFirstName(child.firstName);
    setLastName(child.lastName);
    setGrade(child.grade ?? '');
  }
  if (!open && firstName) {
    setFirstName(''); setLastName(''); setGrade(''); setError('');
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await onSave({ firstName: firstName || undefined, lastName: lastName || undefined, grade: grade || undefined });
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e2.response?.data?.message ?? e2.message ?? 'Failed to update');
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { setError(''); onClose(); }}
      title="Edit Child Details"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="edit-child-form" type="submit" loading={loading}>Save Changes</Button>
        </>
      }
    >
      <form id="edit-child-form" onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Select
          label="Grade"
          placeholder="Select grade…"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          options={GRADE_LIST.map((g) => ({ value: g, label: g }))}
        />
      </form>
    </Modal>
  );
}
