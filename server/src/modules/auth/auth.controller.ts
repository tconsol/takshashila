import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authService } from './auth.service';
import { sendSuccess, sendCreated } from '../../utils/response';

function getDeviceInfo(req: Request) {
  return {
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    device: req.headers['x-device-type'] as string | undefined,
  };
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
      sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logout(req.user!.sessionId, req.user!.publicId);
      sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async logoutAllDevices(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logoutAllDevices(req.user!.publicId);
      sendSuccess(res, null, 'Logged out from all devices');
    } catch (error) {
      next(error);
    }
  }

  async refreshTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshTokens(refreshToken);
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
