import { motion } from 'framer-motion';

const COLORS = ['#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15', '#22d3ee'];

interface ConfettiProps {
  count?: number;
  origin?: 'center' | 'top';
}

export function Confetti({ count = 28, origin = 'center' }: ConfettiProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 100 }}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
        const distance = 100 + Math.random() * 120;
        const size = 6 + Math.random() * 6;
        const startTop = origin === 'top' ? '0%' : '50%';
        const isSquare = i % 2 === 0;
        return (
          <motion.div
            key={i}
            className={`absolute left-1/2 ${isSquare ? 'rounded-sm' : 'rounded-full'}`}
            style={{
              top: startTop,
              width: size,
              height: size,
              background: COLORS[i % COLORS.length],
              boxShadow: `0 0 10px ${COLORS[i % COLORS.length]}`,
            }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance - (origin === 'top' ? -40 : 30),
              opacity: 0,
              rotate: 360 + Math.random() * 360,
              scale: [0, 1, 0.8],
            }}
            transition={{
              duration: 0.9 + Math.random() * 0.4,
              ease: 'easeOut',
            }}
          />
        );
      })}
    </div>
  );
}

export function ScorePop({ value, color = 'text-yellow-300' }: { value: string; color?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 0, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], y: -60, scale: 1.2 }}
      transition={{ duration: 1, ease: 'easeOut' }}
      className={`absolute left-1/2 -translate-x-1/2 top-1/2 text-3xl font-black ${color} pointer-events-none`}
      style={{ textShadow: '0 0 12px currentColor', zIndex: 50 }}
    >
      {value}
    </motion.div>
  );
}
