import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Vibrant indigo/violet matches HSL(258, 87%, 62%) primary from the design system
        brand: {
          50:  '#f5f0ff',
          100: '#ece0ff',
          200: '#dac4ff',
          300: '#c19eff',
          400: '#a575fa',
          500: '#8a4cf2',
          600: '#7430e3',
          700: '#6321c5',
          800: '#521c9f',
          900: '#421879',
          950: '#260c4d',
        },
        // Accent vibrant orange (HSL 28 95% 58%) for action highlights
        accent: {
          50:  '#fff5ec',
          100: '#ffe6cf',
          200: '#ffc89a',
          300: '#ffa55c',
          400: '#fb8530',
          500: '#f56a1d',
          600: '#dc5414',
          700: '#b54015',
          800: '#923418',
          900: '#762d16',
        },
        // Claymorphism design tokens — pillowy playful UI
        clay: {
          bg:     '#FAF1E4',  // cream background
          ink:    '#1F2937',  // dark outline + text
          green:  '#22C55E',  // primary CTA
          'green-dark': '#16A34A',
          coral:  '#FECACA',
          'coral-strong': '#FCA5A5',
          sky:    '#BAE6FD',
          mint:   '#BBF7D0',
          yellow: '#FDE68A',
          purple: '#DDD6FE',
          pink:   '#FBCFE8',
        },
      },
      boxShadow: {
        'clay':         '6px 6px 0 0 #1F2937',
        'clay-lg':      '8px 8px 0 0 #1F2937',
        'clay-sm':      '3px 3px 0 0 #1F2937',
        'clay-pressed': '2px 2px 0 0 #1F2937',
      },
      borderWidth: {
        '2.5': '2.5px',
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'marquee':  'marquee 40s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
    },
  },
  plugins: [],
};

export default config;
