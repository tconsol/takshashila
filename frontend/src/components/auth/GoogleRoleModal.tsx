import { useState } from 'react';
import { GraduationCap, Users, Building2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TIMEZONE_OPTIONS } from '../../constants/timezones';
import type { GoogleAuthPayload, GoogleRoleRequired, GoogleSignupRole } from '../../services/auth.service';

/**
 * Second leg of a Google signup. Google proved who they are; this asks what kind
 * of account to create and collects only what that role actually needs, so the
 * person lands on a usable dashboard instead of a half-filled profile.
 */

const ROLES: { value: GoogleSignupRole; label: string; blurb: string; Icon: typeof Users }[] = [
  { value: 'STUDENT', label: 'Student', blurb: 'Book classes and get homework', Icon: Users },
  { value: 'TUTOR', label: 'Tutor', blurb: 'Teach classes and set your hours', Icon: GraduationCap },
  { value: 'PRINCIPAL', label: 'Principal', blurb: 'Run an organisation of tutors', Icon: Building2 },
];

const guessTimezone = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_OPTIONS.some((o) => o.value === tz) ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
};

interface Props {
  info: GoogleRoleRequired;
  submitting: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (extra: Omit<GoogleAuthPayload, 'accessToken' | 'idToken' | 'code'>) => void;
}

export function GoogleRoleModal({ info, submitting, error, onCancel, onSubmit }: Props) {
  const [role, setRole] = useState<GoogleSignupRole | null>(null);
  const [timezone, setTimezone] = useState(guessTimezone);
  const [phone, setPhone] = useState('');
  const [grade, setGrade] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [subjects, setSubjects] = useState('');
  const [bio, setBio] = useState('');

  // The server enforces this too; mirroring it here avoids a pointless round trip.
  const subjectList = subjects.split(',').map((s) => s.trim()).filter(Boolean);
  const canSubmit = !!role && (role !== 'TUTOR' || subjectList.length > 0);

  const submit = () => {
    if (!role || !canSubmit) return;
    onSubmit({
      role,
      timezone,
      phone: phone.trim() || undefined,
      grade: role === 'STUDENT' ? grade.trim() || undefined : undefined,
      organizationName: role === 'PRINCIPAL' ? organizationName.trim() || undefined : undefined,
      subjects: role === 'TUTOR' ? subjectList : undefined,
      bio: role === 'TUTOR' ? bio.trim() || undefined : undefined,
    });
  };

  return (
    <Modal
      open
      onClose={onCancel}
      size="lg"
      title="Finish setting up your account"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} loading={submitting} disabled={!canSubmit}>
            Create account
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <p className="text-sm text-ink-muted">
          Signing up as <span className="font-semibold text-ink">{info.email}</span>. Tell us how
          you'll use the platform — this decides your dashboard and can't be changed later.
        </p>

        <div>
          <p className="eyebrow mb-2">I am a…</p>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {ROLES.map(({ value, label, blurb, Icon }) => {
              const active = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  aria-pressed={active}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? 'border-accent bg-accent-wash'
                      : 'border-rule hover:border-rule-strong hover:bg-surface-hover'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? 'text-accent' : 'text-ink-muted'}`} />
                  <p className={`mt-2 text-sm font-semibold ${active ? 'text-accent' : 'text-ink'}`}>
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">{blurb}</p>
                </button>
              );
            })}
          </div>
        </div>

        {role && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Timezone"
              options={TIMEZONE_OPTIONS}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
            <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />

            {role === 'STUDENT' && (
              <Input
                label="Grade (optional)"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            )}

            {role === 'PRINCIPAL' && (
              <Input
                label="Organisation name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
              />
            )}

            {role === 'TUTOR' && (
              <>
                <Input
                  label="Subjects"
                  value={subjects}
                  onChange={(e) => setSubjects(e.target.value)}
                  hint="Comma separated, e.g. Maths, Physics"
                  error={subjects.length > 0 && subjectList.length === 0 ? 'Add at least one subject' : undefined}
                />
                <Input
                  label="Short bio (optional)"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </>
            )}
          </div>
        )}

        {error && <p className="text-sm font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
