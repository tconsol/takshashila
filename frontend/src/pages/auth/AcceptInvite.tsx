import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Lock } from 'lucide-react';
import { api } from '../../lib/axios';

type State = 'form' | 'loading' | 'success' | 'error';

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';
  const firstName = searchParams.get('firstName') ?? '';
  const lastName = searchParams.get('lastName') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<State>('form');
  const [errorMsg, setErrorMsg] = useState('');

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-100">
          <XCircle className="h-9 w-9 text-rose-600" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Invalid invite link</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This invite link is missing or invalid.</p>
        </div>
        <Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors">
          Go to Login
        </Link>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-100">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Account activated!</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Your account has been set up successfully. You can now log in.
          </p>
        </div>
        <Link to="/login" className="inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors">
          Go to Login
        </Link>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-100">
          <XCircle className="h-9 w-9 text-rose-600" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Activation failed</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{errorMsg}</p>
        </div>
        <Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors">
          Back to Login
        </Link>
      </div>
    );
  }

  const passwordMismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 8 && password === confirm && state !== 'loading';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setState('loading');
    try {
      await api.post('/auth/accept-invite', { token, password });
      setState('success');
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? 'This invite link is invalid or has expired.';
      setErrorMsg(msg);
      setState('error');
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto py-8 space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Accept your invitation</h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Set a password to activate your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {(firstName || lastName) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">First Name</label>
              <input readOnly value={firstName} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Last Name</label>
              <input readOnly value={lastName} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500" />
            </div>
          </div>
        )}
        {email && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
            <input readOnly value={email} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500" />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">New Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 chars, upper, lower, number, special"
              className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:bg-slate-900 dark:text-white ${passwordMismatch ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-indigo-500 bg-white dark:border-slate-700'}`}
            />
          </div>
          {passwordMismatch && (
            <p className="mt-1 text-xs text-rose-600">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors"
        >
          {state === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
          Activate Account
        </button>
      </form>
    </div>
  );
}
