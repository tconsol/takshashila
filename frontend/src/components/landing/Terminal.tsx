import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

export type TermLine =
  | { type: 'cmd'; text: string }
  | { type: 'out'; text: string }
  | { type: 'ok'; text: string }
  | { type: 'muted'; text: string }
  | { type: 'gap' };

const lineColor: Record<string, string> = {
  cmd: 'text-slate-100',
  out: 'text-slate-400',
  ok: 'text-emerald-400',
  muted: 'text-slate-500',
};

/** Magic-UI-style fake terminal lines reveal sequentially when scrolled into view. */
export function Terminal({ lines, title = 'takshashila zsh', className = '' }: {
  lines: TermLine[];
  title?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (shown >= lines.length) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(lines.length); return; }
    const delay = lines[shown]?.type === 'cmd' ? 520 : 320;
    const id = setTimeout(() => setShown((s) => s + 1), delay);
    return () => clearTimeout(id);
  }, [inView, shown, lines]);

  return (
    <div
      ref={ref}
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#0b1020] shadow-2xl shadow-indigo-950/40 ${className}`}
    >
      {/* title bar */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-rose-400" />
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        <span className="h-3 w-3 rounded-full bg-emerald-400" />
        <span className="ml-3 text-xs font-medium text-slate-400">{title}</span>
      </div>

      {/* body */}
      <div className="space-y-1.5 p-5 font-mono text-[13px] leading-relaxed sm:text-sm" style={{ minHeight: `${lines.length * 1.9}rem` }}>
        {lines.slice(0, shown).map((l, i) =>
          l.type === 'gap' ? (
            <div key={i} className="h-2" />
          ) : (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={lineColor[l.type]}
            >
              {l.type === 'cmd' && <span className="mr-2 select-none text-indigo-400">❯</span>}
              {l.text}
              {l.type === 'cmd' && i === shown - 1 && (
                <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-indigo-400" />
              )}
            </motion.div>
          ),
        )}
      </div>
    </div>
  );
}

export default Terminal;
