import { dollarsToCents, centsToDollars, formatCurrency, calculateCommission, addCredits, deductCredits } from '../../utils/currency';

describe('dollarsToCents', () => {
  it('converts whole dollars', () => expect(dollarsToCents(10)).toBe(1000));
  it('converts decimal dollars', () => expect(dollarsToCents(10.5)).toBe(1050));
  it('rounds floating point drift', () => expect(dollarsToCents(0.1 + 0.2)).toBe(30));
  it('handles zero', () => expect(dollarsToCents(0)).toBe(0));
});

describe('centsToDollars', () => {
  it('converts cents to dollars', () => expect(centsToDollars(1050)).toBe(10.5));
  it('handles zero', () => expect(centsToDollars(0)).toBe(0));
});

describe('formatCurrency', () => {
  it('formats USD correctly', () => expect(formatCurrency(1000, 'USD')).toContain('10'));
});

describe('calculateCommission', () => {
  it('calculates 10% of 1000 cents', () => expect(calculateCommission(1000, 10)).toBe(100));
  it('calculates 0% commission', () => expect(calculateCommission(5000, 0)).toBe(0));
  it('throws for rate > 100', () => expect(() => calculateCommission(1000, 101)).toThrow());
});

describe('addCredits', () => {
  it('adds credits correctly', () => expect(addCredits(500, 300)).toBe(800));
  it('throws for non-positive amount', () => expect(() => addCredits(500, 0)).toThrow());
});

describe('deductCredits', () => {
  it('deducts credits correctly', () => expect(deductCredits(500, 300)).toBe(200));
  it('throws for insufficient credits', () => expect(() => deductCredits(100, 500)).toThrow());
});
