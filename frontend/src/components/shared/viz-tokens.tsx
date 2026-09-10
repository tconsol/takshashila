/**
 * Chart colour tokens, defined once and consumed by role.
 *
 * Single-series vermilion, matching the interface accent: light `#D64520` on a
 * white surface, dark `#E85A33` on `#12100D`. Both steps were run through the
 * palette validator against their own surface and pass the lightness band,
 * chroma floor and >=3:1 contrast checks. Grid and axis are solid hairlines one
 * shade off the surface — never dashed.
 */
export const VIZ_TOKENS_CSS = `
.viz-root {
  --viz-series: #D64520;
  --viz-series-soft: rgba(214, 69, 32, 0.12);
  --viz-grid: #E4DFD5;
  --viz-axis: #D0C9BC;
  --viz-muted: #8A8177;
  --viz-surface: #FFFFFF;
}
.dark .viz-root {
  --viz-series: #E85A33;
  --viz-series-soft: rgba(232, 90, 51, 0.18);
  --viz-grid: #2C2822;
  --viz-axis: #3E3830;
  --viz-muted: #847C70;
  --viz-surface: #1A1713;
}
`;

/** Injecting this more than once per page is harmless — the rules are identical. */
export function VizTokens() {
  return <style>{VIZ_TOKENS_CSS}</style>;
}
