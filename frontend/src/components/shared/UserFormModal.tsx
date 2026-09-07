import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { adminUsersService } from '../../services/admin-users.service';

type Mode = 'create' | 'edit';

interface UserFormModalProps {
  open: boolean;
  mode: Mode;
  /** Required in edit mode; ignored on create. */
  publicId?: string | null;
  /** Pre-selects and locks the role on create (used by the per-role directories). */
  lockedRole?: string;
  /** Roles the current admin may create. */
  creatableRoles: { value: string; label: string }[];
  onClose: () => void;
  onSaved?: () => void;
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_VERIFICATION', label: 'Pending verification' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

interface ProfileField {
  key: string;
  label: string;
  type?: 'text' | 'number';
  /** Stored as an array server-side, edited as a comma-separated list. */
  list?: boolean;
  hint?: string;
}

/** Mirrors the server's per-role editable-field allowlist. */
const PROFILE_FIELDS: Record<string, ProfileField[]> = {
  STUDENT: [
    { key: 'grade', label: 'Grade' },
    { key: 'contactEmail', label: 'Contact email' },
    { key: 'notes', label: 'Notes' },
  ],
  TUTOR: [
    { key: 'subjects', label: 'Subjects', list: true, hint: 'Comma separated' },
    { key: 'languages', label: 'Languages', list: true, hint: 'Comma separated' },
    { key: 'hourlyRateCents', label: 'Hourly rate (USD)', type: 'number' },
    { key: 'commissionRatePercent', label: 'Commission (%)', type: 'number' },
    { key: 'bio', label: 'Bio' },
  ],
  PRINCIPAL: [
    { key: 'organizationName', label: 'Organization' },
    { key: 'organizationWebsite', label: 'Website' },
    { key: 'commissionRatePercent', label: 'Commission (%)', type: 'number' },
    { key: 'bio', label: 'Bio' },
  ],
};

const CENTS_FIELDS = new Set(['hourlyRateCents']);

function profileToForm(role: string, profile: Record<string, unknown> | null): Record<string, string> {
  const fields = PROFILE_FIELDS[role] ?? [];
  const out: Record<string, string> = {};
  for (const f of fields) {
    const raw = profile?.[f.key];
    if (raw === undefined || raw === null) { out[f.key] = ''; continue; }
    if (f.list) out[f.key] = Array.isArray(raw) ? raw.join(', ') : String(raw);
    else if (CENTS_FIELDS.has(f.key)) out[f.key] = String(Number(raw) / 100);
    else out[f.key] = String(raw);
  }
  return out;
}

export function UserFormModal({
  open, mode, publicId, lockedRole, creatableRoles, onClose, onSaved,
}: UserFormModalProps) {
  const qc = useQueryClient();
  const [account, setAccount] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [role, setRole] = useState(lockedRole ?? creatableRoles[0]?.value ?? 'STUDENT');

  const isEdit = mode === 'edit';

  const { data: detail, isLoading } = useQuery({
    queryKey: ['user-detail', publicId],
    queryFn: () => adminUsersService.detail(publicId!),
    enabled: open && isEdit && !!publicId,
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && detail) {
      setRole(detail.user.role);
      setAccount({
        firstName: detail.user.firstName ?? '',
        lastName: detail.user.lastName ?? '',
        email: detail.user.email ?? '',
        phone: detail.user.phone ?? '',
        timezone: detail.user.timezone ?? 'UTC',
        status: detail.user.status ?? 'ACTIVE',
      });
      setProfile(profileToForm(detail.user.role, detail.profile));
    } else if (!isEdit) {
      setRole(lockedRole ?? creatableRoles[0]?.value ?? 'STUDENT');
      setAccount({ firstName: '', lastName: '', email: '', phone: '', timezone: 'UTC' });
      setProfile({});
    }
  }, [open, isEdit, detail, lockedRole, creatableRoles]);

