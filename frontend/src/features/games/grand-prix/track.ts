// Top-down race circuit. The centerline is built from control points via
// Catmull-Rom spline interpolation for smooth curves.

export interface PathSample {
  x: number;
  y: number;
  angle: number; // tangent direction (radians)
}

export const WORLD_W = 700;
export const WORLD_H = 420;
export const ROAD_WIDTH = 56;
export const SAMPLES_PER_SEGMENT = 40;

// Control points for a closed circuit. Order matters — they define the loop.
// Includes a long top straight, a swooping right corner, a chicane, and a
// hairpin back to the start/finish line.
const CONTROL_POINTS: { x: number; y: number }[] = [
  { x:  90, y: 350 },   // 0  start/finish (on bottom straight)
  { x: 240, y: 360 },   // 1
  { x: 380, y: 320 },   // 2  chicane in
  { x: 470, y: 360 },   // 3  chicane out
  { x: 590, y: 350 },   // 4
  { x: 640, y: 250 },   // 5  right hairpin entry
  { x: 600, y: 160 },   // 6
  { x: 510, y: 110 },   // 7  top sweep
  { x: 380, y:  90 },   // 8
  { x: 240, y: 110 },   // 9
  { x: 130, y:  85 },   // 10
  { x:  50, y: 150 },   // 11 left hairpin top
  { x:  35, y: 250 },   // 12 left hairpin bottom
];

let CACHED: PathSample[] | null = null;

function catmullRom(p0: { x: number; y: number }, p1: typeof p0, p2: typeof p0, p3: typeof p0, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export function getCenterline(): PathSample[] {
  if (CACHED) return CACHED;
  const points = CONTROL_POINTS;
  const n = points.length;
  const samples: PathSample[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let j = 0; j < SAMPLES_PER_SEGMENT; j++) {
      const t = j / SAMPLES_PER_SEGMENT;
      const pt = catmullRom(p0, p1, p2, p3, t);
      samples.push({ x: pt.x, y: pt.y, angle: 0 });
    }
  }
  // Compute tangents
  for (let i = 0; i < samples.length; i++) {
    const cur = samples[i];
    const next = samples[(i + 1) % samples.length];
    cur.angle = Math.atan2(next.y - cur.y, next.x - cur.x);
  }
  CACHED = samples;
  return samples;
}

// Sample a position at fraction t in [0..1] around the loop.
export function sampleAt(t: number): PathSample {
  const path = getCenterline();
  const wrapped = ((t % 1) + 1) % 1;
  const idx = Math.floor(wrapped * path.length) % path.length;
  return path[idx];
}

// Lane offset perpendicular to track direction (for staggered grid positions).
export function offsetPoint(sample: PathSample, lateral: number): { x: number; y: number } {
  // Perpendicular = rotate tangent 90° clockwise
  const nx = Math.sin(sample.angle);
  const ny = -Math.cos(sample.angle);
  return { x: sample.x + nx * lateral, y: sample.y + ny * lateral };
}

// ─── Canvas drawing ─────────────────────────────────────────────────────

export function drawTrack(ctx: CanvasRenderingContext2D, dashOffset: number) {
  const path = getCenterline();

  // Grass background
  ctx.fillStyle = '#3f7a37';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Subtle grass texture (decorative dots)
  ctx.fillStyle = '#346a2d';
  for (let i = 0; i < 60; i++) {
    const x = (i * 137.13) % WORLD_W;
    const y = (i * 89.71) % WORLD_H;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Road shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = ROAD_WIDTH + 6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (i === 0) ctx.moveTo(p.x, p.y + 3);
    else ctx.lineTo(p.x, p.y + 3);
  }
  ctx.closePath();
  ctx.stroke();

  // Main road
  ctx.strokeStyle = '#5a5a5a';
  ctx.lineWidth = ROAD_WIDTH;
  ctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();

  // Kerbs (alternating red/white) — draw small rects perpendicular at edges, only on tight corners
  for (let i = 0; i < path.length; i += 4) {
    const cur = path[i];
    const next = path[(i + 1) % path.length];
    const angleDelta = Math.abs(angleDiff(cur.angle, next.angle));
    if (angleDelta < 0.04) continue; // straight segments — no kerbs
    const outer = offsetPoint(cur, ROAD_WIDTH / 2 + 3);
    const inner = offsetPoint(cur, -ROAD_WIDTH / 2 - 3);
    const color = (i / 4) % 2 === 0 ? '#cc0000' : '#ffffff';
    ctx.fillStyle = color;
    drawKerb(ctx, outer.x, outer.y, cur.angle);
    drawKerb(ctx, inner.x, inner.y, cur.angle);
  }

  // Dashed centerline
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 12]);
  ctx.lineDashOffset = -dashOffset;
  ctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Start/finish line at t=0 — checkered pattern across road width
  drawFinishLine(ctx);

  // Decorative trees
  const trees = [
    { x: 200, y: 230 }, { x: 320, y: 200 }, { x: 460, y: 220 },
    { x: 330, y: 420 - 15 }, { x: 200, y: 50 }, { x: 540, y: 230 },
  ];
  for (const t of trees) drawTree(ctx, t.x, t.y);
}

function angleDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function drawKerb(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillRect(-3, -2, 6, 4);
  ctx.restore();
}

function drawFinishLine(ctx: CanvasRenderingContext2D) {
  const sample = sampleAt(0);
  const half = ROAD_WIDTH / 2;
  ctx.save();
  ctx.translate(sample.x, sample.y);
  ctx.rotate(sample.angle);
  // Checker squares: 4 across width, 2 along length
  const sq = 7;
  for (let row = -1; row <= 0; row++) {
    for (let col = 0; col < 8; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#000000';
      ctx.fillRect(row * sq, -half + col * sq, sq, sq);
    }
  }
  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#1f4a1a';
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c6624';
  ctx.beginPath();
  ctx.arc(x - 2, y - 2, 5, 0, Math.PI * 2);
  ctx.fill();
}
