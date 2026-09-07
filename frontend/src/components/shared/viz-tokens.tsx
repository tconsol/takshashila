/**
 * Chart colour tokens, defined once and consumed by role.
 *
 * Single-series indigo: light `#4f46e5` on a white surface, dark `#6366f1` on
 * `#0f172a`. Both steps were run through the palette validator against their own
 * surface and pass the lightness band, chroma floor and >=3:1 contrast checks.
 * Grid and axis are solid hairlines one shade off the surface — never dashed.
 */
export const VIZ_TOKENS_CSS = `
.viz-root {
  --viz-series: #4f46e5;
  --viz-series-soft: rgba(79, 70, 229, 0.12);
  --viz-grid: #e2e8f0;
  --viz-axis: #cbd5e1;
  --viz-muted: #64748b;
  --viz-surface: #ffffff;
}
.dark .viz-root {
  --viz-series: #6366f1;
  --viz-series-soft: rgba(99, 102, 241, 0.18);
  --viz-grid: #1e293b;
  --viz-axis: #334155;
  --viz-muted: #94a3b8;
  --viz-surface: #0f172a;
}
`;

/** Injecting this more than once per page is harmless — the rules are identical. */
export function VizTokens() {
  return <style>{VIZ_TOKENS_CSS}</style>;
}
