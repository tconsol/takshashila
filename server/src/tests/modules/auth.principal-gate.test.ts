import argon2 from 'argon2';
import { AuthService } from '../../modules/auth/auth.service';
import { userRepository } from '../../modules/users/user.repository';
import { UserStatus } from '../../modules/users/user.types';
import { PrincipalProfileModel } from '../../modules/principals/principal.model';
import { PrincipalStatus } from '../../modules/principals/principal.types';

jest.mock('../../lib/google-auth', () => ({
  verifyGoogleIdToken: jest.fn().mockResolvedValue({
    email: 'p@school.test', emailVerified: true, firstName: 'P', lastName: 'Q',
  }),
  verifyGoogleAccessToken: jest.fn(),
  exchangeGoogleCode: jest.fn(),
}));

const device = { ip: '127.0.0.1', userAgent: 'jest' } as never;
const principalUser = {
  publicId: 'prin-user', role: 'PRINCIPAL', email: 'p@school.test', passwordHash: 'h',
  status: UserStatus.ACTIVE, emailVerified: true, isDeleted: false,
};

const setProfile = (profile: unknown) =>
  jest.spyOn(PrincipalProfileModel, 'findOne').mockReturnValue({ lean: () => Promise.resolve(profile) } as never);

describe('AuthService principal login gate', () => {
  let service: AuthService;
  let issue: jest.SpyInstance;

  beforeEach(() => {
    service = new AuthService();
    issue = jest.spyOn(service as never, '_issueSession').mockResolvedValue({ accessToken: 'a', user: {} } as never);
    jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(principalUser as never);
    jest.spyOn(argon2, 'verify').mockResolvedValue(true as never);
  });

  const paths: Array<[string, () => Promise<unknown>]> = [
    ['login', () => service.login({ identifier: 'p@school.test', password: 'pw' } as never, device)],
    ['loginWithGoogle', () => service.loginWithGoogle({ idToken: 'tok' } as never, device)],
  ];

  describe.each(paths)('%s', (_name, run) => {
    it.each([
      [PrincipalStatus.PENDING_APPROVAL, /pending approval/],
      [PrincipalStatus.SUSPENDED, /suspended/],
      [PrincipalStatus.INACTIVE, /inactive/],
    ])('blocks a %s principal', async (status, msg) => {
      setProfile({ status });
      await expect(run()).rejects.toMatchObject({ statusCode: 401, message: expect.stringMatching(msg) });
      expect(issue).not.toHaveBeenCalled();
    });

    it('blocks a principal with no profile as pending', async () => {
      setProfile(null);
      await expect(run()).rejects.toThrow(/pending approval/);
      expect(issue).not.toHaveBeenCalled();
    });

    it('issues a session for an approved principal', async () => {
      setProfile({ status: PrincipalStatus.ACTIVE });
      await expect(run()).resolves.toBeDefined();
      expect(issue).toHaveBeenCalledTimes(1);
    });
  });

  it('does not consult principal profiles for non-principals', async () => {
    (userRepository.findByEmail as jest.Mock).mockResolvedValue({ ...principalUser, role: 'STUDENT' });
    const spy = setProfile(null);
    await expect(service.loginWithGoogle({ idToken: 'tok' } as never, device)).resolves.toBeDefined();
    expect(spy).not.toHaveBeenCalled();
  });
});
