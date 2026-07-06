import { cached } from './cache';
import { logger } from './logger';

// Live USD→INR rate, cached 24h (free, no API key). Falls back to a sane constant
// if the feed is unreachable so payments never break.
const FX_URL = 'https://open.er-api.com/v6/latest/USD';
const FALLBACK_USD_INR = 94.637;

export async function getUsdInrRate(): Promise<number> {
  return cached('fx:usd-inr', 24 * 60 * 60, async () => {
    try {
      const res = await fetch(FX_URL);
      const data = (await res.json()) as { rates?: { INR?: number } };
      const rate = data.rates?.INR;
      if (typeof rate === 'number' && rate > 0) return rate;
      throw new Error('INR rate missing in FX response');
    } catch (e) {
      logger.warn('FX fetch failed — using fallback USD/INR rate', { error: (e as Error).message });
      return FALLBACK_USD_INR;
    }
  });
}
