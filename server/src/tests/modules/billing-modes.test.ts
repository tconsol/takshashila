import { BillingMode, isPrepaid, isHeld, isBundled, BundleBilling } from '../../modules/schedules/schedule.types';

describe('billing modes', () => {
  it('isPrepaid still covers only the two up-front modes', () => {
    expect(isPrepaid(BillingMode.COURSE_PREPAID)).toBe(true);
    expect(isPrepaid(BillingMode.PROGRAM_PREPAID)).toBe(true);
    expect(isPrepaid(BillingMode.COURSE_HELD)).toBe(false);
    expect(isPrepaid(BillingMode.PROGRAM_HELD)).toBe(false);
  });

  it('isHeld covers only the held modes', () => {
    expect(isHeld(BillingMode.COURSE_HELD)).toBe(true);
    expect(isHeld(BillingMode.PROGRAM_HELD)).toBe(true);
    expect(isHeld(BillingMode.COURSE_PREPAID)).toBe(false);
    expect(isHeld(BillingMode.STUDENT_REQUESTED)).toBe(false);
  });

  it('isBundled covers all four course/program modes and nothing else', () => {
    for (const m of [BillingMode.COURSE_PREPAID, BillingMode.PROGRAM_PREPAID, BillingMode.COURSE_HELD, BillingMode.PROGRAM_HELD]) {
      expect(isBundled(m)).toBe(true);
    }
    for (const m of [BillingMode.STUDENT_REQUESTED, BillingMode.TUTOR_REQUESTED, BillingMode.TUTOR_INVITED]) {
      expect(isBundled(m)).toBe(false);
    }
  });

  it('BundleBilling.HELD is the persisted marker', () => {
    expect(BundleBilling.HELD).toBe('HELD');
  });
});
