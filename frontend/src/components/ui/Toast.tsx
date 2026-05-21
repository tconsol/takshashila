import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration: number;
}

interface ToastContextValue {
  toast: (opts: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ICONS: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 className="h-[18px] w-[18px] text-emerald-500 shrink-0" />,
  error: <XCircle className="h-[18px] w-[18px] text-red-500 shrink-0" />,
  warning: <AlertTriangle className="h-[18px] w-[18px] text-amber-500 shrink-0" />,
  info: <Info className="h-[18px] w-[18px] text-blue-500 shrink-0" />,
};

const ACCENT: Record<ToastVariant, { bar: string; tint: string }> = {
  success: { bar: 'bg-clay-green',  tint: 'bg-clay-mint' },
  error:   { bar: 'bg-rose-500',    tint: 'bg-clay-coral' },
  warning: { bar: 'bg-amber-500',   tint: 'bg-clay-yellow' },
  info:    { bar: 'bg-sky-500',     tint: 'bg-clay-sky' },
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: (id: string) => void }) {
  const [progress, setProgress] = useState(100);
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dismiss = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(() => onClose(item.id), 280);
  }, [item.id, leaving, onClose]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));

    const tickMs = 40;
    const step = 100 / (item.duration / tickMs);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        const next = p - step;
        if (next <= 0) {
          clearInterval(timerRef.current!);
          dismiss();
          return 0;
        }
        return next;
      });
    }, tickMs);

    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { bar, tint } = ACCENT[item.variant];

  return (
    <div
      className={cn(
        'pointer-events-auto w-80 overflow-hidden rounded-2xl border-2.5 border-clay-ink bg-white shadow-clay dark:bg-gray-900',
        'transition-all duration-300 ease-out',
        mounted && !leaving ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-12 opacity-0 scale-95',
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className={cn('mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border-2 border-clay-ink', tint)}>
          {ICONS[item.variant]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-clay-ink dark:text-white leading-snug">
            {item.title}
          </p>
          {item.description && (
            <p className="mt-0.5 text-xs font-semibold text-clay-ink/70 dark:text-gray-400 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border-2 border-clay-ink bg-white text-clay-ink hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[4px] w-full border-t-2 border-clay-ink bg-clay-bg">
        <div
          className={cn('h-full transition-none', bar)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (opts: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev.slice(-4), { ...opts, id, duration: opts.duration ?? 3500 }]);
    },
    [],
  );

  const ctx: ToastContextValue = {
    toast: add,
    success: (title, description) => add({ variant: 'success', title, description }),
    error: (title, description) => add({ variant: 'error', title, description }),
    warning: (title, description) => add({ variant: 'warning', title, description }),
    info: (title, description) => add({ variant: 'info', title, description }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onClose={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
