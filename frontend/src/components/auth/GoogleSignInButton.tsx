import { GoogleLogin } from '@react-oauth/google';
import { useGoogleLogin } from '../../hooks/use-auth';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

/**
 * "Continue with Google" — renders the official Google Identity button.
 * On success it exchanges the returned ID token for our own session.
 * Renders nothing when VITE_GOOGLE_CLIENT_ID is not configured.
 */
export function GoogleSignInButton({ text = 'signin_with' }: { text?: 'signin_with' | 'signup_with' | 'continue_with' }) {
  const googleLogin = useGoogleLogin();

  if (!CLIENT_ID) return null;

  const serverError =
    googleLogin.isError && googleLogin.error instanceof Error
      ? (googleLogin.error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        'Google sign-in failed'
      : null;

  return (
    <div className="space-y-2">
      <div className="flex justify-center">
        <GoogleLogin
          text={text}
          width="320"
          logo_alignment="center"
          onSuccess={(cred) => {
            if (cred.credential) googleLogin.mutate(cred.credential);
          }}
          onError={() => {
            // GoogleLogin handles its own UI; nothing to surface here.
          }}
        />
      </div>
      {serverError && (
        <p className="text-center text-xs font-medium text-rose-600">{serverError}</p>
      )}
    </div>
  );
}
