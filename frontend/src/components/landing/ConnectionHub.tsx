import { GraduationCap, Users, Heart, Building2, Headphones, BookOpen } from 'lucide-react';

interface Node {
  label: string;
  Icon: typeof Users;
  x: number; // % position in container
  y: number;
  color: string; // icon bg/text
}

const NODES: Node[] = [
  { label: 'Students', Icon: BookOpen, x: 8, y: 16, color: 'bg-indigo-50 text-indigo-600' },
  { label: 'Tutors', Icon: GraduationCap, x: 8, y: 84, color: 'bg-amber-50 text-amber-600' },
  { label: 'Parents', Icon: Heart, x: 92, y: 16, color: 'bg-rose-50 text-rose-500' },
  { label: 'Principals', Icon: Building2, x: 92, y: 84, color: 'bg-teal-50 text-teal-600' },
  { label: 'Classmates', Icon: Users, x: 50, y: 4, color: 'bg-violet-50 text-violet-600' },
  { label: 'Support', Icon: Headphones, x: 50, y: 96, color: 'bg-sky-50 text-sky-600' },
];

/** Magic-UI-style animated beams radiating from a central hub to each role node. */
export function ConnectionHub() {
  return (
    <div className="relative mx-auto aspect-[16/10] w-full max-w-3xl">
      {/* Beams (SVG behind nodes) */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a5b4fc" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#c4b5fd" />
          </linearGradient>
        </defs>
        {NODES.map((n, i) => (
          <line
            key={n.label}
            x1="50" y1="50" x2={n.x} y2={n.y}
            stroke="url(#beamGrad)"
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeDasharray="4 6"
            style={{ animation: `beam-dash 3s linear infinite`, animationDelay: `${i * 0.25}s` }}
            opacity="0.85"
          />
        ))}
      </svg>

      {/* Center hub */}
      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-xl shadow-indigo-500/30">
          <span className="absolute inset-0 animate-ping rounded-3xl bg-indigo-500/30" style={{ animationDuration: '2.5s' }} />
          <GraduationCap className="relative h-11 w-11 text-white" />
        </div>
        <p className="mt-2 text-center text-sm font-extrabold text-slate-900">brainbaseedu</p>
      </div>

      {/* Role nodes */}
      {NODES.map((n) => (
        <div
          key={n.label}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-900/5 bg-white shadow-md`}>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${n.color}`}>
                <n.Icon className="h-5 w-5" />
              </span>
            </div>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-slate-700 shadow-sm">{n.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ConnectionHub;
