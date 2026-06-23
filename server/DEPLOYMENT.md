# Deployment & cost notes

## Why the old setup cost ~$14/mo while idle
The web server started the BullMQ **workers in-process** (email, notification,
cleanup) + interval jobs (slot-expiry). Long-running workers must stay alive, so
Cloud Run needed `min-instances >= 1` (an always-warm instance) ≈ **$14/mo** —
billed even with zero traffic.

## New architecture (web scales to zero)
Workers are now a **separate process** (`src/worker.ts`). The web process only
*produces* jobs (enqueue) — no pollers — so it can scale to zero.

| Process | Entry | Command | Cloud Run |
|---|---|---|---|
| Web API | `src/server.ts` | `npm start` (`node dist/server.js`) | **min-instances = 0** |
| Workers | `src/worker.ts` | `npm run worker` (`node dist/worker.js`) | see below |

Same Docker image for both — just override the container command for the worker.

### Lowest-cost options for the worker
1. **Free always-on host** (recommended): run `node dist/worker.js` on Render
   free / Fly.io free / Railway. Web stays on Cloud Run at min-instances=0 → ~$0 idle.
2. **Single Cloud Run service**: set env `RUN_WORKERS=true` on the web service —
   it then runs workers in-process again (needs min-instances=1). Simplest, but
   back to the always-on cost.
3. Keep web + a small dedicated worker Cloud Run service (min-instances=1, 256 MB).

### Redis
- Use **Upstash free tier** (not Memorystore — Memorystore is ~$35/mo minimum).
- `config/redis.ts` now uses `lazyConnect: true` (connects on first use, not boot).

## Env flags
- `RUN_WORKERS=true` → web process also runs background workers (option 2 / local dev).
- Local dev: `npm run dev` (web) + `npm run dev:worker` (workers) in two terminals,
  or just `RUN_WORKERS=true npm run dev`.

## Caching (cuts DB reads → lower Atlas + compute)
- `lib/cache.ts` — Redis read-through with in-memory fallback. Applied to the
  public tutor search (60s). Extend to analytics/dashboard read endpoints.
- Frontend React Query: `refetchOnWindowFocus`/`refetchOnReconnect` off, 5-min
  stale + 30-min gc → far fewer duplicate API calls.