  const profileFields = useMemo(() => PROFILE_FIELDS[role] ?? [], [role]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['user-directory'] });
    qc.invalidateQueries({ queryKey: ['user-counts'] });
    qc.invalidateQueries({ queryKey: ['user-detail'] });
    qc.invalidateQueries({ queryKey: ['people-directory'] });
  };

  const { mutate: save, isPending, error } = useMutation({
    mutationFn: async () => {
      if (!isEdit) {
        // Create carries only the couple of profile fields registration accepts;
        // everything else is patched straight after, once the profile exists.
        const created = await adminUsersService.create({
          email: account.email?.trim(),
          firstName: account.firstName?.trim(),
          lastName: account.lastName?.trim(),
          role,
          phone: account.phone?.trim() || undefined,
          timezone: account.timezone?.trim() || undefined,
          grade: profile.grade?.trim() || undefined,
          organizationName: profile.organizationName?.trim() || undefined,
        });
        const rest = buildProfilePatch(profileFields, profile, ['grade', 'organizationName']);
        if (Object.keys(rest).length > 0) {
          await adminUsersService.updateProfile(created.user.publicId, rest);
        }
        return;
      }

      await adminUsersService.update(publicId!, {
        firstName: account.firstName?.trim(),
        lastName: account.lastName?.trim(),
        email: account.email?.trim(),
        phone: account.phone?.trim() || undefined,
        timezone: account.timezone?.trim() || undefined,
        status: account.status,
      });
      const patch = buildProfilePatch(profileFields, profile);
      if (Object.keys(patch).length > 0) {
        await adminUsersService.updateProfile(publicId!, patch);
      }
    },
    onSuccess: () => { invalidate(); onSaved?.(); onClose(); },
  });

  const canSubmit =
    account.firstName?.trim() && account.lastName?.trim() && account.email?.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={isEdit ? 'Edit User' : 'Create User'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={isPending} disabled={!canSubmit} onClick={() => save()}>
            {isEdit ? 'Save changes' : 'Create & send invite'}
          </Button>
        </>
      }
    >
      {isEdit && isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Account</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First name"
                value={account.firstName ?? ''}
                onChange={(e) => setAccount((a) => ({ ...a, firstName: e.target.value }))}
              />
              <Input
                label="Last name"
                value={account.lastName ?? ''}
                onChange={(e) => setAccount((a) => ({ ...a, lastName: e.target.value }))}
              />
              <Input
                label="Email"
                type="email"
                value={account.email ?? ''}
                onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
                hint={isEdit ? 'Changing this marks the address unverified' : undefined}
              />
              <Input
                label="Phone"
                value={account.phone ?? ''}
                onChange={(e) => setAccount((a) => ({ ...a, phone: e.target.value }))}
              />
              <Input
                label="Timezone"
                value={account.timezone ?? ''}
                onChange={(e) => setAccount((a) => ({ ...a, timezone: e.target.value }))}
              />
              {isEdit ? (
                <Select
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={account.status ?? 'ACTIVE'}
                  onChange={(e) => setAccount((a) => ({ ...a, status: e.target.value }))}
                />
              ) : (
                <Select
                  label="Role"
                  options={creatableRoles}
                  value={role}
                  disabled={!!lockedRole}
                  onChange={(e) => setRole(e.target.value)}
                />
              )}
            </div>
          </div>

          {profileFields.length > 0 && (
            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                {role.replace('_', ' ').toLowerCase()} profile
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                {profileFields.map((f) => (
                  <Input
                    key={f.key}
                    label={f.label}
                    type={f.type ?? 'text'}
                    hint={f.hint}
                    value={profile[f.key] ?? ''}
                    onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                ))}
              </div>
            </div>
          )}

          {!isEdit && (
            <p className="text-xs text-slate-400">
              The account is created unverified. An invitation email is sent so they can
              set their own password — no password is generated or shown here.
            </p>
          )}

          {error && (
            <p className="text-sm font-medium text-rose-500">{(error as Error).message}</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function buildProfilePatch(
  fields: ProfileField[],
  values: Record<string, string>,
  skip: string[] = [],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const f of fields) {
    if (skip.includes(f.key)) continue;
    const raw = values[f.key];
    if (raw === undefined || raw.trim() === '') continue;
    if (f.list) patch[f.key] = raw.split(',').map((s) => s.trim()).filter(Boolean);
    else if (CENTS_FIELDS.has(f.key)) patch[f.key] = Math.round(Number(raw) * 100);
    else if (f.type === 'number') patch[f.key] = Number(raw);
    else patch[f.key] = raw.trim();
  }
  return patch;
}
