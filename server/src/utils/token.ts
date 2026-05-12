import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import type { AuthPayload } from '../shared/types';
import type { Role } from '../constants/roles';

export function generateAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: 'takshashila',
    audience: 'takshashila-client',
  } as jwt.SignOptions);
}

export function generateRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: 'takshashila',
    audience: 'takshashila-client',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'takshashila',
    audience: 'takshashila-client',
  }) as AuthPayload;
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'takshashila',
    audience: 'takshashila-client',
  }) as AuthPayload;
}

export function generateSessionId(): string {
  return uuidv4();
}

export function buildTokenPayload(
  userId: string,
  publicId: string,
  role: Role,
  sessionId: string,
): AuthPayload {
  return { userId, publicId, role, sessionId };
}
