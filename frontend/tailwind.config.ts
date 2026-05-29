import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        accent: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Clay tokens remapped to modern LMS design — used throughout pages
        clay: {
          bg:           'rgb(var(--clay-bg) / <alpha-value>)',
          surface:      'rgb(var(--clay-surface) / <alpha-value>)',
          muted:        'rgb(var(--clay-muted) / <alpha-value>)',
          ink:          'rgb(var(--clay-ink) / <alpha-value>)',
          green:        'rgb(var(--clay-green) / <alpha-value>)',
          'green-dark': 'rgb(var(--clay-green-dark) / <alpha-value>)',
          coral:        'rgb(var(--clay-coral) / <alpha-value>)',
          'coral-strong':'rgb(var(--clay-coral-strong) / <alpha-value>)',
          sky:          'rgb(var(--clay-sky) / <alpha-value>)',
          mint:         'rgb(var(--clay-mint) / <alpha-value>)',
          yellow:       'rgb(var(--clay-yellow) / <alpha-value>)',
          purple:       'rgb(var(--clay-purple) / <alpha-value>)',
          pink:         'rgb(var(--clay-pink) / <alpha-value>)',
        },
      },
      boxShadow: {
        // Soft modern shadows (replaces hard clay offset shadows)
        'clay':         '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'clay-lg':      '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.06)',
        'clay-sm':      '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'clay-pressed': '0 0 0 0 transparent',
        // New utility shadows
        'card':         '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-hover':   '0 4px 12px -2px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        'sidebar':      '2px 0 8px 0 rgb(0 0 0 / 0.06)',
        'topbar':       '0 1px 0 0 rgb(226 232 240)',
      },
      borderWidth: {
        '2.5': '2.5px',
      },
      fontFamily: {
        sans:    ['Nunito', 'Outfit', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['Nunito', 'Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-in-out',
        'slide-up':   'slideUp 0.25s ease-out',
        'scale-in':   'scaleIn 0.2s ease-out',
        'marquee':    'marquee 40s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                                    to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(6px)', opacity: '0' },      to: { transform: 'translateY(0)', opacity: '1' } },
        scaleIn: { from: { transform: 'scale(0.97)', opacity: '0' },          to: { transform: 'scale(1)', opacity: '1' } },
        marquee: { from: { transform: 'translateX(0)' },                      to: { transform: 'translateX(-50%)' } },
      },
    },
  },
  plugins: [],
};

export default config;
