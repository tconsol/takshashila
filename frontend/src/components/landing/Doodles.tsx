/* Hand-drawn education doodles — decorative SVGs for the landing page.
   All purely decorative → aria-hidden, currentColor for easy tinting. */
import type { SVGProps } from 'react';

type D = SVGProps<SVGSVGElement>;

/** Marker-style squiggly underline */
export const Underline = (p: D) => (
  <svg viewBox="0 0 240 16" fill="none" aria-hidden {...p}>
    <path d="M3 11C45 5 130 3 192 7c18 1 34 3 45 6" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

/** Looping curved arrow (points down-right) */
export const CurvedArrow = (p: D) => (
  <svg viewBox="0 0 100 80" fill="none" aria-hidden {...p}>
    <path d="M6 10c30-6 66 2 78 30 5 11 2 24-8 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M58 62l16 10 10-16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Star / sparkle burst */
export const Sparkle = (p: D) => (
  <svg viewBox="0 0 40 40" fill="none" aria-hidden {...p}>
    <path d="M20 3v12M20 25v12M3 20h12M25 20h12M8 8l7 7M25 25l7 7M32 8l-7 7M15 25l-7 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** 4-point soft star */
export const Star4 = (p: D) => (
  <svg viewBox="0 0 32 32" fill="none" aria-hidden {...p}>
    <path d="M16 2c1.5 8 6 12.5 14 14-8 1.5-12.5 6-14 14-1.5-8-6-12.5-14-14 8-1.5 12.5-6 14-14Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
  </svg>
);

/** Pencil doodle */
export const Pencil = (p: D) => (
  <svg viewBox="0 0 48 48" fill="none" aria-hidden {...p}>
    <path d="M8 40l3-10L31 10l7 7-20 20-10 3Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M28 13l7 7M11 30l7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/** Open book doodle */
export const Book = (p: D) => (
  <svg viewBox="0 0 48 40" fill="none" aria-hidden {...p}>
    <path d="M24 8C19 4 10 4 5 6v26c5-2 14-2 19 2 5-4 14-4 19-2V6c-5-2-14-2-19 2Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M24 8v26" stroke="currentColor" strokeWidth="2.5" />
  </svg>
);

/** Lightbulb doodle */
export const Bulb = (p: D) => (
  <svg viewBox="0 0 36 44" fill="none" aria-hidden {...p}>
    <path d="M18 3C10 3 4 9 4 17c0 6 4 9 6 13h16c2-4 6-7 6-13 0-8-6-14-14-14Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M11 34h14M13 39h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M18 3V-1M33 17h4M-1 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Graduation cap doodle */
export const Cap = (p: D) => (
  <svg viewBox="0 0 48 40" fill="none" aria-hidden {...p}>
    <path d="M24 8 4 16l20 8 20-8-20-8Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M12 20v8c0 3 5 6 12 6s12-3 12-6v-8M44 16v10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/** Wavy squiggle */
export const Squiggle = (p: D) => (
  <svg viewBox="0 0 80 16" fill="none" aria-hidden {...p}>
    <path d="M3 8c6-7 12 7 18 0s12 7 18 0 12 7 18 0 12 7 18 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** Dotted curved path */
export const DottedPath = (p: D) => (
  <svg viewBox="0 0 120 40" fill="none" aria-hidden {...p}>
    <path d="M4 36C30 8 90 8 116 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 10" />
  </svg>
);

/** Small circle of plus marks / scatter */
export const Confetti = (p: D) => (
  <svg viewBox="0 0 60 40" fill="none" aria-hidden {...p}>
    <path d="M8 8l4 4M30 4v6M52 8l-4 4M6 28h6M50 28h6M30 34v6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/** Hand-drawn check mark */
export const CheckScribble = (p: D) => (
  <svg viewBox="0 0 32 32" fill="none" aria-hidden {...p}>
    <path d="M4 17c4 1 8 5 10 9 3-11 8-18 14-23" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Circle scribble (highlight ring) */
export const CircleScribble = (p: D) => (
  <svg viewBox="0 0 120 80" fill="none" aria-hidden {...p}>
    <path d="M60 8C30 8 8 24 8 42c0 16 22 30 52 30s52-12 52-30C112 22 86 6 56 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
