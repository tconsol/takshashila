import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { authService } from '../../services/auth.service';

type State = 'verifying' | 'success' | 'error' | 'missing';

const PRIMARY_BTN = 'inline-flex items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-clay-green px-6 py-3 text-sm font-extrabold text-white shadow-clay hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-clay-pressed transition-all';
const SECONDARY_BTN = 'inline-flex items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-white px-6 py-3 text-sm font-extrabold text-clay-ink shadow-clay-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-clay-pressed transition-all';

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
        <Loader2 className="h-10 w-10 animate-spin text-clay-green-dark" />
        <p className="font-semibold text-clay-ink dark:text-gray-400">Verifying your email…</p>
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
          <h2 className="text-3xl font-extrabold text-clay-ink dark:text-white">Email verified!</h2>
          <p className="mt-2 text-sm font-semibold text-clay-ink/60 dark:text-gray-400">
            Your email address has been verified. You can now sign in.
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
          <h2 className="text-3xl font-extrabold text-clay-ink dark:text-white">Verification failed</h2>
          <p className="mt-2 text-sm font-semibold text-clay-ink/60 dark:text-gray-400">{errorMsg}</p>
        </div>
        <Link to="/login" className={SECONDARY_BTN}>Back to Login</Link>
      </div>
    );
  }

  // missing token
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-2.5 border-clay-ink bg-clay-yellow shadow-clay">
        <Mail className="h-9 w-9 text-clay-ink" />
      </div>
      <div>
        <h2 className="text-3xl font-extrabold text-clay-ink dark:text-white">Check your inbox</h2>
        <p className="mt-2 text-sm font-semibold text-clay-ink/60 dark:text-gray-400">
          We sent a verification link to your email address. Click it to activate your account.
        </p>
      </div>
      <Link to="/login" className={SECONDARY_BTN}>Back to Login</Link>
    </div>
  );
}
