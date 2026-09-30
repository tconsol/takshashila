/* The public tutor directory is readable by anyone, so it must expose an allow-list only. */
import { toPublicTutorCard, tutorService } from '../../modules/tutors/tutor.service';
import { tutorRepository } from '../../modules/tutors/tutor.repository';
import { userRepository } from '../../modules/users/user.repository';
import type { ITutorProfile } from '../../modules/tutors/tutor.types';

const ALLOWED = [
  'publicId', 'displayName', 'status', 'subjects', 'gradesTaught', 'languages', 'hourlyRateCents', 'bio',
  'qualifications', 'timezone', 'rating', 'ratingCount', 'totalStudents', 'totalClassesCompleted', 'isVerified',
].sort();

// Fields seen on the live site on 30 Sep 2026 that must never reach an anonymous visitor.
const FORBIDDEN = [
  '_id', '__v', 'userPublicId', 'principalPublicId', 'commissionRatePercent', 'trustScore', 'totalEarningsCents',
  'totalClassesCancelled', 'verifiedAt', 'verifiedBy', 'invitedBy', 'isDeleted', 'deletedAt', 'deletedBy',
  'createdAt', 'updatedAt',
];

function fullProfile(over: Partial<ITutorProfile> = {}): ITutorProfile {
  return {
    _id: 'mongo-id', publicId: 'tp-1', userPublicId: 'user-1', principalPublicId: 'prin-1', status: 'ACTIVE',
    subjects: ['Maths'], gradesTaught: ['Grade 5'], languages: ['English'], hourlyRateCents: 2000,
    commissionRatePercent: 20, bio: 'Hello', qualifications: ['B.Ed'], timezone: 'Asia/Calcutta', trustScore: 87,
    totalStudents: 4, totalClassesCompleted: 12, totalClassesCancelled: 1, totalEarningsCents: 123456, rating: 4.5,
    ratingCount: 8, isVerified: true, verifiedAt: new Date(), verifiedBy: 'admin-1', invitedBy: 'prin-1',
    isDeleted: false, createdAt: new Date(), updatedAt: new Date(), ...over,
  } as ITutorProfile;
}

describe('toPublicTutorCard', () => {
  it('returns exactly the allowed fields', () => {
    const card = toPublicTutorCard(fullProfile(), 'Sam Tutor');
    expect(Object.keys(card).sort()).toEqual(ALLOWED);
  });

  it('never carries earnings, commission, scores or internal IDs', () => {
    const card = toPublicTutorCard(fullProfile(), 'Sam Tutor') as unknown as Record<string, unknown>;
    for (const key of FORBIDDEN) expect(card).not.toHaveProperty(key);
    expect(JSON.stringify(card)).not.toContain('123456');
  });

  it('a field added to the database record later stays private', () => {
    const profile = { ...fullProfile(), secretNewField: 'x' } as unknown as ITutorProfile;
    expect(toPublicTutorCard(profile, 'Sam Tutor')).not.toHaveProperty('secretNewField');
  });

  it('keeps what the card shows', () => {
    const card = toPublicTutorCard(fullProfile(), 'Sam Tutor');
    expect(card).toMatchObject({
      publicId: 'tp-1', displayName: 'Sam Tutor', hourlyRateCents: 2000, rating: 4.5, isVerified: true, subjects: ['Maths'],
    });
  });
});

describe('tutorService.search (public)', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('returns cards only, and drops tutors whose user is missing or deleted', async () => {
    jest.spyOn(tutorRepository, 'search').mockResolvedValue({
      items: [fullProfile({ publicId: 'a', userPublicId: 'u-a' }), fullProfile({ publicId: 'b', userPublicId: 'u-b' })],
      pagination: { page: 1, limit: 24, total: 2, totalPages: 1 },
    } as never);
    jest.spyOn(userRepository, 'findManyByPublicIds').mockResolvedValue([
      { publicId: 'u-a', firstName: 'Ann', lastName: 'One', isDeleted: false },
    ] as never);

    const result = await tutorService.search({}, {});

    expect(result.items).toHaveLength(1);
    expect(Object.keys(result.items[0]).sort()).toEqual(ALLOWED);
    expect(result.items[0].displayName).toBe('Ann One');
    expect(result.pagination.total).toBe(1);
  });
});
