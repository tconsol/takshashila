import { useEffect, useState } from 'react';

const KEY = 'bbedu-cookie-choice';

type Choice = 'all' | 'necessary';

function readChoice(): Choice | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'all' || v === 'necessary' ? v : null;
  } catch {
    return null;
  }
}

/**
 * First-visit cookie notice with a real choice. It sits outside the router, so
 * it uses plain anchors. Storage may be blocked; the site works without it.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readChoice() === null);
  }, []);

  if (!visible) return null;

  const choose = (choice: Choice) => {
    try {
      window.localStorage.setItem(KEY, choice);
    } catch {
      /* private mode: just hide it for this visit */
    }
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <p className="text-sm text-slate-700 dark:text-slate-200">
        We use cookies and browser storage to keep you signed in and remember your preferences. Payment, video and
        sign-in providers may also set their own. Read our{' '}
        <a href="/cookies" className="font-semibold text-brand-600 underline">Cookie Policy</a> and{' '}
        <a href="/privacy" className="font-semibold text-brand-600 underline">Privacy Policy</a>.
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          onClick={() => choose('necessary')}
          className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Necessary only
        </button>
        <button
          onClick={() => choose('all')}
          className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
