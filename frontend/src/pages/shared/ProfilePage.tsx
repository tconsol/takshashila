import { useState, forwardRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  User, Mail, Phone, Globe, ShieldCheck, Camera,
  CheckCircle2, AlertCircle, Lock, Eye, EyeOff,
  BookOpen, DollarSign, Sparkles, GraduationCap, Calendar, Copy, Check,
  Wallet, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { HangingIdCard } from '../../components/lightswind/HangingIdCard';
import { TagInput } from '../../components/ui/TagInput';
import { Tabs } from '../../components/ui/Tabs';
import { formatInTimeZone } from 'date-fns-tz';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/auth.store';

const SUBJECT_OPTIONS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English',
  'Computer Science', 'History', 'Economics', 'Geography',
  'Political Science', 'Sanskrit', 'Hindi', 'Art', 'Music',
];

const LANGUAGE_OPTIONS = [
  'English', 'Hindi', 'Tamil', 'Telugu', 'Kannada',
  'Malayalam', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi', 'Urdu',
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', PRINCIPAL: 'Principal',
  TUTOR: 'Tutor', STUDENT: 'Student', SUPPORT: 'Support',
};

// `indigo`/`violet` are remapped to the single system accent everywhere else in
// the app (see tailwind.config.ts), so using them here would make TUTOR and
// STUDENT badges collapse onto the same vermilion as every button and link.
// These six hues are deliberately left un-remapped so role stays a distinct
// identity colour. Opacity-based backgrounds (`/10`) tint whatever surface is
// underneath instead of painting a flat light-mode pastel, so the chip reads
// correctly on both the bone and near-black grounds without a second class.
const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  SUPER_ADMIN: { bg: 'bg-rose-500/10',   text: 'text-rose-600 dark:text-rose-400' },
  ADMIN:       { bg: 'bg-amber-500/10',  text: 'text-amber-600 dark:text-amber-400' },
  PRINCIPAL:   { bg: 'bg-teal-500/10',   text: 'text-teal-600 dark:text-teal-400' },
  TUTOR:       { bg: 'bg-sky-500/10',    text: 'text-sky-600 dark:text-sky-400' },
  STUDENT:     { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
  SUPPORT:     { bg: 'bg-pink-500/10',   text: 'text-pink-600 dark:text-pink-400' },
};

const profileSchema = z.object({
  firstName: z.string().min(1, 'Required').max(50),
  lastName: z.string().min(1, 'Required').max(50),
  phone: z.string().optional(),
});

