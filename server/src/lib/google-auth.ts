import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { AppError } from '../utils/error';

// All configured Google client ids are accepted as valid audiences, so one
// endpoint serves web + Android + iOS sign-in (each platform gets its own id).
function allowedAudiences(): string[] {
  return [
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_ANDROID_CLIENT_ID,
    env.GOOGLE_IOS_CLIENT_ID,
  ].filter((v): v is string => !!v);
}

export function isGoogleAuthConfigured(): boolean {
  return allowedAudiences().length > 0;
}

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  picture?: string;
}

const client = new OAuth2Client();

/**
 * Verify a Google ID token (from web or native Sign-in) and return the identity.
 * Throws AppError(401) on any invalid/expired/untrusted token.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const audience = allowedAudiences();
  if (audience.length === 0) {
    throw new AppError('Google sign-in is not configured on the server', 503);
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience });
    payload = ticket.getPayload();
  } catch {
    throw new AppError('Invalid Google token', 401);
  }

  if (!payload || !payload.email) {
    throw new AppError('Google token did not contain an email', 401);
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    firstName: payload.given_name ?? payload.name ?? 'User',
    lastName: payload.family_name ?? '',
    picture: payload.picture,
  };
}
