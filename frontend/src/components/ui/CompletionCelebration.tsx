import { useEffect, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface Props {
  score: number;
  onDone: () => void;
}

const LETTERS = ['C', 'o', 'm', 'p', 'l', 'e', 't', 'e', 'd', '!'];

export function CompletionCelebration({ score, onDone }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation on next frame
    const t1 = setTimeout(() => setVisible(true), 50);
    // Auto-advance to results after 3.2 s
    const t2 = setTimeout(onDone, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scoreLabel =
    score >= 80 ? '🌟 Excellent!' : score >= 60 ? '👍 Good job!' : '💪 Keep it up!';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-violet-900/95 via-brand-900/95 to-indigo-900/95 backdrop-blur-sm">
      {/* Lottie animation */}
      <div className="w-72 h-72 sm:w-96 sm:h-96">
        <DotLottieReact
          src="https://lottie.host/1d76a0ef-c763-4854-8eab-401f16c97129/K66ImHLcg8.lottie"
          loop
          autoplay
        />
      </div>

      {/* Animated letter-by-letter "Completed!" text */}
      <div className="flex gap-0.5 sm:gap-1 mt-2">
        {LETTERS.map((letter, i) => (
          <span
            key={i}
            className="text-4xl sm:text-6xl font-extrabold text-white drop-shadow-lg"
            style={{
              display: 'inline-block',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.5)',
              transition: `opacity 0.4s ease ${i * 0.06}s, transform 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.06}s`,
            }}
          >
            {letter}
          </span>
        ))}
      </div>

      {/* Score badge */}
      <div
        className="mt-5 text-lg sm:text-2xl font-bold text-white/90"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.5s ease 0.8s, transform 0.5s ease 0.8s',
        }}
      >
        {scoreLabel} &nbsp; <span className="text-yellow-300">{score}%</span>
      </div>

      {/* Skip hint */}
      <button
        onClick={onDone}
        className="mt-8 text-sm text-white/50 hover:text-white/80 transition-colors"
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.5s ease 1.2s',
        }}
      >
        Tap to continue →
      </button>
    </div>
  );
}
