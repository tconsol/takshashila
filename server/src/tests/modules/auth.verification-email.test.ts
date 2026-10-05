import { AuthService } from '../../modules/auth/auth.service';
import { userRepository } from '../../modules/users/user.repository';
import { UserStatus } from '../../modules/users/user.types';
import { notificationService } from '../../modules/notifications/notification.service';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';

const pendingUser = {
  publicId: 'u1', email: 'p@x.test', role: 'STUDENT',
  status: UserStatus.PENDING_VERIFICATION, emailVerified: false, isDeleted: false,
};

describe('verification email delivery', () => {
  let service: AuthService;
  beforeEach(() => {
    service = new AuthService();
    jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(pendingUser as never);
    jest.spyOn(userRepository, 'update').mockResolvedValue(pendingUser as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('finishes the SMTP send before resendVerification returns', async () => {
    let smtpDone = false;
    jest.spyOn(notificationService, 'sendVerificationEmail').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      smtpDone = true;
    });
    await service.resendVerification('p@x.test');
    expect(smtpDone).toBe(true);
  });

  it('does not fail the request when SMTP fails, and lets the listener retry', async () => {
    jest.spyOn(notificationService, 'sendVerificationEmail').mockRejectedValue(new Error('smtp down'));
    const seen: Array<{ emailSent?: boolean }> = [];
    const spy = (p: { emailSent?: boolean }) => seen.push(p);
    domainEvents.on(DomainEvent.USER_REGISTERED, spy);
    await expect(service.resendVerification('p@x.test')).resolves.toBeUndefined();
    domainEvents.off(DomainEvent.USER_REGISTERED, spy);
    expect(seen[0].emailSent).toBe(false);
  });

  it('marks emailSent so the listener does not send a second copy', async () => {
    jest.spyOn(notificationService, 'sendVerificationEmail').mockResolvedValue();
    const seen: Array<{ emailSent?: boolean }> = [];
    const spy = (p: { emailSent?: boolean }) => seen.push(p);
    domainEvents.on(DomainEvent.USER_REGISTERED, spy);
    await service.resendVerification('p@x.test');
    domainEvents.off(DomainEvent.USER_REGISTERED, spy);
    expect(seen[0].emailSent).toBe(true);
  });
});
