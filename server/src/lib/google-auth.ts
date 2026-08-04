import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { AppError } from '../utils/error';
import { logger } from './logger';

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
 * Exchange a Google authorization code (from the web auth-code popup flow) for an
 * ID token. Uses the special 'postmessage' redirect that @react-oauth/google's
 * popup flow expects. Requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
 */
export async function exchangeGoogleCode(code: string): Promise<string> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError('Google sign-in is not configured on the server', 503);
  }
  const oauth2 = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, 'postmessage');
  try {
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.id_token) throw new Error('no id_token in token response');
    return tokens.id_token;
  } catch (err) {
    logger.error('Google code exchange failed', { error: (err as Error).message });
    throw new AppError('Could not verify Google authorization code', 401);
  }
}

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
  } catch (err) {
    // Most common cause: the token's `aud` (the web client id used by the browser)
    // is not one of the configured GOOGLE_*_CLIENT_ID values on the server.
    logger.error('Google idToken verification failed', {
      error: (err as Error).message,
      configuredAudiences: audience,
    });
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

/**
 * Verify a Google OAuth **access token** (from the web implicit popup flow) and
 * return the identity. Security: the token's audience (`aud`) MUST be one of our
 * configured client ids, so a token minted for another app is rejected. Profile
 * name/picture are fetched best-effort from the userinfo endpoint.
 */
export async function verifyGoogleAccessToken(accessToken: string): Promise<GoogleIdentity> {
  const audience = allowedAudiences();
  if (audience.length === 0) {
    throw new AppError('Google sign-in is not configured on the server', 503);
  }

  let info;
  try {
    // Authoritative: tokeninfo returns the token's audience + email.
    info = await client.getTokenInfo(accessToken);
  } catch (err) {
    logger.error('Google accessToken introspection failed', { error: (err as Error).message });
    throw new AppError('Invalid Google token', 401);
  }

  if (!info.aud || !audience.includes(info.aud)) {
    logger.error('Google accessToken audience mismatch', {
      tokenAud: info.aud,
      configuredAudiences: audience,
    });
    throw new AppError('Invalid Google token', 401);
  }
  if (!info.email) {
    throw new AppError('Google token did not contain an email (missing email scope)', 401);
  }

  // Best-effort: enrich with given/family name + picture from userinfo.
  let firstName = info.email.split('@')[0];
  let lastName = '';
  let picture: string | undefined;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const profile = (await res.json()) as {
        given_name?: string; family_name?: string; name?: string; picture?: string;
      };
      firstName = profile.given_name ?? profile.name ?? firstName;
      lastName = profile.family_name ?? '';
      picture = profile.picture;
    }
  } catch {
    // keep the email-derived name
  }

  return {
    googleId: info.sub ?? info.email,
    email: info.email.toLowerCase(),
    emailVerified: info.email_verified ?? true,
    firstName,
    lastName,
    picture,
  };
}
