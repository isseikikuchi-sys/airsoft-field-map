const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx,mdx}'),
    path.join(__dirname, 'src/app/**/*.{js,ts,jsx,tsx,mdx}'),
    path.join(__dirname, 'src/components/**/*.{js,ts,jsx,tsx,mdx}'),
  ],
  theme: {
    extend: {
      colors: {
        dive: {
          bg: '#FFFFFF',
          surface: '#F7F7F7',
          ink: '#0B0B0B',
          subtle: '#E5E7EB',
          accent: '#14AA32',
          'accent-dark': '#003C1E',
          muted: '#6B7280',
          panel: '#111111',
          beige: '#E6D2A0',
          lynx: '#F7F7F7',
          danger: '#C92A2A',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'Inter', 'sans-serif'],
        display: ['"Chakra Petch"', 'Tomorrow', '"Noto Sans JP"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
