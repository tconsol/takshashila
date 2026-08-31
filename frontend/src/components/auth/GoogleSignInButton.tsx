import { useState } from 'react';
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
 * "Continue with Google" — implicit popup flow. Returns an access_token that the
 * server verifies (audience-checked) and exchanges for our own session.
 * Instrumented so the failing step is visible in the console + on screen.
 */
export function GoogleSignInButton({ label = 'Continue with Google' }: { label?: string }) {
  const googleAuth = useGoogleAuth();
  const [localError, setLocalError] = useState<string | null>(null);

  const login = useGoogleLogin({
    // MUST request email + profile, else the access token carries no email and the
    // server can't identify the user.
    scope: 'openid email profile',
    onSuccess: (resp) => {
      console.info('[google] popup success, got access_token:', !!resp.access_token);
      setLocalError(null);
      if (resp.access_token) {
        googleAuth.mutate({ accessToken: resp.access_token });
      } else {
        setLocalError('Google did not return an access token.');
      }
    },
    onError: (err) => {
      console.error('[google] OAuth error', err);
      setLocalError(err?.error_description || err?.error || 'Google sign-in was cancelled or failed.');
    },
    // Popup blocked / failed to open / unexpected — the callback the SDK uses when
    // the failure isn't a normal OAuth error (very common cause: popup blocker).
    onNonOAuthError: (err) => {
      console.error('[google] non-OAuth error', err);
      setLocalError(
        err?.type === 'popup_failed_to_open'
          ? 'Popup was blocked. Allow popups for this site and try again.'
          : err?.type === 'popup_closed'
          ? 'Popup closed before finishing.'
          : 'Google sign-in could not start.',
      );
    },
  });

  if (!CLIENT_ID) {
    // Surface the misconfiguration instead of silently rendering nothing.
    return (
      <p className="text-center text-xs font-medium text-amber-600">
        Google sign-in unavailable: VITE_GOOGLE_CLIENT_ID is not set.
      </p>
    );
  }

  const serverError =
    googleAuth.isError && googleAuth.error instanceof Error
      ? (googleAuth.error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        'Google sign-in failed on the server.'
      : null;

  const error = serverError || localError;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => { setLocalError(null); login(); }}
        disabled={googleAuth.isPending}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:shadow-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <GoogleGlyph />
        {googleAuth.isPending ? 'Signing in…' : label}
      </button>
      {error && <p className="text-center text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
