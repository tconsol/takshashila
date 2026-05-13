import { useState, forwardRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Mail, Phone, Globe, ShieldCheck, Camera,
  CheckCircle2, AlertCircle, Lock, Eye, EyeOff, Edit3,
} from 'lucide-react';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/auth.store';
import { PageHeader } from '../../components/shared/PageHeader';
import { Select } from '../../components/ui/Select';
import { TIMEZONE_OPTIONS } from '../../constants/timezones';

// ─── Role display helpers ─────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  PRINCIPAL: 'Principal',
  TUTOR: 'Tutor',
  STUDENT: 'Student',
  SUPPORT: 'Support',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ADMIN: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  PRINCIPAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TUTOR: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  STUDENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  SUPPORT: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
};

const AVATAR_GRADIENTS: Record<string, string> = {
  SUPER_ADMIN: 'from-red-500 to-orange-500',
  ADMIN: 'from-orange-500 to-amber-500',
  PRINCIPAL: 'from-blue-500 to-sky-500',
  TUTOR: 'from-violet-500 to-brand-500',
  STUDENT: 'from-emerald-500 to-teal-500',
  SUPPORT: 'from-sky-500 to-cyan-500',
};


// ─── Schemas ─────────────────────────────────────────────────────────────────
const profileSchema = z.object({
  firstName: z.string().min(1, 'First name required').max(50),
  lastName:  z.string().min(1, 'Last name required').max(50),
  phone:     z.string().optional(),
  timezone:  z.string().min(1, 'Timezone required'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword:     z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

// ─── Feedback banner ─────────────────────────────────────────────────────────
function Feedback({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
      type === 'success'
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    }`}>
      {type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      {message}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-5 flex items-center gap-2.5 border-b border-gray-100 pb-4 dark:border-gray-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20">
          <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        </span>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Password visibility toggle field ────────────────────────────────────────
const PasswordField = forwardRef<HTMLInputElement, {
  label: string; error?: string; showPwd: boolean; onToggle: () => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ label, error, showPwd, onToggle, ...rest }, ref) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          {...rest}
          ref={ref}
          type={showPwd ? 'text' : 'password'}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:focus:bg-gray-800"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  ),
);
PasswordField.displayName = 'PasswordField';

// ─── Main page ────────────────────────────────────────────────────────────────
export function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName:  user?.lastName  ?? '',
      phone:     user?.phone     ?? '',
      timezone:  user?.timezone  ?? 'Asia/Kolkata',
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const { mutateAsync: updateProfile, isPending: savingProfile } = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/users/me', data).then((r) => r.data.data),
    onSuccess: (updated) => {
      if (updated && user) setUser({ ...user, ...updated });
      setProfileFeedback({ type: 'success', message: 'Profile updated successfully!' });
      setTimeout(() => setProfileFeedback(null), 4000);
    },
    onError: (e: Error) => {
      setProfileFeedback({ type: 'error', message: e.message || 'Failed to update profile' });
    },
  });

  const { mutateAsync: changePassword, isPending: savingPassword } = useMutation({
    mutationFn: (data: PasswordForm) =>
      api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    onSuccess: () => {
      setPasswordFeedback({ type: 'success', message: 'Password changed successfully!' });
      passwordForm.reset();
      setTimeout(() => setPasswordFeedback(null), 4000);
    },
    onError: (e: Error) => {
      setPasswordFeedback({ type: 'error', message: e.message || 'Failed to change password' });
    },
  });

  if (!user) return null;

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const gradient = AVATAR_GRADIENTS[user.role] ?? 'from-brand-500 to-violet-500';
  const roleColor = ROLE_COLORS[user.role] ?? '';
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="My Profile" subtitle="Manage your personal details and account settings" icon={<User className="h-5 w-5" />} />

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-brand-600/20 via-violet-500/15 to-pink-500/10" />
        <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          {/* Avatar */}
          <div className="relative mt-4 sm:mt-0">
            <div className={`flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-2xl font-bold text-white shadow-lg ring-4 ring-white dark:ring-gray-900`}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} className="h-full w-full rounded-2xl object-cover" />
              ) : initials}
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-brand-600 text-white shadow dark:border-gray-900">
              <Camera className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Identity */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleColor}`}>
                {roleLabel}
              </span>
              {user.emailVerified ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" /> Unverified
                </span>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-xs text-gray-400">Member since</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Last login</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Personal info form */}
      <SectionCard title="Personal Information" icon={Edit3}>
        {profileFeedback && <div className="mb-4"><Feedback {...profileFeedback} /></div>}
        <form
          onSubmit={profileForm.handleSubmit((data) => updateProfile(data))}
          className="grid gap-4 sm:grid-cols-2"
        >
          {/* First name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">First name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                {...profileForm.register('firstName')}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:focus:bg-gray-800"
              />
            </div>
            {profileForm.formState.errors.firstName && (
              <p className="mt-1 text-xs text-red-500">{profileForm.formState.errors.firstName.message}</p>
            )}
          </div>

          {/* Last name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Last name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                {...profileForm.register('lastName')}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:focus:bg-gray-800"
              />
            </div>
            {profileForm.formState.errors.lastName && (
              <p className="mt-1 text-xs text-red-500">{profileForm.formState.errors.lastName.message}</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={user.email}
                readOnly
                className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 py-2.5 pl-10 pr-3 text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Email cannot be changed</p>
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                {...profileForm.register('phone')}
                placeholder="+91 9876543210"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:focus:bg-gray-800"
              />
            </div>
          </div>

          {/* Timezone */}
          <div className="sm:col-span-2">
            <Select
              label="Timezone"
              options={TIMEZONE_OPTIONS}
              placeholder="Select timezone"
              leftIcon={<Globe className="h-4 w-4" />}
              {...profileForm.register('timezone')}
            />
          </div>

          <div className="flex justify-end sm:col-span-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60"
            >
              {savingProfile ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : <CheckCircle2 className="h-4 w-4" />}
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* Change password */}
      <SectionCard title="Change Password" icon={ShieldCheck}>
        {passwordFeedback && <div className="mb-4"><Feedback {...passwordFeedback} /></div>}
        <form
          onSubmit={passwordForm.handleSubmit((data) => changePassword(data))}
          className="space-y-4"
        >
          <PasswordField
            label="Current password"
            showPwd={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            error={passwordForm.formState.errors.currentPassword?.message}
            {...passwordForm.register('currentPassword')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              label="New password"
              showPwd={showNew}
              onToggle={() => setShowNew((v) => !v)}
              error={passwordForm.formState.errors.newPassword?.message}
              {...passwordForm.register('newPassword')}
            />
            <PasswordField
              label="Confirm new password"
              showPwd={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              error={passwordForm.formState.errors.confirmPassword?.message}
              {...passwordForm.register('confirmPassword')}
            />
          </div>
          <p className="text-xs text-gray-400">Minimum 8 characters. All active sessions will be logged out after change.</p>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500/50 disabled:opacity-60 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              {savingPassword ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : <Lock className="h-4 w-4" />}
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* Account info */}
      <SectionCard title="Account Details" icon={ShieldCheck}>
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'Account ID', value: user.publicId },
            { label: 'Account status', value: user.status.replace('_', ' ') },
            { label: 'Role', value: roleLabel },
            { label: 'Created', value: new Date(user.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
              <dt className="text-xs font-medium text-gray-400">{label}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>
    </div>
  );
}
