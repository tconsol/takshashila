import { useState, forwardRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  User, Mail, Phone, Globe, ShieldCheck, Camera,
  CheckCircle2, AlertCircle, Lock, Eye, EyeOff,
  BookOpen, IndianRupee, Sparkles, GraduationCap, Calendar,
} from 'lucide-react';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/auth.store';
import { Select } from '../../components/ui/Select';
import { TIMEZONE_OPTIONS } from '../../constants/timezones';

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

const ROLE_GRADIENTS: Record<string, string> = {
  SUPER_ADMIN: 'from-red-500 to-orange-500',
  ADMIN: 'from-orange-500 to-amber-500',
  PRINCIPAL: 'from-blue-500 to-sky-400',
  TUTOR: 'from-violet-600 to-indigo-500',
  STUDENT: 'from-emerald-500 to-teal-400',
  SUPPORT: 'from-sky-500 to-cyan-400',
};

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ADMIN: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  PRINCIPAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TUTOR: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  STUDENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  SUPPORT: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
};

// ─── Schemas ──────────────────────────────────────────────────────────────────
const profileSchema = z.object({
  firstName: z.string().min(1, 'Required').max(50),
  lastName: z.string().min(1, 'Required').max(50),
  phone: z.string().optional(),
  timezone: z.string().min(1, 'Timezone required'),
});

