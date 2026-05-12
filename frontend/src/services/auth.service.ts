import { api } from '../lib/axios';
import type { ApiResponse, User, TokenPair } from '../types';
import type { LoginFormData, RegisterFormData, ForgotPasswordFormData } from '../validators/auth.validators';

export const authService = {
  async login(data: LoginFormData) {
    const res = await api.post<ApiResponse<{ user: User } & TokenPair>>('/auth/login', data);
    return res.data.data;
  },

  async register(data: Omit<RegisterFormData, 'confirmPassword'> & { role?: string }) {
    const res = await api.post<ApiResponse<{ publicId: string }>>('/auth/register', data);
    return res.data.data;
  },

  async getMe() {
    const res = await api.get<ApiResponse<User>>('/auth/me');
    return res.data.data;
  },

  async logout() {
    await api.post('/auth/logout');
  },

  async forgotPassword(data: ForgotPasswordFormData) {
    await api.post('/auth/forgot-password', data);
  },

  async verifyEmail(token: string) {
    await api.post('/auth/verify-email', { token });
  },
};
