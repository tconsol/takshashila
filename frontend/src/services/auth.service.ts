import { api } from '../lib/axios';
import type { ApiResponse, User, TokenPair } from '../types';
import type { LoginFormData, RegisterFormData, ForgotPasswordFormData } from '../validators/auth.validators';

/** Roles a person may pick for themselves during Google signup. */
export type GoogleSignupRole = 'STUDENT' | 'TUTOR' | 'PRINCIPAL';

export interface GoogleAuthPayload {
  idToken?: string;
  code?: string;
  accessToken?: string;
  /** Sent on the second call, once the person has chosen. */
  role?: GoogleSignupRole;
  phone?: string;
  timezone?: string;
  subjects?: string[];
  languages?: string[];
  bio?: string;
  qualifications?: string[];
  grade?: string;
  organizationName?: string;
}

/** An unknown Google address signs UP, so the server asks what to create. */
export interface GoogleRoleRequired {
  needsRole: true;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
}

export type GoogleAuthResult = ({ user: User } & TokenPair) | GoogleRoleRequired;

export function isGoogleRoleRequired(r: GoogleAuthResult): r is GoogleRoleRequired {
  return (r as GoogleRoleRequired).needsRole === true;
}

export const authService = {
  async login(data: LoginFormData) {
    const res = await api.post<ApiResponse<{ user: User } & TokenPair>>('/auth/login', data);
    return res.data.data;
  },

  async register(
    data: Omit<RegisterFormData, 'confirmPassword'> & {
      role?: string;
      subjects?: string[];
      languages?: string[];
      bio?: string;
      qualifications?: string[];
    },
  ) {
    const res = await api.post<ApiResponse<{ publicId: string }>>('/auth/register', data);
    return res.data.data;
  },

  async googleAuth(payload: GoogleAuthPayload) {
    const res = await api.post<ApiResponse<GoogleAuthResult>>('/auth/google', payload);
    return res.data.data;
  },

  async resendVerification(email: string) {
    await api.post('/auth/resend-verification', { email });
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

  async resetPassword(data: { token: string; password: string }) {
    await api.post('/auth/reset-password', data);
  },

  async verifyEmail(token: string) {
    await api.post('/auth/verify-email', { token });
  },
};
