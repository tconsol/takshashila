import React, { useRef, useCallback, useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface CardPhysicsState {
  angle: number;
  vel: number;
}

const SPRING_K = 0;
const DAMPING = 0.9;
const GRAVITY = 3000;
const MASS = 1;

const Lanyard = ({ length, color }: { length: number; color: string }) => (
  <svg width="30" height={length} viewBox={`0 0 30 ${length}`} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
    <circle cx="15" cy="0" r="5" fill={color} />
    <path d={`M 13 0 L 10 ${length}`} stroke={color} strokeWidth="6" opacity="0.9" />
    <path d={`M 17 0 L 20 ${length}`} stroke={color} strokeWidth="6" opacity="0.9" />
    <rect x="10" y={length - 6} width="10" height="8" rx="2" fill="#94a3b8" />
    <circle cx="15" cy={length + 2} r="3" fill="#e2e8f0" />
  </svg>
);

export interface HangingIdCardProps {
  children?: React.ReactNode;
  ropeLength?: number;
  ropeColor?: string;
  className?: string;
  name?: string;
  role?: string;
  badgeId?: string;
  accentColor?: string;
  avatarInitials?: string;
}

export const HangingIdCard = ({
  children,
  ropeLength = 130,
  ropeColor = '#6366f1',
  className,
  name = 'User',
  role = 'Member',
  badgeId = 'TK-2025',
  accentColor = '#4f46e5',
  avatarInitials,
}: HangingIdCardProps) => {
  const physRef = useRef<CardPhysicsState>({ angle: 0, vel: 0 });
  const rafRef = useRef<number | null>(null);
  const prevTimeRef = useRef<number | null>(null);
  const prevAngleRef = useRef(0);
  const isDraggingRef = useRef(false);

  const [angle, setAngle] = useState(0);
  const dragStartX = useRef(0);
  const dragAngle0 = useRef(0);

  const tick = useCallback((now: number) => {
    if (prevTimeRef.current === null) prevTimeRef.current = now;
    const dt = Math.min((now - prevTimeRef.current) / 1000, 0.05);
    prevTimeRef.current = now;

    const s = physRef.current;
    if (!isDraggingRef.current) {
      const L = ropeLength + 100;
      const torque =
        -(GRAVITY / L) * Math.sin(s.angle) -
        (DAMPING / MASS) * s.vel -
        (SPRING_K / MASS) * s.angle;
      s.vel += torque * dt;
      s.angle += s.vel * dt;
      setAngle(s.angle);
      if (Math.abs(s.angle) > 0.001 || Math.abs(s.vel) > 0.001) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        s.angle = 0; s.vel = 0; setAngle(0);
      }
    } else {
      if (dt > 0) s.vel = (s.angle - prevAngleRef.current) / dt;
      prevAngleRef.current = s.angle;
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [ropeLength]);

  const startPhysics = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    prevTimeRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartX.current = e.clientX;
    dragAngle0.current = physRef.current.angle;
    prevAngleRef.current = physRef.current.angle;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    prevTimeRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartX.current;
    const L = ropeLength + 100;
    const newAngle = dragAngle0.current - dx / L;
    const clamped = Math.max(-1.4, Math.min(1.4, newAngle));
    physRef.current.angle = clamped;
    setAngle(clamped);
  }, [ropeLength]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDraggingRef.current = false;
    startPhysics();
  }, [startPhysics]);

  const onCardClick = useCallback(() => {
    if (Math.abs(physRef.current.vel) < 0.1 && Math.abs(physRef.current.angle) < 0.05) {
      physRef.current.vel = 4.0;
      startPhysics();
    }
  }, [startPhysics]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const cardRotateDeg = angle * (180 / Math.PI);
  const initials = avatarInitials ?? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={cn('flex flex-col items-center select-none', className)} style={{ touchAction: 'none' }}>
      <div className="w-3 h-3 rounded-full z-10 relative" style={{ background: accentColor }} />

      <div
        className="flex flex-col items-center cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onCardClick}
        style={{ transform: `rotate(${cardRotateDeg}deg)`, transformOrigin: 'top center', willChange: 'transform', marginTop: '-6px' }}
      >
        <div style={{ pointerEvents: 'none' }}>
          <Lanyard length={ropeLength} color={ropeColor} />
        </div>

        <div className="relative w-52 rounded-2xl overflow-hidden border border-white/20 dark:border-white/10 bg-white dark:bg-zinc-900 pointer-events-none mt-[-2px]">
          {children ?? (
            <div className="flex flex-col h-full">
              <div
                className="px-4 py-4 flex flex-col items-center gap-2"
                style={{ background: `linear-gradient(135deg, ${accentColor} 0%, #6366f1 100%)` }}
              >
                <p className="text-[9px] font-bold tracking-[0.25em] text-white/70 uppercase">Brainbase Edu</p>
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner text-white font-bold text-xl"
                >
                  {initials}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 px-4 py-4 flex flex-col items-center gap-2">
                <p className="text-sm font-bold text-zinc-900 dark:text-white text-center leading-tight">{name}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">{role}</p>

                <div className="my-2 w-full border-t border-zinc-100 dark:border-zinc-800" />

                <div className="flex gap-[2px] items-end h-7 px-1">
                  {Array.from({ length: 28 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-zinc-800 dark:bg-zinc-200 rounded-[1px]"
                      style={{ width: i % 3 === 0 ? '3px' : '1.5px', height: `${50 + Math.sin(i * 1.3) * 35}%` }}
                    />
                  ))}
                </div>

                <p className="text-[10px] font-mono font-bold mt-1 tracking-widest" style={{ color: accentColor }}>
                  {badgeId}
                </p>

                <div
                  className="mt-1 px-3 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-widest"
                  style={{ background: accentColor }}
                >
                  ACTIVE
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-[11px] text-zinc-400 dark:text-zinc-600 font-medium select-none pointer-events-none">
        Drag or click the card
      </p>
    </div>
  );
};

export default HangingIdCard;
