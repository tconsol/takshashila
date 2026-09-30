import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export interface MobileNavLink {
  label: string;
  /** A route ("/tutors") or an in-page anchor ("#features"). */
  to: string;
}

/**
 * The public top bar hides its links below the "md" breakpoint. This button takes their
 * place on phones and tablets in portrait so those pages stay reachable. It closes on a
 * link press, on Escape and on a press outside.
 */
export function MobileNavMenu({ links }: { links: MobileNavLink[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onPress = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPress);
    document.addEventListener('touchstart', onPress);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPress);
      document.removeEventListener('touchstart', onPress);
    };
  }, [open]);

  const itemClass =
    'block rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600';

  return (
    // Not "relative" on purpose: the panel positions itself against the (sticky) header, so it
    // spans the bar's width on any phone instead of hanging off the small button.
    <div ref={wrapRef} className="md:hidden">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-nav-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          id="mobile-nav-menu"
          className="absolute inset-x-4 top-full z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg sm:inset-x-6"
        >
          {links.map((l) =>
            l.to.startsWith('#') ? (
              <a key={l.label} href={l.to} onClick={() => setOpen(false)} className={itemClass}>{l.label}</a>
            ) : (
              <Link key={l.label} to={l.to} onClick={() => setOpen(false)} className={itemClass}>{l.label}</Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}
