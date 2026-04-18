/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dive: {
          bg: '#000000',
          panel: '#26282D',
          accent: '#14AA32',
          'accent-dark': '#003C1E',
          muted: '#96969B',
          beige: '#E6D2A0',
          lynx: '#F7F7F7',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'Inter', 'sans-serif'],
        display: ['Tomorrow', '"Noto Sans JP"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
