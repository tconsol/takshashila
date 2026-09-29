import argon2 from 'argon2';
import { AuthService } from '../../modules/auth/auth.service';
import { AuthController } from '../../modules/auth/auth.controller';
import { userRepository } from '../../modules/users/user.repository';
import { UserStatus } from '../../modules/users/user.types';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { settingsService } from '../../modules/settings/settings.service';

jest.mock('../../lib/google-auth', () => ({
  verifyGoogleIdToken: jest.fn().mockResolvedValue({ email: 't@x.test', emailVerified: true, firstName: 'T', lastName: 'U' }),
  verifyGoogleAccessToken: jest.fn(),
  exchangeGoogleCode: jest.fn(),
}));

const device = { ip: '127.0.0.1', userAgent: 'jest' } as never;
const tutorUser = {
  publicId: 'tut-user', role: 'TUTOR', email: 't@x.test', passwordHash: 'h',
  status: UserStatus.ACTIVE, emailVerified: true, isDeleted: false,
};
const setProfile = (profile: unknown) =>
  jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue({ lean: () => Promise.resolve(profile) } as never);

describe('tutor login gate', () => {
  let service: AuthService;
  let issue: jest.SpyInstance;
  beforeEach(() => {
    service = new AuthService();
    issue = jest.spyOn(service as never, '_issueSession').mockResolvedValue({ accessToken: 'a', user: {} } as never);
    jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(tutorUser as never);
    jest.spyOn(argon2, 'verify').mockResolvedValue(true as never);
  });
  afterEach(() => jest.restoreAllMocks());

  const paths: Array<[string, () => Promise<unknown>]> = [
    ['login', () => service.login({ identifier: 't@x.test', password: 'pw' } as never, device)],
    ['loginWithGoogle', () => service.loginWithGoogle({ idToken: 'tok' } as never, device)],
  ];
  describe.each(paths)('%s', (_n, run) => {
    it.each([['SUSPENDED', /suspended/], ['INACTIVE', /inactive/]])('blocks %s', async (status, msg) => {
      setProfile({ status });
      await expect(run()).rejects.toMatchObject({ statusCode: 401, message: expect.stringMatching(msg) });
      expect(issue).not.toHaveBeenCalled();
    });
    it.each(['REGISTERED', 'UNDER_VERIFICATION', 'INVITED', 'ACTIVE'])('allows %s', async (status) => {
      setProfile({ status });
      await expect(run()).resolves.toBeDefined();
      expect(issue).toHaveBeenCalledTimes(1);
    });
  });
});

describe('registrationOpen flag', () => {
  afterEach(() => jest.restoreAllMocks());

  it('controller refuses public register with 403 when closed', async () => {
    jest.spyOn(settingsService, 'isFeatureEnabled').mockResolvedValue(false);
    const { authService } = await import('../../modules/auth/auth.service');
    const reg = jest.spyOn(authService, 'register');
    const next = jest.fn();
    await new AuthController().register({ body: {} } as never, {} as never, next);
    expect(reg).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });

  it('refuses new Google sign-ups but not existing users when closed', async () => {
    jest.spyOn(settingsService, 'isFeatureEnabled').mockResolvedValue(false);
    const service = new AuthService();
    jest.spyOn(service as never, '_issueSession').mockResolvedValue({ accessToken: 'a', user: {} } as never);
    jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null as never);
    await expect(service.loginWithGoogle({ idToken: 'tok' } as never, device)).rejects.toMatchObject({ statusCode: 403 });

    jest.spyOn(userRepository, 'findByEmail').mockResolvedValue({ ...tutorUser, role: 'STUDENT' } as never);
    await expect(service.loginWithGoogle({ idToken: 'tok' } as never, device)).resolves.toBeDefined();
  });
});
