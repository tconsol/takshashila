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
        <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
        <p className="text-gray-600 dark:text-gray-400">Verifying your email…</p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Email verified!</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Your email address has been verified. You can now sign in.
          </p>
        </div>
        <Link to="/login" className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors">
          Go to Login
        </Link>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <XCircle className="h-8 w-8 text-red-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verification failed</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">{errorMsg}</p>
        </div>
        <Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">
          Back to Login
        </Link>
      </div>
    );
  }

  // missing token
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <Mail className="h-8 w-8 text-amber-600" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Check your inbox</h2>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          We sent a verification link to your email address. Click it to activate your account.
        </p>
      </div>
      <Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">
        Back to Login
      </Link>
    </div>
  );
}
