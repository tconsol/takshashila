import { useState, forwardRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  User, Mail, Phone, Globe, ShieldCheck, Camera,
  CheckCircle2, AlertCircle, Lock, Eye, EyeOff,
  BookOpen, DollarSign, Sparkles, GraduationCap, Calendar,
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/auth.store';

// ─── Constants ────────────────────────────────────────────────────────────────
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

const ROLE_TINT: Record<string, string> = {
  SUPER_ADMIN: 'bg-clay-coral',
  ADMIN:       'bg-clay-yellow',
  PRINCIPAL:   'bg-clay-sky',
  TUTOR:       'bg-clay-purple',
  STUDENT:     'bg-clay-mint',
  SUPPORT:     'bg-clay-pink',
};

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-clay-coral  text-clay-ink border-2 border-clay-ink',
  ADMIN:       'bg-clay-yellow text-clay-ink border-2 border-clay-ink',
  PRINCIPAL:   'bg-clay-sky    text-clay-ink border-2 border-clay-ink',
  TUTOR:       'bg-clay-purple text-clay-ink border-2 border-clay-ink',
  STUDENT:     'bg-clay-mint   text-clay-ink border-2 border-clay-ink',
  SUPPORT:     'bg-clay-pink   text-clay-ink border-2 border-clay-ink',
};

// ─── Schemas ──────────────────────────────────────────────────────────────────
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

// ─── Small helpers ────────────────────────────────────────────────────────────
function Toast({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border-2.5 border-clay-ink px-4 py-3 text-sm font-extrabold text-clay-ink shadow-clay-sm ${
      type === 'success' ? 'bg-clay-mint' : 'bg-clay-coral'
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
      <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-clay-ink/70 dark:text-gray-400">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] font-semibold text-clay-ink/50">{hint}</p>}
      {error && <p className="mt-1 text-xs font-bold text-rose-600">{error}</p>}
    </div>
  );
}

