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
  login: (dto: LoginDto): Promise<LoginResponse> =>
    api.post('/auth/login', dto).then((r) => r.data.data),

  register: (dto: RegisterDto): Promise<{ publicId: string }> =>
    api.post('/auth/register', { ...dto, role: dto.role ?? 'STUDENT' }).then((r) => r.data.data),

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
