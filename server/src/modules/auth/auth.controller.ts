import type { Request, Response, NextFunction } from 'express';
import type { CookieOptions } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authService } from './auth.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { env } from '../../config/env';

function getDeviceInfo(req: Request) {
  return {
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    device: req.headers['x-device-type'] as string | undefined,
  };
}

// ── HttpOnly auth cookies (web). Tokens are also returned in the body so native
//    mobile (Bearer + secure storage) keeps working. Browsers should rely on the
//    cookies, which JS cannot read → mitigates token theft via XSS. ──
const isProd = env.NODE_ENV === 'production';
const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';
// Cross-site (SPA on a different domain than the API) needs SameSite=None;Secure.
const cookieBase: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  path: '/',
};

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase, maxAge: 24 * 60 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieBase, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, cookieBase);
  res.clearCookie(REFRESH_COOKIE, cookieBase);
}

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);
      sendCreated(res, result, 'Registration successful. Please verify your email.');
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body, getDeviceInfo(req));
      setAuthCookies(res, result.accessToken, result.refreshToken);
      sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.loginWithGoogle(
        { idToken: req.body.idToken, code: req.body.code, accessToken: req.body.accessToken },
        getDeviceInfo(req),
      );
      setAuthCookies(res, result.accessToken, result.refreshToken);
      sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.resendVerification(req.body.email);
      sendSuccess(res, null, 'If an unverified account with that email exists, a new verification link has been sent.');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logout(req.user!.sessionId, req.user!.publicId);
      clearAuthCookies(res);
      sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async logoutAllDevices(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logoutAllDevices(req.user!.publicId);
      clearAuthCookies(res);
      sendSuccess(res, null, 'Logged out from all devices');
    } catch (error) {
      next(error);
    }
  }

  async refreshTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Accept the refresh token from the HttpOnly cookie (web) or the body (mobile).
      const refreshToken = req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE];
      const tokens = await authService.refreshTokens(refreshToken);
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      sendSuccess(res, tokens, 'Tokens refreshed');
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.verifyEmail(req.body.token);
      sendSuccess(res, null, 'Email verified successfully');
    } catch (error) {
      next(error);
    }
  }

  async acceptInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;
      await authService.acceptInvite(token, password);
      sendSuccess(res, null, 'Account activated successfully. You can now log in.');
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.forgotPassword(req.body);
      sendSuccess(
        res,
        null,
        'If an account with that email exists, a reset link has been sent',
      );
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.resetPassword(req.body);
      sendSuccess(res, null, 'Password reset successfully');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.changePassword(req.user!.publicId, req.body);
      sendSuccess(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userService } = await import('../users/user.service');
      const user = await userService.getByPublicId(req.user!.publicId);
      sendSuccess(res, user, 'User profile fetched');
    } catch (error) {
      next(error);
    }
  }

  async listActiveSessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessions = await authService.listActiveSessions(req.user!.publicId);
      sendSuccess(res, sessions, 'Active sessions fetched');
    } catch (error) {
      next(error);
    }
  }

  async revokeSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      await authService.revokeSession(sessionId, req.user!.publicId);
      sendSuccess(res, null, 'Session revoked');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