const tutorProfileSchema = z.object({
  bio: z.string().max(1000).optional(),
  subjects: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  hourlyRateUSD: z.coerce.number().int().min(0, 'Rate cannot be negative').default(0),
  qualifications: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(8, 'Min 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match", path: ['confirmPassword'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type TutorProfileForm = z.infer<typeof tutorProfileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

function Toast({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium ${
      type === 'success'
        ? 'bg-ok-wash border border-ok/25 text-ok'
        : 'bg-danger-wash border border-danger/25 text-danger'
    }`}>
      {type === 'success'
        ? <CheckCircle2 className="h-4 w-4 shrink-0" />
        : <AlertCircle className="h-4 w-4 shrink-0" />}
      {message}
    </div>
  );
}

function Field({ label, error, children, hint }: {
  label: string; error?: string; children: React.ReactNode; hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

function TextInput({ icon: Icon, readOnly, ...props }: {
  icon?: React.ElementType; readOnly?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 z-10 text-ink-muted" />}
      <input
        {...props}
        readOnly={readOnly}
        className={`w-full rounded-xl border py-2.5 text-sm transition-colors ${
          Icon ? 'pl-10' : 'pl-3.5'
        } pr-3.5 ${
          readOnly
            ? 'cursor-not-allowed border-rule bg-surface-sunk text-ink-faint'
            : 'border-rule-strong bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent'
        }`}
      />
    </div>
  );
}

const PasswordInput = forwardRef<HTMLInputElement, {
  show: boolean; onToggle: () => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ show, onToggle, ...rest }, ref) => (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 z-10 text-ink-muted" />
      <input
        {...rest}
        ref={ref}
        type={show ? 'text' : 'password'}
        className="w-full rounded-xl border border-rule-strong bg-surface py-2.5 pl-10 pr-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-2"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  ),
);
PasswordInput.displayName = 'PasswordInput';

function SaveButton({ pending, label = 'Save changes' }: { pending: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-accent-ink shadow-sm transition-colors"
    >
      {pending
        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-ink border-t-transparent" />
        : <CheckCircle2 className="h-4 w-4" />}
      {pending ? 'Saving…' : label}
    </button>
  );
}

function CopyChip({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border border-rule bg-surface-sunk px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{label}</p>
        <p className={`truncate text-xs font-semibold text-ink-2 ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy to clipboard"
        className="shrink-0 rounded-lg p-1 transition-colors hover:bg-accent-wash hover:text-accent"
      >
        {copied
          ? <Check className="h-3.5 w-3.5 text-ok" />
          : <Copy className="h-3.5 w-3.5 text-ink-muted" />}
      </button>
    </div>
  );
}

type Tab = 'account' | 'teaching' | 'security';

export function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('account');

  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [tutorFeedback, setTutorFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Principals also teach, so they get the teaching profile tab too
  const isTutor = user?.role === 'TUTOR' || user?.role === 'PRINCIPAL';
  const isStudent = user?.role === 'STUDENT';

  const { data: freshUser } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => api.get('/users/me').then((r) => r.data.data),
  });

  const { data: studentProfile } = useQuery({
    queryKey: ['students', 'me'],
    queryFn: () => api.get('/students/me').then((r) => r.data.data),
    enabled: isStudent,
  });

  useEffect(() => {
    if (freshUser && user) setUser({ ...user, ...freshUser });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshUser]);

  const activeUser = freshUser ?? user;
  const userTimezone = activeUser?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: '', lastName: '', phone: '' },
  });

  useEffect(() => {
    if (!freshUser) return;
    profileForm.setValue('firstName', freshUser.firstName ?? '', { shouldDirty: false });
    profileForm.setValue('lastName',  freshUser.lastName  ?? '', { shouldDirty: false });
    profileForm.setValue('phone',     freshUser.phone     ?? '', { shouldDirty: false });
  }, [freshUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const { mutateAsync: updateProfile, isPending: savingProfile } = useMutation({
    mutationFn: (d: ProfileForm) => api.patch('/users/me', d).then((r) => r.data.data),
    onSuccess: (updated) => {
      if (updated && user) setUser({ ...user, ...updated });
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      setProfileFeedback({ type: 'success', message: 'Account updated successfully!' });
      setTimeout(() => setProfileFeedback(null), 4000);
    },
    onError: (e: Error) => setProfileFeedback({ type: 'error', message: e.message || 'Update failed' }),
  });

  const { data: tutorData } = useQuery({
    queryKey: ['tutors', 'me'],
    queryFn: () => api.get('/tutors/me').then((r) => r.data.data),
    enabled: isTutor,
  });

  const tutorForm = useForm<TutorProfileForm>({
    resolver: zodResolver(tutorProfileSchema),
    defaultValues: { bio: '', subjects: [], languages: [], hourlyRateUSD: 0, qualifications: '' },
    values: tutorData ? {
      bio: tutorData.bio ?? '',
      subjects: tutorData.subjects ?? [],
      languages: tutorData.languages ?? [],
      hourlyRateUSD: Math.round((tutorData.hourlyRateCents ?? 0) / 100),
      qualifications: (tutorData.qualifications ?? []).join(', '),
    } : undefined,
  });

  const { mutateAsync: updateTutorProfile, isPending: savingTutor } = useMutation({
    mutationFn: (d: TutorProfileForm) => api.put('/tutors/me', {
      bio: d.bio || undefined,
      subjects: d.subjects,
      languages: d.languages,
      hourlyRateCents: d.hourlyRateUSD * 100,
      qualifications: d.qualifications ? d.qualifications.split(',').map((q) => q.trim()).filter(Boolean) : [],
    }).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutors', 'me'] });
      setTutorFeedback({ type: 'success', message: 'Teaching profile saved!' });
      setTimeout(() => setTutorFeedback(null), 4000);
    },
    onError: (e: Error) => setTutorFeedback({ type: 'error', message: e.message || 'Update failed' }),
  });

  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const { mutateAsync: changePassword, isPending: savingPassword } = useMutation({
    mutationFn: (d: PasswordForm) => api.post('/auth/change-password', {
      currentPassword: d.currentPassword, newPassword: d.newPassword,
    }),
    onSuccess: () => {
      setPasswordFeedback({ type: 'success', message: 'Password changed successfully!' });
      passwordForm.reset();
      setTimeout(() => setPasswordFeedback(null), 4000);
    },
    onError: (e: Error) => setPasswordFeedback({ type: 'error', message: e.message || 'Failed to change password' }),
  });

  if (!user) return null;

  const displayUser = activeUser ?? user;
  const initials = `${(displayUser.firstName ?? '?')[0]}${(displayUser.lastName ?? '?')[0]}`.toUpperCase();
  const roleColor = ROLE_COLOR[user.role] ?? ROLE_COLOR.STUDENT;
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  const tutorCompletion = isTutor && tutorData ? (() => {
    const checks = [
      !!tutorData.bio,
      (tutorData.subjects?.length ?? 0) > 0,
      (tutorData.languages?.length ?? 0) > 0,
      (tutorData.hourlyRateCents ?? 0) > 0,
      (tutorData.qualifications?.length ?? 0) > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  })() : null;

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'account', label: 'Account', icon: User },
    ...(isTutor ? [{ key: 'teaching' as Tab, label: 'Teaching Profile', icon: GraduationCap }] : []),
    { key: 'security', label: 'Security', icon: ShieldCheck },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">

      {/* Hanging ID Card */}
      <div className="overflow-hidden rounded-2xl border border-rule bg-surface pt-8 pb-4 flex flex-col items-center">
        <HangingIdCard
          name={`${displayUser.firstName} ${displayUser.lastName}`.trim()}
          role={roleLabel}
          badgeId={isStudent ? (displayUser.studentId ?? displayUser.publicId.slice(0, 8).toUpperCase()) : displayUser.publicId.slice(0, 8).toUpperCase()}
          accentColor={
            displayUser.role === 'TUTOR' ? '#7c3aed' :
            displayUser.role === 'PRINCIPAL' ? '#0d9488' :
            displayUser.role === 'ADMIN' ? '#d97706' :
            displayUser.role === 'SUPER_ADMIN' ? '#e11d48' :
            displayUser.role === 'STUDENT' ? '#4f46e5' :
            '#ec4899'
          }
          ropeColor={
            displayUser.role === 'TUTOR' ? '#7c3aed' :
            displayUser.role === 'PRINCIPAL' ? '#0d9488' :
            '#4f46e5'
          }
          ropeLength={110}
        />

        <div className="mt-2 w-full px-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold text-ink">
                {displayUser.firstName} {displayUser.lastName}
              </h1>
              <p className="text-sm text-ink-muted">
                {isStudent ? (displayUser.studentId ?? displayUser.email) : displayUser.email}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${roleColor.bg} ${roleColor.text}`}>
                {roleLabel}
              </span>
              {displayUser.emailVerified
                ? <span className="flex items-center gap-1 rounded-full bg-ok-wash border border-ok/25 px-3 py-1 text-xs font-semibold text-ok">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </span>
                : <span className="flex items-center gap-1 rounded-full bg-warn-wash border border-warn/25 px-3 py-1 text-xs font-semibold text-warn">
                    <AlertCircle className="h-3 w-3" /> Unverified
                  </span>}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {isStudent && displayUser.studentId && (
              <CopyChip label="Student ID (login)" value={displayUser.studentId} />
            )}
            {isStudent && studentProfile?.publicId && (
              <CopyChip label="Profile ID (share with parent)" value={studentProfile.publicId} />
            )}
            {!isStudent && (
              <CopyChip label="Account ID" value={displayUser.publicId} />
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunk px-3 py-1 text-xs font-medium text-ink-2">
              <Calendar className="h-3 w-3" />
              Member since {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </span>
            {user.lastLoginAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunk px-3 py-1 text-xs font-medium text-ink-2">
                <CheckCircle2 className="h-3 w-3" />
                Last login {new Date(user.lastLoginAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          {isTutor && tutorCompletion !== null && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-ink-2">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  Teaching profile {tutorCompletion}% complete
                </span>
                {tutorCompletion < 100 && (
                  <button
                    type="button"
                    onClick={() => setTab('teaching')}
                    className="font-semibold text-accent hover:text-accent-hover"
                  >
                    Complete now →
                  </button>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunk">
                <div
                  className="h-full bg-accent transition-all duration-500 rounded-full"
                  style={{ width: `${tutorCompletion}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Wallet quick-link (wallet lives under profile now) */}
      {(['STUDENT', 'TUTOR', 'PRINCIPAL'] as const).includes(displayUser.role as 'STUDENT' | 'TUTOR' | 'PRINCIPAL') && (
        <Link
          to={`/dashboard/${displayUser.role.toLowerCase()}/wallet`}
          className="group flex items-center gap-4 rounded-2xl border border-rule bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/40"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warn-wash text-warn">
            <Wallet className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold text-ink">My Wallet</p>
            <p className="text-sm text-ink-muted">View balance, credits and transactions</p>
          </div>
          <ArrowRight className="h-5 w-5 text-ink-faint transition-colors group-hover:text-accent" />
        </Link>
      )}

      {/* Tab navigation */}
      <Tabs
        tabs={tabs.map(({ key, label, icon: Icon }) => ({ key, label, icon: <Icon className="h-4 w-4" /> }))}
        activeTab={tab}
        onChange={(key) => setTab(key as Tab)}
      />

      {/* Account tab */}
      {tab === 'account' && (
        <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
          {profileFeedback && <div className="mb-5"><Toast {...profileFeedback} /></div>}
          <form onSubmit={profileForm.handleSubmit((d) => updateProfile(d))} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First Name" error={profileForm.formState.errors.firstName?.message}>
                <Controller
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <TextInput icon={User} placeholder="First name" {...field} />
                  )}
                />
              </Field>
              <Field label="Last Name" error={profileForm.formState.errors.lastName?.message}>
                <Controller
                  control={profileForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <TextInput icon={User} placeholder="Last name" {...field} />
                  )}
                />
              </Field>
              <Field label="Email" hint="Email cannot be changed">
                <TextInput icon={Mail} value={displayUser.email} readOnly />
              </Field>
              <Field label="Phone">
                <Controller
                  control={profileForm.control}
                  name="phone"
                  render={({ field }) => (
                    <TextInput icon={Phone} placeholder="+91 9876543210" {...field} />
                  )}
                />
              </Field>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-info/25 bg-info-wash px-4 py-3">
              <Globe className="h-4 w-4 text-info shrink-0" />
              <div className="text-sm">
                <span className="font-semibold text-ink-2">{userTimezone}</span>
                <span className="ml-1.5 text-ink-muted">
                  (UTC{formatInTimeZone(new Date(), userTimezone, 'xxx')})
                </span>
                <p className="text-xs text-ink-muted mt-0.5">
                  Auto-detected from your device class times display in this timezone
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <SaveButton pending={savingProfile} />
            </div>
          </form>
        </div>
      )}

      {/* Teaching profile tab (tutor only) */}
      {tab === 'teaching' && isTutor && (
        <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
          {tutorFeedback && <div className="mb-5"><Toast {...tutorFeedback} /></div>}
          <form onSubmit={tutorForm.handleSubmit((d) => updateTutorProfile(d))} className="space-y-6">

            <Field label="About You">
              <textarea
                {...tutorForm.register('bio')}
                rows={3}
                placeholder="Tell students about your teaching style, experience and background…"
                className="w-full rounded-xl border border-rule-strong bg-surface px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent"
              />
            </Field>

            <Controller
              control={tutorForm.control}
              name="subjects"
              render={({ field }) => (
                <TagInput
                  label="Subjects you teach"
                  value={field.value}
                  onChange={field.onChange}
                  suggestions={SUBJECT_OPTIONS}
                  placeholder="Type a subject and press Enter"
                  hint="Type anything — spelling is standardised when you save, so 'maths' and 'Mathematics' become one subject."
                />
              )}
            />

            <Controller
              control={tutorForm.control}
              name="languages"
              render={({ field }) => (
                <TagInput
                  label="Languages you teach in"
                  value={field.value}
                  onChange={field.onChange}
                  suggestions={LANGUAGE_OPTIONS}
                  placeholder="Type a language and press Enter"
                />
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hourly Rate ($)" error={tutorForm.formState.errors.hourlyRateUSD?.message}>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    {...tutorForm.register('hourlyRateUSD', { valueAsNumber: true })}
                    type="number"
                    min={0}
                    placeholder="e.g. 50"
                    className="w-full rounded-xl border border-rule-strong bg-surface py-2.5 pl-10 pr-3.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent"
                  />
                </div>
              </Field>

              <Field label="Qualifications" hint="Separate multiple qualifications with commas">
                <Controller
                  control={tutorForm.control}
                  name="qualifications"
                  render={({ field }) => (
                    <TextInput
                      icon={BookOpen}
                      placeholder="e.g. B.Sc Mathematics, M.Sc Physics"
                      {...field}
                    />
                  )}
                />
              </Field>
            </div>

            <div className="flex justify-end pt-1">
              <SaveButton pending={savingTutor} label="Save teaching profile" />
            </div>
          </form>
        </div>
      )}

      {/* Security tab */}
      {tab === 'security' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-wash">
                <Lock className="h-4 w-4 text-danger" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-ink">Change Password</h3>
                <p className="text-xs text-ink-muted">All active sessions will be signed out after change</p>
              </div>
            </div>

            {passwordFeedback && <div className="mb-5"><Toast {...passwordFeedback} /></div>}
            <form onSubmit={passwordForm.handleSubmit((d) => changePassword(d))} className="space-y-4">
              <Field label="Current Password" error={passwordForm.formState.errors.currentPassword?.message}>
                <PasswordInput
                  show={showCurrent}
                  onToggle={() => setShowCurrent((v) => !v)}
                  placeholder="Your current password"
                  {...passwordForm.register('currentPassword')}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New Password" error={passwordForm.formState.errors.newPassword?.message}>
                  <PasswordInput
                    show={showNew}
                    onToggle={() => setShowNew((v) => !v)}
                    placeholder="Min 8 characters"
                    {...passwordForm.register('newPassword')}
                  />
                </Field>
                <Field label="Confirm Password" error={passwordForm.formState.errors.confirmPassword?.message}>
                  <PasswordInput
                    show={showConfirm}
                    onToggle={() => setShowConfirm((v) => !v)}
                    placeholder="Repeat new password"
                    {...passwordForm.register('confirmPassword')}
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <SaveButton pending={savingPassword} label="Update password" />
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-wash">
                <ShieldCheck className="h-4 w-4 text-accent" />
              </span>
              <h3 className="text-base font-semibold text-ink">Account Details</h3>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Status',  value: user.status.replace(/_/g, ' '), bg: 'bg-ok-wash', text: 'text-ok' },
                { label: 'Role',    value: roleLabel, bg: 'bg-accent-wash', text: 'text-accent' },
                { label: 'Created', value: new Date(user.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }), bg: 'bg-warn-wash', text: 'text-warn' },
              ].map(({ label, value, bg, text }) => (
                <div key={label} className={`rounded-xl ${bg} px-4 py-3`}>
                  <dt className="eyebrow mb-0.5">{label}</dt>
                  <dd className={`truncate text-sm font-semibold ${text}`}>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <CopyChip label="Account ID" value={user.publicId} />
              {isStudent && displayUser?.studentId && (
                <CopyChip label="Student ID" value={displayUser.studentId} />
              )}
              {isStudent && studentProfile?.publicId && (
                <CopyChip label="Profile ID" value={studentProfile.publicId} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
