import type { Config } from 'tailwindcss';

/**
 * EDITORIAL CONSOLE
 *
 * Two things are happening here.
 *
 * 1. New semantic tokens (`paper`, `surface`, `ink`, `rule`, `accent`) drive the
 *    redesigned primitives and shell. Components reference roles, never hex.
 *
 * 2. The stock `slate` / `gray` / `indigo` ramps are *remapped* onto the same
 *    warm palette. Hundreds of existing class names across the app keep working
 *    and are pulled onto the new design without touching those files — a
 *    `text-slate-500` becomes warm grey, an `indigo-600` becomes vermilion.
 *    Screens are then refined individually rather than being unstyled meanwhile.
 */

const warm = {
  50:  '#FBFAF7',
  100: '#F4F2ED',
  200: '#E4DFD5',
  300: '#D0C9BC',
  400: '#B0A89C',
  500: '#8A8177',
  600: '#6B6459',
  700: '#514B42',
  800: '#332E28',
  900: '#1F1B16',
  950: '#12100D',
};

const vermilion = {
  50:  '#FDF0EB',
  100: '#FBDDD3',
  200: '#F4CEC2',
  300: '#EDA893',
  400: '#E3765A',
  500: '#D64520',
  600: '#B83919',
  700: '#962D13',
  800: '#74240F',
  900: '#551A0B',
  950: '#2E0E06',
};

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Semantic roles (preferred for all new work) ──────────────────
        paper:   token('paper'),
        surface: {
          DEFAULT: token('surface'),
          sunk:    token('surface-sunk'),
          hover:   token('surface-hover'),
        },
        ink: {
          DEFAULT: token('ink'),
          2:       token('ink-2'),
          muted:   token('ink-muted'),
          faint:   token('ink-faint'),
        },
        rule: {
          DEFAULT: token('rule'),
          strong:  token('rule-strong'),
        },
        accent: {
          DEFAULT: token('accent'),
          hover:   token('accent-hover'),
          ink:     token('accent-ink'),
          wash:    token('accent-wash'),
          edge:    token('accent-edge'),
          ...vermilion,
        },
        ok:     { DEFAULT: token('ok'),     wash: token('ok-wash') },
        warn:   { DEFAULT: token('warn'),   wash: token('warn-wash') },
        danger: { DEFAULT: token('danger'), wash: token('danger-wash') },
        info:   { DEFAULT: token('info'),   wash: token('info-wash') },

        // ── Remapped stock ramps, so legacy markup inherits the redesign ──
        slate: warm,
        gray: warm,
        stone: warm,
        neutral: warm,
        zinc: warm,
        indigo: vermilion,
        violet: vermilion,
        brand: vermilion,

        // Legacy clay-* aliases still referenced by older pages.
        clay: {
          bg:             token('paper'),
          surface:        token('surface'),
          muted:          token('ink-muted'),
          ink:            token('ink'),
          green:          token('accent'),
          'green-dark':   token('accent-hover'),
          coral:          token('accent-wash'),
          'coral-strong': token('accent'),
          sky:            token('info-wash'),
          mint:           token('ok-wash'),
          yellow:         token('warn-wash'),
          purple:         token('accent-wash'),
          pink:           token('accent-wash'),
        },
      },

      fontFamily: {
        sans:    ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        heading: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      /* Squared-off geometry. The old system was pillowy; this one is cut. */
      borderRadius: {
        none: '0',
        sm:   '2px',
        DEFAULT: '4px',
        md:   '5px',
        lg:   '6px',
        xl:   '8px',
        '2xl': '10px',
        '3xl': '14px',
      },

      boxShadow: {
        // Structure comes from hairlines; shadows are reserved for overlays.
        none:           'none',
        lift:           'var(--shadow-lift)',
        pop:            'var(--shadow-pop)',
        // Legacy names kept so old markup does not fall back to Tailwind's blue-grey.
        card:           'var(--shadow-lift)',
        'card-hover':   'var(--shadow-lift)',
        clay:           'var(--shadow-lift)',
        'clay-sm':      'var(--shadow-lift)',
        'clay-lg':      'var(--shadow-pop)',
        'clay-pressed': 'none',
        sidebar:        'none',
        topbar:         'none',
      },

      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.12em' }],
        xs:    ['11px', { lineHeight: '16px' }],
        sm:    ['13px', { lineHeight: '19px' }],
        base:  ['14px', { lineHeight: '21px' }],
        lg:    ['16px', { lineHeight: '23px' }],
        xl:    ['19px', { lineHeight: '26px' }],
        '2xl': ['24px', { lineHeight: '30px' }],
        '3xl': ['31px', { lineHeight: '36px' }],
        '4xl': ['40px', { lineHeight: '44px' }],
        '5xl': ['54px', { lineHeight: '56px' }],
        '6xl': ['70px', { lineHeight: '70px' }],
      },

      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },

      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'rise 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scaleIn 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
        'sweep-in': 'sweepIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        marquee:    'marquee 40s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        rise:    { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        sweepIn: { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
    },
  },
  plugins: [],
};

export default config;
