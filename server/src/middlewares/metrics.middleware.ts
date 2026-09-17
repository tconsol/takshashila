import type { Request, Response, NextFunction } from 'express';

interface RouteStat {
  route: string;
  count: number;
  errorCount: number;
  totalMs: number;
  maxMs: number;
}

/**
 * In-process request metrics. Deliberately not a time-series store — this exists
 * so the system console can answer "is the API healthy right now" without adding
 * a Prometheus dependency. Counters reset when the process restarts, and the
 * latency window is bounded so memory cannot grow with traffic.
 */
const LATENCY_WINDOW = 1000;

let totalRequests = 0;
let totalErrors = 0;
let startedAt = Date.now();
const latencies: number[] = [];
const byRoute = new Map<string, RouteStat>();
const statusCounts = new Map<number, number>();

/** Path params are collapsed so /users/<uuid> does not create a row per user. */
function normalizeRoute(req: Request): string {
  const base = req.baseUrl ?? '';
  const path = req.route?.path ?? req.path ?? '';
  const combined = `${base}${path === '/' ? '' : path}` || req.path;
  return `${req.method} ${combined
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:n')}`;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    totalRequests += 1;
    if (res.statusCode >= 500) totalErrors += 1;

    latencies.push(durationMs);
    if (latencies.length > LATENCY_WINDOW) latencies.shift();

    statusCounts.set(res.statusCode, (statusCounts.get(res.statusCode) ?? 0) + 1);

    const route = normalizeRoute(req);
    const stat = byRoute.get(route) ?? { route, count: 0, errorCount: 0, totalMs: 0, maxMs: 0 };
    stat.count += 1;
    stat.totalMs += durationMs;
    stat.maxMs = Math.max(stat.maxMs, durationMs);
    if (res.statusCode >= 500) stat.errorCount += 1;
    byRoute.set(route, stat);
  });

  next();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[index] * 100) / 100;
}

export function getRequestMetrics() {
  const sorted = [...latencies].sort((a, b) => a - b);
  const windowSeconds = Math.max(1, (Date.now() - startedAt) / 1000);

  const slowest = [...byRoute.values()]
    .map((s) => ({
      route: s.route,
      count: s.count,
      errorCount: s.errorCount,
      avgMs: Math.round((s.totalMs / s.count) * 100) / 100,
      maxMs: Math.round(s.maxMs * 100) / 100,
    }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 8);

  return {
    totalRequests,
    totalErrors,
    errorRatePercent: totalRequests > 0
      ? Math.round((totalErrors / totalRequests) * 10_000) / 100
      : 0,
    requestsPerMinute: Math.round((totalRequests / windowSeconds) * 60 * 100) / 100,
    latencyMs: {
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      sampleSize: sorted.length,
    },
    statusCounts: [...statusCounts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => a.status - b.status),
    slowestRoutes: slowest,
    since: new Date(startedAt).toISOString(),
  };
}

/** Exposed for tests — production counters live for the life of the process. */
export function resetRequestMetrics(): void {
  totalRequests = 0;
  totalErrors = 0;
  latencies.length = 0;
  byRoute.clear();
  statusCounts.clear();
  startedAt = Date.now();
}
