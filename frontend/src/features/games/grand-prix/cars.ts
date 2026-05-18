import type { Racer, CarColor } from './types';
import { sampleAt, offsetPoint, ROAD_WIDTH } from './track';

const COLOR_MAP: Record<CarColor, { body: string; trim: string }> = {
  yellow: { body: '#fbbf24', trim: '#b45309' },
  blue:   { body: '#3b82f6', trim: '#1e3a8a' },
  red:    { body: '#ef4444', trim: '#7f1d1d' },
  orange: { body: '#fb923c', trim: '#9a3412' },
};

const LANES = [-ROAD_WIDTH * 0.28, -ROAD_WIDTH * 0.1, ROAD_WIDTH * 0.1, ROAD_WIDTH * 0.28];

export function laneOffset(racerIdx: number): number {
  return LANES[racerIdx % LANES.length];
}

// Position a racer at its eased progress + lane offset.
export function racerPosition(r: Racer, racerIdx: number) {
  const s = sampleAt(r.displayProgress);
  const pos = offsetPoint(s, laneOffset(racerIdx));
  return { x: pos.x, y: pos.y, angle: s.angle };
}

export function drawCar(ctx: CanvasRenderingContext2D, racer: Racer, racerIdx: number) {
  const { x, y, angle } = racerPosition(racer, racerIdx);
  const colors = COLOR_MAP[racer.color];

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundedRect(ctx, -12, -8 + 2, 24, 16, 4);
  ctx.fill();

  // Body
  ctx.fillStyle = colors.body;
  roundedRect(ctx, -12, -8, 24, 16, 4);
  ctx.fill();

  // Trim stripe
  ctx.fillStyle = colors.trim;
  roundedRect(ctx, -12, -2, 24, 4, 2);
  ctx.fill();

  // Windshield (front-facing)
  ctx.fillStyle = '#1f2937';
  roundedRect(ctx, 2, -5, 7, 10, 2);
  ctx.fill();

  // Wheels (4 corners)
  ctx.fillStyle = '#111';
  ctx.fillRect(-11, -10, 5, 3);
  ctx.fillRect(6, -10, 5, 3);
  ctx.fillRect(-11, 7, 5, 3);
  ctx.fillRect(6, 7, 5, 3);

  // Highlight on top
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundedRect(ctx, -10, -7, 20, 3, 2);
  ctx.fill();

  // Player marker — small arrow above the car
  if (racer.isPlayer) {
    ctx.save();
    ctx.rotate(-angle); // counter-rotate so arrow stays world-up
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(-5, -14);
    ctx.lineTo(5, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function carHexColor(color: CarColor): string {
  return COLOR_MAP[color].body;
}
