import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { authService } from '../../services/auth.service';

type State = 'verifying' | 'success' | 'error' | 'missing';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<State>(token ? 'verifying' : 'missing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) return;

    authService.verifyEmail(token)
      .then(() => setState('success'))
      .catch((err) => {
        const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
          ?? 'This verification link is invalid or has expired.';
        setErrorMsg(msg);
        setState('error');
      });
  }, [token]);

  if (state === 'verifying') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Verifying your email…</p>
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
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Email verified!</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Your email address has been verified. You can now sign in.
          </p>
        </div>
        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors"
        >
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
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Verification failed</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{errorMsg}</p>
        </div>
        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100">
        <Mail className="h-9 w-9 text-amber-600" />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Check your inbox</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          We sent a verification link to your email address. Click it to activate your account.
        </p>
      </div>
      <Link
        to="/login"
        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors"
      >
        Back to Login
      </Link>
    </div>
  );
}
