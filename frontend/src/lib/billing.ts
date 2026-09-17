/** Flat platform fee, in credits, charged per side of a paid class.
 *  Mirrors PLATFORM_FEE_CENTS (100) on the server. 1 credit = 100 cents. */
export const PLATFORM_FEE_CREDITS = 1;

/** Format a cents value as CREDITS (1 credit = 100 cents). No currency symbol. */
export function formatCredits(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
