/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.js'],
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#F8FAFC',
          card: '#FFFFFF',
          muted: '#F1F5F9',
          border: '#E2E8F0',
          borderDark: '#CBD5E1',
        },
        brand: {
          emerald: '#059669',
          emeraldLight: '#D1FAE5',
          emeraldDark: '#047857',
          gold: '#D97706',
          goldLight: '#FEF3C7',
          goldDark: '#B45309',
          navy: '#0F172A',
          slate: '#475569',
        },
      },
      fontFamily: {
        sans: ['Prompt', 'Sarabun', 'sans-serif'],
        mono: ['Chakra Petch', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 10px -1px rgba(15, 23, 42, 0.05), 0 1px 3px -1px rgba(15, 23, 42, 0.03)',
        elevated: '0 10px 25px -4px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03)',
        emeraldGlow: '0 4px 14px 0 rgba(5, 150, 105, 0.18)',
      },
    },
  },
  plugins: [],
};
