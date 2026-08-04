import { api } from '../lib/api';
import type { LoginResponse, User } from '../types/api.types';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
}

export const authService = {
  // API expects { identifier, password } (identifier = email or student ID).
  login: (dto: LoginDto): Promise<LoginResponse> =>
    api.post('/auth/login', { identifier: dto.email, password: dto.password }).then((r) => r.data.data),

  register: (dto: RegisterDto): Promise<{ publicId: string }> =>
    api.post('/auth/register', { ...dto, role: dto.role ?? 'STUDENT' }).then((r) => r.data.data),

  // Exchange a verified Google ID token for our own session (login or signup).
  googleAuth: (idToken: string): Promise<LoginResponse> =>
    api.post('/auth/google', { idToken }).then((r) => r.data.data),

  resendVerification: (email: string): Promise<void> =>
    api.post('/auth/resend-verification', { email }).then(() => undefined),

  getMe: (): Promise<User> =>
    api.get('/auth/me').then((r) => r.data.data),

  logout: (): Promise<void> =>
    api.post('/auth/logout').then(() => undefined),

  refreshTokens: (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> =>
    api.post('/auth/refresh', { refreshToken }).then((r) => r.data.data),

  forgotPassword: (email: string): Promise<void> =>
    api.post('/auth/forgot-password', { email }).then(() => undefined),

  verifyEmail: (token: string): Promise<void> =>
    api.post('/auth/verify-email', { token }).then(() => undefined),
};