const tutorProfileSchema = z.object({
  bio: z.string().max(1000).optional(),
  subjects: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  hourlyRateINR: z.coerce.number().int().min(0, 'Rate cannot be negative').default(0),
  qualifications: z.string().optional(),
  timezone: z.string().min(1, 'Timezone required').default('Asia/Kolkata'),
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
    <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium ${
      type === 'success'
        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800/40'
        : 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800/40'
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
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function TextInput({ icon: Icon, readOnly, ...props }: {
  icon?: React.ElementType; readOnly?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />}
      <input
        {...props}
        readOnly={readOnly}
        className={`w-full rounded-xl border py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 ${
          Icon ? 'pl-10' : 'pl-3.5'
        } pr-3.5 ${
          readOnly
            ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500'
            : 'border-gray-200 bg-gray-50 text-gray-900 focus:border-brand-500 focus:bg-white focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:focus:bg-gray-800'
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
      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        {...rest}
        ref={ref}
        type={show ? 'text' : 'password'}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:focus:bg-gray-800"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 transition-all hover:from-brand-700 hover:to-violet-700 hover:shadow-brand-500/40 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-60"
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

  // ── Account form ──
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
      timezone: user?.timezone ?? 'Asia/Kolkata',
    },
  });

  const { mutateAsync: updateProfile, isPending: savingProfile } = useMutation({
    mutationFn: (d: ProfileForm) => api.patch('/users/me', d).then((r) => r.data.data),
    onSuccess: (updated) => {
      if (updated && user) setUser({ ...user, ...updated });
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
    defaultValues: { bio: '', subjects: [], languages: [], hourlyRateINR: 0, qualifications: '', timezone: 'Asia/Kolkata' },
    values: tutorData ? {
      bio: tutorData.bio ?? '',
      subjects: tutorData.subjects ?? [],
      languages: tutorData.languages ?? [],
      hourlyRateINR: Math.round((tutorData.hourlyRateCents ?? 0) / 100),
      qualifications: (tutorData.qualifications ?? []).join(', '),
      timezone: tutorData.timezone ?? 'Asia/Kolkata',
    } : undefined,
  });

  const { mutateAsync: updateTutorProfile, isPending: savingTutor } = useMutation({
    mutationFn: (d: TutorProfileForm) => api.put('/tutors/me', {
      bio: d.bio || undefined,
      subjects: d.subjects,
      languages: d.languages,
      hourlyRateCents: d.hourlyRateINR * 100,
      qualifications: d.qualifications ? d.qualifications.split(',').map((q) => q.trim()).filter(Boolean) : [],
      timezone: d.timezone,
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

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const gradient = ROLE_GRADIENTS[user.role] ?? 'from-brand-600 to-violet-600';
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
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-900 dark:ring-gray-800">
        {/* gradient strip */}
        <div className={`h-28 w-full bg-gradient-to-br ${gradient} opacity-90`} />

        <div className="px-6 pb-6">
          {/* avatar pulled up over the strip */}
          <div className="relative -mt-12 mb-4 flex items-end justify-between">
            <div className="relative">
              <div className={`flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-3xl font-bold text-white shadow-lg ring-4 ring-white dark:ring-gray-900`}>
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt={initials} className="h-full w-full rounded-2xl object-cover" />
                  : initials}
              </div>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-gray-200 transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:ring-gray-700 dark:hover:bg-gray-700"
              >
                <Camera className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ROLE_BADGE[user.role] ?? ''}`}>
                {roleLabel}
              </span>
              {user.emailVerified
                ? <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </span>
                : <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3" /> Unverified
                  </span>}
            </div>
          </div>

          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>

          <div className="mt-4 flex flex-wrap gap-5 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Member since {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </span>
            {user.lastLoginAt && (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Last login {new Date(user.lastLoginAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          {/* Tutor profile completion bar */}
          {isTutor && tutorCompletion !== null && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-gray-600 dark:text-gray-300">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  Teaching profile {tutorCompletion}% complete
                </span>
                {tutorCompletion < 100 && (
                  <button
                    type="button"
                    onClick={() => setTab('teaching')}
                    className="text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Complete now →
                  </button>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-500"
                  style={{ width: `${tutorCompletion}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div className="flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800/60">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Account tab ── */}
      {tab === 'account' && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-900 dark:ring-gray-800">
          {profileFeedback && <div className="mb-5"><Toast {...profileFeedback} /></div>}
          <form onSubmit={profileForm.handleSubmit((d) => updateProfile(d))} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First Name" error={profileForm.formState.errors.firstName?.message}>
                <TextInput
                  icon={User}
                  placeholder="First name"
                  {...profileForm.register('firstName')}
                />
              </Field>
              <Field label="Last Name" error={profileForm.formState.errors.lastName?.message}>
                <TextInput
                  icon={User}
                  placeholder="Last name"
                  {...profileForm.register('lastName')}
                />
              </Field>
              <Field label="Email" hint="Email cannot be changed">
                <TextInput icon={Mail} value={user.email} readOnly />
              </Field>
              <Field label="Phone">
                <TextInput
                  icon={Phone}
                  placeholder="+91 9876543210"
                  {...profileForm.register('phone')}
                />
              </Field>
            </div>

            <Field label="Timezone" error={profileForm.formState.errors.timezone?.message}
              hint="Used to display your local time across the platform">
              <Controller
                control={profileForm.control}
                name="timezone"
                render={({ field }) => (
                  <Select
                    options={TIMEZONE_OPTIONS}
                    placeholder="Select your timezone"
                    leftIcon={<Globe className="h-4 w-4" />}
                    name={field.name}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Field>

            <div className="flex justify-end pt-1">
              <SaveButton pending={savingProfile} />
            </div>
          </form>
        </div>
      )}

      {/* ── Teaching profile tab (tutor only) ── */}
      {tab === 'teaching' && isTutor && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-900 dark:ring-gray-800">
          {tutorFeedback && <div className="mb-5"><Toast {...tutorFeedback} /></div>}
          <form onSubmit={tutorForm.handleSubmit((d) => updateTutorProfile(d))} className="space-y-6">

            {/* Bio */}
            <Field label="About You">
              <textarea
                {...tutorForm.register('bio')}
                rows={3}
                placeholder="Tell students about your teaching style, experience and background…"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:focus:bg-gray-800"
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
                          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                            active
                              ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/30'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
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
                          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                            active
                              ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/30'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
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
              <Field label="Hourly Rate (₹)" error={tutorForm.formState.errors.hourlyRateINR?.message}>
                <div className="relative">
                  <IndianRupee className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    {...tutorForm.register('hourlyRateINR', { valueAsNumber: true })}
                    type="number"
                    min={0}
                    placeholder="e.g. 800"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3.5 text-sm text-gray-900 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:focus:bg-gray-800"
                  />
                </div>
              </Field>

              <Field label="Teaching Timezone" error={tutorForm.formState.errors.timezone?.message}>
                <Controller
                  control={tutorForm.control}
                  name="timezone"
                  render={({ field }) => (
                    <Select
                      options={TIMEZONE_OPTIONS}
                      placeholder="Select timezone"
                      leftIcon={<Globe className="h-4 w-4" />}
                      name={field.name}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </Field>
            </div>

            <Field label="Qualifications" hint="Separate multiple qualifications with commas">
              <TextInput
                icon={BookOpen}
                placeholder="e.g. B.Sc Mathematics, M.Sc Physics, CTET Certified"
                {...tutorForm.register('qualifications')}
              />
            </Field>

            <div className="flex justify-end pt-1">
              <SaveButton pending={savingTutor} label="Save teaching profile" />
            </div>
          </form>
        </div>
      )}

      {/* ── Security tab ── */}
      {tab === 'security' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-900 dark:ring-gray-800">
            <div className="mb-5 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/20">
                <Lock className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Change Password</h3>
                <p className="text-xs text-gray-500">All active sessions will be signed out after change</p>
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
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-900 dark:ring-gray-800">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/20">
                <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              </span>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Account Details</h3>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Account ID', value: user.publicId },
                { label: 'Status', value: user.status.replace(/_/g, ' ') },
                { label: 'Role', value: roleLabel },
                { label: 'Created', value: new Date(user.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
                  <dt className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</dt>
                  <dd className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
