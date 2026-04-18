import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dive: {
          bg: '#0b0d10',
          panel: '#14181d',
          accent: '#c7f000',
          muted: '#8a9099',
        },
      },
    },
  },
  plugins: [],
};
export default config;
