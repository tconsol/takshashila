import { useGoogleLogin } from '@react-oauth/google';
import { useGoogleAuth } from '../../hooks/use-auth';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

/**
 * "Continue with Google" using the OAuth **auth-code popup** flow. This opens the
 * standard Google consent popup and returns an authorization code that our server
 * exchanges + verifies — avoiding the GSI One-Tap iframe (the blank
 * accounts.google.com/gsi/transform popup). Renders nothing when the client id
 * isn't configured.
 */
export function GoogleSignInButton({ label = 'Continue with Google' }: { label?: string }) {
  const googleAuth = useGoogleAuth();

  const login = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: (resp) => {
      if (resp.code) googleAuth.mutate({ code: resp.code });
    },
  });

  if (!CLIENT_ID) return null;

  const serverError =
    googleAuth.isError && googleAuth.error instanceof Error
      ? (googleAuth.error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        'Google sign-in failed'
      : null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => login()}
        disabled={googleAuth.isPending}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:shadow-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <GoogleGlyph />
        {googleAuth.isPending ? 'Signing in…' : label}
      </button>
      {serverError && <p className="text-center text-xs font-medium text-rose-600">{serverError}</p>}
    </div>
  );
}
