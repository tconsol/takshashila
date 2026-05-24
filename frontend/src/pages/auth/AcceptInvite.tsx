import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { api } from '../../lib/axios';

type State = 'form' | 'loading' | 'success' | 'error';

const PRIMARY_BTN = 'inline-flex items-center justify-center gap-2 rounded-2xl border-2.5 border-clay-ink bg-clay-green px-6 py-3 text-sm font-extrabold text-white shadow-clay hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-clay-pressed transition-all';
const SECONDARY_BTN = 'inline-flex items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-white px-6 py-3 text-sm font-extrabold text-clay-ink shadow-clay-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-clay-pressed transition-all';

const READONLY_INPUT = 'w-full rounded-2xl border-2.5 border-clay-ink/40 bg-clay-bg px-4 py-3 text-sm font-semibold text-clay-ink/60 dark:bg-gray-800';
const ACTIVE_INPUT = 'w-full rounded-2xl border-2.5 bg-white px-4 py-3 text-sm font-semibold text-clay-ink placeholder:text-gray-400 shadow-clay-sm focus:outline-none focus:bg-clay-bg/50 focus:shadow-clay transition-colors dark:bg-gray-900 dark:text-white';

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
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-2.5 border-clay-ink bg-clay-coral shadow-clay">
          <XCircle className="h-9 w-9 text-clay-ink" />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-clay-ink dark:text-white">Invalid invite link</h2>
          <p className="mt-2 text-sm font-semibold text-clay-ink/60 dark:text-gray-400">This invite link is missing or invalid.</p>
        </div>
        <Link to="/login" className={SECONDARY_BTN}>Go to Login</Link>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-2.5 border-clay-ink bg-clay-mint shadow-clay">
          <CheckCircle2 className="h-9 w-9 text-clay-ink" />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-clay-ink dark:text-white">Account activated!</h2>
          <p className="mt-2 text-sm font-semibold text-clay-ink/60 dark:text-gray-400">
            Your account has been set up successfully. You can now log in.
          </p>
        </div>
        <Link to="/login" className={PRIMARY_BTN}>Go to Login</Link>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-2.5 border-clay-ink bg-clay-coral shadow-clay">
          <XCircle className="h-9 w-9 text-clay-ink" />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-clay-ink dark:text-white">Activation failed</h2>
          <p className="mt-2 text-sm font-semibold text-clay-ink/60 dark:text-gray-400">{errorMsg}</p>
        </div>
        <Link to="/login" className={SECONDARY_BTN}>Back to Login</Link>
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
        <h2 className="text-3xl font-extrabold text-clay-ink dark:text-white">Accept your invitation</h2>
        <p className="mt-2 text-sm font-semibold text-clay-ink/60 dark:text-gray-400">Set a password to activate your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {(firstName || lastName) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-extrabold text-clay-ink dark:text-gray-300 mb-2">First Name</label>
              <input readOnly value={firstName} className={READONLY_INPUT} />
            </div>
            <div>
              <label className="block text-sm font-extrabold text-clay-ink dark:text-gray-300 mb-2">Last Name</label>
              <input readOnly value={lastName} className={READONLY_INPUT} />
            </div>
          </div>
        )}
        {email && (
          <div>
            <label className="block text-sm font-extrabold text-clay-ink dark:text-gray-300 mb-2">Email</label>
            <input readOnly value={email} className={READONLY_INPUT} />
          </div>
        )}

        <div>
          <label className="block text-sm font-extrabold text-clay-ink dark:text-gray-300 mb-2">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 chars, upper, lower, number, special"
            className={`${ACTIVE_INPUT} border-clay-ink`}
          />
        </div>

        <div>
          <label className="block text-sm font-extrabold text-clay-ink dark:text-gray-300 mb-2">Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            className={`${ACTIVE_INPUT} ${passwordMismatch ? 'border-rose-500' : 'border-clay-ink'}`}
          />
          {passwordMismatch && (
            <p className="mt-1 text-xs font-bold text-rose-600">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={`${PRIMARY_BTN} w-full disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {state === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
          Activate Account
        </button>
      </form>
    </div>
  );
}