function TextInput({ icon: Icon, readOnly, ...props }: {
  icon?: React.ElementType; readOnly?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-ink" />}
      <input
        {...props}
        readOnly={readOnly}
        className={`w-full rounded-2xl border-2.5 py-3 text-sm font-semibold transition-all ${
          Icon ? 'pl-10' : 'pl-4'
        } pr-4 ${
          readOnly
            ? 'cursor-not-allowed border-clay-ink/40 bg-clay-bg text-clay-ink/50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500'
            : 'border-clay-ink bg-white text-clay-ink shadow-clay-sm focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-clay-pressed dark:bg-gray-900 dark:text-white'
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
      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-ink" />
      <input
        {...rest}
        ref={ref}
        type={show ? 'text' : 'password'}
        className="w-full rounded-2xl border-2.5 border-clay-ink bg-white py-3 pl-10 pr-10 text-sm font-semibold text-clay-ink shadow-clay-sm transition-all focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-clay-pressed dark:bg-gray-900 dark:text-white"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-clay-ink hover:text-clay-green-dark"
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
      className="inline-flex items-center gap-2 rounded-2xl border-2.5 border-clay-ink bg-clay-green px-6 py-3 text-sm font-extrabold text-white shadow-clay transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-clay-pressed disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending
        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        : <CheckCircle2 className="h-4 w-4" />}
      {pending ? 'Saving…' : label}
    </button>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = 'account' | 'teaching' | 'security';

// ─── Main page ────────────────────────────────────────────────────────────────
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

  const isTutor = user?.role === 'TUTOR';

  // Fetch fresh user data from server — used for hero card and timezone display
  const { data: freshUser } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => api.get('/users/me').then((r) => r.data.data),
  });

  // Sync fresh user into auth store so other parts of the app stay current
  useEffect(() => {
    if (freshUser && user) setUser({ ...user, ...freshUser });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshUser]);

  const activeUser = freshUser ?? user;
  const userTimezone = activeUser?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  // ── Account form ──
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: '', lastName: '', phone: '' },
  });

  // Populate fields as soon as server data arrives
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

  // ── Tutor profile form ──
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

  // ── Password form ──
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
  const roleTint = ROLE_TINT[user.role] ?? 'bg-clay-mint';
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  // Tutor profile completion
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

      {/* ── Hero card ── */}
      <div className="relative overflow-hidden rounded-[28px] border-2.5 border-clay-ink bg-white shadow-clay dark:bg-gray-900">
        {/* color strip */}
        <div className={`relative h-24 w-full ${roleTint} border-b-2.5 border-clay-ink overflow-hidden`}>
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-2xl border-2.5 border-clay-ink bg-white/30 rotate-12" />
          <div className="absolute right-12 -bottom-3 h-10 w-10 rounded-full border-2.5 border-clay-ink bg-white/30" />
        </div>

        <div className="px-6 pb-6">
          {/* avatar pulled up over the strip */}
          <div className="relative -mt-12 mb-4 flex items-end justify-between">
            <div className="relative">
              <div className={`flex h-24 w-24 items-center justify-center rounded-2xl border-2.5 border-clay-ink ${roleTint} text-3xl font-black text-clay-ink shadow-clay`}>
                {displayUser.avatarUrl
                  ? <img src={displayUser.avatarUrl} alt={initials} className="h-full w-full rounded-2xl object-cover" />
                  : initials}
              </div>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-clay-ink bg-clay-yellow hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              >
                <Camera className="h-3.5 w-3.5 text-clay-ink" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${ROLE_BADGE[user.role] ?? ''}`}>
                {roleLabel}
              </span>
              {displayUser.emailVerified
                ? <span className="flex items-center gap-1 rounded-full border-2 border-clay-ink bg-clay-mint px-3 py-1 text-xs font-extrabold text-clay-ink">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </span>
                : <span className="flex items-center gap-1 rounded-full border-2 border-clay-ink bg-clay-yellow px-3 py-1 text-xs font-extrabold text-clay-ink">
                    <AlertCircle className="h-3 w-3" /> Unverified
                  </span>}
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-clay-ink dark:text-white">
            {displayUser.firstName} {displayUser.lastName}
          </h1>
          <p className="text-sm font-semibold text-clay-ink/60 dark:text-gray-400">{displayUser.email}</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-clay-ink bg-clay-bg px-3 py-1 text-xs font-extrabold text-clay-ink">
              <Calendar className="h-3 w-3" />
              Member since {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </span>
            {user.lastLoginAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-clay-ink bg-clay-bg px-3 py-1 text-xs font-extrabold text-clay-ink">
                <CheckCircle2 className="h-3 w-3" />
                Last login {new Date(user.lastLoginAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          {/* Tutor profile completion bar */}
          {isTutor && tutorCompletion !== null && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-extrabold text-clay-ink dark:text-gray-300">
                  <Sparkles className="h-3.5 w-3.5 text-clay-green-dark" />
                  Teaching profile {tutorCompletion}% complete
                </span>
                {tutorCompletion < 100 && (
                  <button
                    type="button"
                    onClick={() => setTab('teaching')}
                    className="font-extrabold text-clay-green-dark hover:text-clay-green"
                  >
                    Complete now →
                  </button>
                )}
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full border-2 border-clay-ink bg-white">
                <div
                  className="h-full bg-clay-green transition-all duration-500"
                  style={{ width: `${tutorCompletion}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div className="flex gap-1.5 p-1.5 bg-white border-2.5 border-clay-ink rounded-2xl w-fit shadow-clay-sm">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
              tab === key
                ? 'bg-clay-green text-white border-2 border-clay-ink'
                : 'text-clay-ink/60 hover:text-clay-ink hover:bg-clay-bg'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Account tab ── */}
      {tab === 'account' && (
        <div className="rounded-[28px] border-2.5 border-clay-ink bg-white p-6 shadow-clay dark:bg-gray-900">
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

            {/* Timezone — read-only, auto-detected */}
            <div className="flex items-center gap-2.5 rounded-2xl border-2.5 border-clay-ink bg-clay-sky px-4 py-3">
              <Globe className="h-4 w-4 text-clay-ink shrink-0" />
              <div className="text-sm">
                <span className="font-extrabold text-clay-ink">{userTimezone}</span>
                <span className="ml-1.5 font-bold text-clay-ink/70">
                  (UTC{formatInTimeZone(new Date(), userTimezone, 'xxx')})
                </span>
                <p className="text-xs font-semibold text-clay-ink/60 mt-0.5">
                  Auto-detected from your device — class times display in this timezone
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <SaveButton pending={savingProfile} />
            </div>
          </form>
        </div>
      )}

      {/* ── Teaching profile tab (tutor only) ── */}
      {tab === 'teaching' && isTutor && (
        <div className="rounded-[28px] border-2.5 border-clay-ink bg-white p-6 shadow-clay dark:bg-gray-900">
          {tutorFeedback && <div className="mb-5"><Toast {...tutorFeedback} /></div>}
          <form onSubmit={tutorForm.handleSubmit((d) => updateTutorProfile(d))} className="space-y-6">

            {/* Bio */}
            <Field label="About You">
              <textarea
                {...tutorForm.register('bio')}
                rows={3}
                placeholder="Tell students about your teaching style, experience and background…"
                className="w-full rounded-2xl border-2.5 border-clay-ink bg-white px-4 py-3 text-sm font-semibold text-clay-ink shadow-clay-sm transition-all focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-clay-pressed dark:bg-gray-900 dark:text-white"
              />
            </Field>

            {/* Subjects */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Subjects you teach
              </p>
              <Controller
                control={tutorForm.control}
                name="subjects"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {SUBJECT_OPTIONS.map((s) => {
                      const active = field.value.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => field.onChange(
                            active ? field.value.filter((v) => v !== s) : [...field.value, s],
                          )}
                          className={`rounded-full border-2 border-clay-ink px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                            active
                              ? 'bg-clay-green text-white'
                              : 'bg-white text-clay-ink hover:bg-clay-bg'
                          }`}
                        >
                          {active && <span className="mr-1">✓</span>}{s}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>

            {/* Languages */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Languages you teach in
              </p>
              <Controller
                control={tutorForm.control}
                name="languages"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGE_OPTIONS.map((l) => {
                      const active = field.value.includes(l);
                      return (
                        <button
                          key={l}
                          type="button"
                          onClick={() => field.onChange(
                            active ? field.value.filter((v) => v !== l) : [...field.value, l],
                          )}
                          className={`rounded-full border-2 border-clay-ink px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                            active
                              ? 'bg-clay-purple text-clay-ink'
                              : 'bg-white text-clay-ink hover:bg-clay-bg'
                          }`}
                        >
                          {active && <span className="mr-1">✓</span>}{l}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hourly Rate ($)" error={tutorForm.formState.errors.hourlyRateUSD?.message}>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    {...tutorForm.register('hourlyRateUSD', { valueAsNumber: true })}
                    type="number"
                    min={0}
                    placeholder="e.g. 50"
                    className="w-full rounded-2xl border-2.5 border-clay-ink bg-white py-3 pl-10 pr-4 text-sm font-semibold text-clay-ink shadow-clay-sm transition-all focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-clay-pressed dark:bg-gray-900 dark:text-white"
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

      {/* ── Security tab ── */}
      {tab === 'security' && (
        <div className="space-y-4">
          <div className="rounded-[28px] border-2.5 border-clay-ink bg-white p-6 shadow-clay dark:bg-gray-900">
            <div className="mb-5 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2.5 border-clay-ink bg-clay-coral">
                <Lock className="h-4 w-4 text-clay-ink" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-clay-ink dark:text-white">Change Password</h3>
                <p className="text-xs font-semibold text-clay-ink/60">All active sessions will be signed out after change</p>
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

          {/* Account details */}
          <div className="rounded-[28px] border-2.5 border-clay-ink bg-white p-6 shadow-clay dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2.5 border-clay-ink bg-clay-mint">
                <ShieldCheck className="h-4 w-4 text-clay-ink" />
              </span>
              <h3 className="text-base font-extrabold text-clay-ink dark:text-white">Account Details</h3>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Account ID', value: user.publicId, tint: 'bg-clay-bg' },
                { label: 'Status',     value: user.status.replace(/_/g, ' '), tint: 'bg-clay-mint' },
                { label: 'Role',       value: roleLabel, tint: 'bg-clay-sky' },
                { label: 'Created',    value: new Date(user.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }), tint: 'bg-clay-yellow' },
              ].map(({ label, value, tint }) => (
                <div key={label} className={`rounded-2xl border-2 border-clay-ink ${tint} px-4 py-3`}>
                  <dt className="mb-0.5 text-[11px] font-extrabold uppercase tracking-wide text-clay-ink/60">{label}</dt>
                  <dd className="truncate text-sm font-extrabold text-clay-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
