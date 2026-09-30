import type { DocxParagraph } from './docx-reader';

export interface ParsedCountyAddition {
  county: string;
  district: string;
  gradeFrom: number;
  gradeTo: number;
  category: string;
  description: string;
}

const headingLevel = (style: string): number => {
  const m = /^heading\s*(\d)$/i.exec(style.trim());
  return m ? Number(m[1]) : 0;
};

/** Kindergarten (or a bare "K") is 0; no numbers at all means every grade, 0-12. */
function parseBand(text: string): { from: number; to: number } {
  // numbers inside parentheses ("36 satellite programs") are not grades
  const nums = (text.replace(/\([^)]*\)/g, ' ').match(/kindergarten|\bK\b|\d+/gi) ?? []).map((t) => (/^\d/.test(t) ? Number(t) : 0));
  if (nums.length === 0) return { from: 0, to: 12 };
  return { from: Math.min(...nums), to: Math.max(...nums) };
}

// Category starts with a letter; the colon must be followed by whitespace (so "3:30" and "https://" do not split).
const CATEGORY_LINE = /^([A-Za-z][^:]{1,59}):\s+(?!\/\/)(.+)$/;

/**
 * Layout (Georgia and the other state files): H2 = county/district, H3 = grade band,
 * body lines = "Category: description". A line without a category continues the previous entry.
 * Entries under a county with no grade heading get 0-12. Lines before any county heading, or continuations with no entry to join, are dropped.
 */
export function parseCountyAdditions(paras: DocxParagraph[]): ParsedCountyAddition[] {
  const out: ParsedCountyAddition[] = [];
  const byKey = new Map<string, ParsedCountyAddition>();
  let county = '';
  let district = '';
  let band: { from: number; to: number } | null = null;
  let last: ParsedCountyAddition | null = null;

  for (const para of paras) {
    const level = headingLevel(para.style);
    const text = para.text.trim();
    if (!text) continue;
    if (level === 1) continue;
    if (level === 2) {
      county = text;
      district = /district/i.test(text) ? text : '';
      band = { from: 0, to: 12 }; // until a grade heading narrows it
      last = null;
    } else if (level >= 3) {
      band = parseBand(text);
      last = null;
    } else {
      if (!county || !band) continue;
      const m = CATEGORY_LINE.exec(text);
      if (m) {
        const category = m[1].trim();
        const description = m[2].trim();
        // The unique index is (county, district, band, category): repeats merge, keeping first-seen order.
        const key = JSON.stringify([county, district, band.from, band.to, category]);
        const existing = byKey.get(key);
        if (existing) {
          existing.description = `${existing.description}\n${description}`;
          last = existing;
        } else {
          last = { county, district, gradeFrom: band.from, gradeTo: band.to, category, description };
          byKey.set(key, last);
          out.push(last);
        }
      } else if (last) {
        last.description = `${last.description} ${text}`;
      }
    }
  }
  return out;
}
