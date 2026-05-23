const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const USD_FORMATTER_DECIMAL = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(cents: number, _currency?: string): string {
  return USD_FORMATTER_DECIMAL.format(cents / 100);
}

export function centsToAmount(cents: number): number {
  return cents / 100;
}

export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function formatCompact(cents: number): string {
  const amount = cents / 100;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}
