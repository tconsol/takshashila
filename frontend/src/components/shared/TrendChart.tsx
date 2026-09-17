import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Table2, LineChart as LineChartIcon } from 'lucide-react';
import { VizTokens } from './viz-tokens';

export interface TrendPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  value: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  /** Names the single series — stands in for a legend. */
  seriesLabel: string;
  height?: number;
  formatValue?: (n: number) => string;
  /** Hold the previous render at reduced opacity instead of flashing a skeleton. */
  isFetching?: boolean;
  emptyMessage?: string;
}

const PAD = { top: 10, right: 14, bottom: 26 };
const MIN_HIT = 24;
/** Roughly one 10px glyph, used to reserve gutter width for the y-axis labels. */
const CHAR_W = 6;

/**
 * Snap the axis ceiling to 1/2/2.5/5 x 10^n so the midpoint tick lands on a
 * round number — otherwise a rounded label sits at the position of an unrounded
 * value and the axis lies.
 */
function niceMax(max: number) {
  if (max <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(max));
  const norm = max / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TrendChart({
  data,
  seriesLabel,
  height = 200,
  formatValue = (n) => n.toLocaleString(),
  isFetching,
  emptyMessage = 'No data in this period.',
}: TrendChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);

    // A synchronous read here is usually enough, but when several siblings
    // (StatsCards, other charts) mount in the same commit the browser can
    // still be mid-reflow for this element, so `clientWidth` reads 0 and no
    // further ResizeObserver callback ever fires because the box's size never
    // subsequently *changes* from that stale 0. Re-checking on the next
    // couple of animation frames catches that case without waiting on a
    // resize that was never coming.
    setWidth(el.clientWidth);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
      raf2 = requestAnimationFrame(() => {
        if (el.clientWidth > 0) setWidth(el.clientWidth);
      });
    });

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  // Data can arrive after mount (the query resolves later than the chart's own
  // layout effect). If the very first width probe above landed on a 0-width
  // container and never resized since, re-probe once real data shows up so the
  // chart isn't left permanently blank waiting for a resize that never comes.
  useLayoutEffect(() => {
    if (width > 0 || data.length === 0) return;
    const el = wrapRef.current;
    if (el && el.clientWidth > 0) setWidth(el.clientWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]);

  // Keyboard parity with hover: arrow keys walk the series.
  useEffect(() => {
    if (hoverIdx === null || hoverIdx < data.length) return;
    setHoverIdx(null);
  }, [data.length, hoverIdx]);

  const geometry = useMemo(() => {
    if (width === 0 || data.length === 0) return null;

    const yMax = niceMax(Math.max(...data.map((d) => d.value), 1));
    const ticks = [0, 0.5, 1].map((f) => f * yMax);

    // Reserve the gutter from the widest formatted tick — a currency axis needs
    // far more room than a count axis, and a clipped label is worse than none.
    const widestLabel = Math.max(...ticks.map((t) => formatValue(t).length));
    const padLeft = Math.min(96, Math.max(28, widestLabel * CHAR_W + 10));

    const plotW = Math.max(1, width - padLeft - PAD.right);
    const plotH = Math.max(1, height - PAD.top - PAD.bottom);

    // A single point has no span to divide, so pin it mid-plot.
    const x = (i: number) =>
      data.length === 1 ? padLeft + plotW / 2 : padLeft + (i / (data.length - 1)) * plotW;
    const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

    const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.value)}`).join(' ');
    const areaPath =
      `${linePath} L${x(data.length - 1)},${PAD.top + plotH} L${x(0)},${PAD.top + plotH} Z`;

    return {
      plotW, plotH, yMax, x, y, linePath, areaPath, padLeft,
      // Position each tick from the exact value it labels — never from a rounded copy.
      ticks: ticks.map((value) => ({ value, yPos: y(value) })),
    };
  }, [data, width, height, formatValue]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const peak = data.reduce<TrendPoint | null>((m, d) => (!m || d.value > m.value ? d : m), null);
  const last = data[data.length - 1];
  const active = hoverIdx !== null ? data[hoverIdx] : null;

  const handleMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (!geometry || data.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = e.clientX - rect.left - geometry.padLeft;
    const step = data.length === 1 ? geometry.plotW : geometry.plotW / (data.length - 1);
    const idx = Math.round(rel / step);
    setHoverIdx(Math.min(data.length - 1, Math.max(0, idx)));
  };

  return (
    <div className="viz-root">
      <VizTokens />

      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: 'var(--viz-series)' }}
            aria-hidden
          />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{seriesLabel}</span>
          <span className="text-xs text-slate-400">· {formatValue(total)} total</span>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {showTable ? <LineChartIcon className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {showTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">{emptyMessage}</p>
      ) : showTable ? (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {seriesLabel}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{shortDate(d.date)}</td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums text-slate-900 dark:text-white">
                    {formatValue(d.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={wrapRef}
          className="relative w-full min-w-0 transition-opacity duration-200"
          style={{ height, opacity: isFetching ? 0.55 : 1 }}
        >
          {geometry && (
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={`${seriesLabel} over time. ${formatValue(total)} total.`}
            >
              {/* Recessive solid hairline grid */}
              {geometry.ticks.map((t) => (
                <line
                  key={t.value}
                  x1={geometry.padLeft}
                  x2={width - PAD.right}
                  y1={t.yPos}
                  y2={t.yPos}
                  stroke="var(--viz-grid)"
                  strokeWidth={1}
                />
              ))}
              {geometry.ticks.map((t) => (
                <text
                  key={`lbl-${t.value}`}
                  x={geometry.padLeft - 8}
                  y={t.yPos + 3}
                  textAnchor="end"
                  className="tabular-nums"
                  style={{ fill: 'var(--viz-muted)', fontSize: 10 }}
                >
                  {formatValue(t.value)}
                </text>
              ))}

              <path d={geometry.areaPath} fill="var(--viz-series-soft)" />
              <path
                d={geometry.linePath}
                fill="none"
                stroke="var(--viz-series)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Baseline */}
              <line
                x1={geometry.padLeft}
                x2={width - PAD.right}
                y1={PAD.top + geometry.plotH}
                y2={PAD.top + geometry.plotH}
                stroke="var(--viz-axis)"
                strokeWidth={1}
              />

              {/* Endpoint marker — the only always-on mark, 8px with a surface ring */}
              {last && (
                <circle
                  cx={geometry.x(data.length - 1)}
                  cy={geometry.y(last.value)}
                  r={4}
                  fill="var(--viz-series)"
                  stroke="var(--viz-surface)"
                  strokeWidth={2}
                />
              )}

              {/* Crosshair + hovered marker */}
              {active && hoverIdx !== null && (
                <>
                  <line
                    x1={geometry.x(hoverIdx)}
                    x2={geometry.x(hoverIdx)}
                    y1={PAD.top}
                    y2={PAD.top + geometry.plotH}
                    stroke="var(--viz-axis)"
                    strokeWidth={1}
                  />
                  <circle
                    cx={geometry.x(hoverIdx)}
                    cy={geometry.y(active.value)}
                    r={4.5}
                    fill="var(--viz-series)"
                    stroke="var(--viz-surface)"
                    strokeWidth={2}
                  />
                </>
              )}

              {/* First and last x labels only — no collision risk */}
              <text
                x={geometry.padLeft}
                y={height - 8}
                style={{ fill: 'var(--viz-muted)', fontSize: 10 }}
              >
                {shortDate(data[0].date)}
              </text>
              {data.length > 1 && (
                <text
                  x={width - PAD.right}
                  y={height - 8}
                  textAnchor="end"
                  style={{ fill: 'var(--viz-muted)', fontSize: 10 }}
                >
                  {shortDate(data[data.length - 1].date)}
                </text>
              )}

              {/* Hit layer spans the full plot so targets clear the 24px minimum */}
              <rect
                x={geometry.padLeft - MIN_HIT / 2}
                y={PAD.top}
                width={geometry.plotW + MIN_HIT}
                height={geometry.plotH}
                fill="transparent"
                onMouseMove={handleMove}
                onMouseLeave={() => setHoverIdx(null)}
              />
            </svg>
          )}

          {/* Tooltip enhances; every value is also in the table view */}
          {active && hoverIdx !== null && geometry && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
              style={{
                left: Math.min(Math.max(geometry.x(hoverIdx), 54), width - 54),
                top: Math.max(0, geometry.y(active.value) - 46),
              }}
            >
              <p className="font-semibold text-slate-900 dark:text-white">{formatValue(active.value)}</p>
              <p className="text-slate-400">{shortDate(active.date)}</p>
            </div>
          )}
        </div>
      )}

      {peak && !showTable && data.length > 0 && (
        <p className="mt-1.5 text-xs text-slate-400">
          Peak {formatValue(peak.value)} on {shortDate(peak.date)}
        </p>
      )}
    </div>
  );
}
