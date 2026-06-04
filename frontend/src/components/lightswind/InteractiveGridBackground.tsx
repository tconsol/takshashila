import React, { useEffect, useRef, useState } from 'react';

export interface InteractiveGridBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  gridSize?: number;
  gridColor?: string;
  darkGridColor?: string;
  effectColor?: string;
  darkEffectColor?: string;
  trailLength?: number;
  width?: number;
  height?: number;
  idleSpeed?: number;
  glow?: boolean;
  glowRadius?: number;
  children?: React.ReactNode;
  showFade?: boolean;
  fadeIntensity?: number;
  idleRandomCount?: number;
}

const InteractiveGridBackground: React.FC<InteractiveGridBackgroundProps> = ({
  gridSize = 50,
  gridColor = '#e2e8f0',
  darkGridColor = '#303040',
  effectColor = 'rgba(99, 102, 241, 0.5)',
  darkEffectColor = 'rgba(165, 180, 252, 0.5)',
  trailLength = 4,
  width,
  height,
  idleSpeed = 0.2,
  glow = true,
  glowRadius = 20,
  children,
  showFade = true,
  fadeIntensity = 15,
  idleRandomCount = 4,
  className,
  style,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const idleTargetsRef = useRef<{ x: number; y: number }[]>([]);
  const idlePositionsRef = useRef<{ x: number; y: number }[]>([]);
  const lastMouseTimeRef = useRef(Date.now());

  useEffect(() => {
    const update = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      if (rawX < 0 || rawY < 0 || rawX > rect.width || rawY > rect.height) return;
      lastMouseTimeRef.current = Date.now();
      const snappedX = Math.floor(rawX / gridSize);
      const snappedY = Math.floor(rawY / gridSize);
      const last = trailRef.current[0];
      if (!last || last.x !== snappedX || last.y !== snappedY) {
        trailRef.current.unshift({ x: snappedX, y: snappedY });
        if (trailRef.current.length > trailLength) trailRef.current.pop();
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [gridSize, trailLength]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = width || container.offsetWidth || window.innerWidth;
    const canvasHeight = height || container.offsetHeight || window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const cols = Math.floor(canvasWidth / gridSize);
    const rows = Math.floor(canvasHeight / gridSize);
    const lineColor = isDarkMode ? darkGridColor : gridColor;
    const glowColor = isDarkMode ? darkEffectColor : effectColor;

    idleTargetsRef.current = Array.from({ length: idleRandomCount }, () => ({
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows),
    }));
    idlePositionsRef.current = idleTargetsRef.current.map((p) => ({ ...p }));

    let rafId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      for (let x = 0; x <= canvasWidth; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasHeight); ctx.stroke();
      }
      for (let y = 0; y <= canvasHeight; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasWidth, y); ctx.stroke();
      }

      if (Date.now() - lastMouseTimeRef.current > 2000) {
        idlePositionsRef.current.forEach((pos, i) => {
          const target = idleTargetsRef.current[i];
          const dx = target.x - pos.x;
          const dy = target.y - pos.y;
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
            idleTargetsRef.current[i] = {
              x: Math.floor(Math.random() * cols),
              y: Math.floor(Math.random() * rows),
            };
          } else {
            pos.x += dx * idleSpeed;
            pos.y += dy * idleSpeed;
          }
          const rx = Math.round(pos.x);
          const ry = Math.round(pos.y);
          const last = trailRef.current[0];
          if (!last || last.x !== rx || last.y !== ry) {
            trailRef.current.unshift({ x: rx, y: ry });
            if (trailRef.current.length > trailLength * idleRandomCount) trailRef.current.pop();
          }
        });
      }

      trailRef.current.forEach((cell, idx) => {
        const alpha = 1 - idx * (1 / (trailLength + 1));
        const rgbaColor = glowColor.replace(/[\d.]+\)$/, `${alpha})`);
        ctx.fillStyle = rgbaColor;
        if (glow) { ctx.shadowColor = rgbaColor; ctx.shadowBlur = glowRadius; }
        else { ctx.shadowBlur = 0; }
        ctx.fillRect(cell.x * gridSize, cell.y * gridSize, gridSize, gridSize);
      });

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [gridSize, width, height, gridColor, darkGridColor, effectColor, darkEffectColor, isDarkMode, trailLength, idleSpeed, glow, glowRadius, idleRandomCount]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className ?? ''}`}
      style={{ width: width ?? '100%', height: height ?? '100%', ...style }}
      {...props}
    >
      <canvas ref={canvasRef} className="absolute top-0 left-0 z-0 pointer-events-none" />
      {showFade && (
        <div
          className="pointer-events-none absolute inset-0 bg-[#FAFBFF] dark:bg-slate-950"
          style={{
            maskImage: `radial-gradient(ellipse at center, transparent ${fadeIntensity}%, #FAFBFF)`,
            WebkitMaskImage: `radial-gradient(ellipse at center, transparent ${fadeIntensity}%, #FAFBFF)`,
          }}
        />
      )}
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
};

export default InteractiveGridBackground;
