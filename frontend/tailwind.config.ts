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
