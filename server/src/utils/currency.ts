export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function formatCurrency(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(centsToDollars(cents));
}

export function addCredits(balanceCents: number, amountCents: number): number {
  if (amountCents <= 0) throw new Error('Credit amount must be positive');
  return balanceCents + amountCents;
}

export function deductCredits(balanceCents: number, amountCents: number): number {
  if (amountCents <= 0) throw new Error('Deduction amount must be positive');
  if (balanceCents < amountCents) throw new Error('Insufficient credits');
  return balanceCents - amountCents;
}

export function calculateCommission(amountCents: number, ratePercent: number): number {
  if (ratePercent < 0 || ratePercent > 100) throw new Error('Commission rate must be 0–100');
  return Math.round((amountCents * ratePercent) / 100);
}
