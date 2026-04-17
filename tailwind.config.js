/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          900: '#14532d',
          700: '#15803d',
          100: '#dcfce7',
        },
        surface: {
          warm: '#fef3c7',
          base: '#fffbeb',
        },
        action: {
          warning: '#f59e0b',
          error: '#dc2626',
        },
        neutral: {
          900: '#1c1917',
          600: '#57534e',
          200: '#e7e5e4',
        },
      },
      spacing: {
        '1x': '0.5rem',
        '1.5x': '0.75rem',
        '2x': '1rem',
        '2.5x': '1.25rem',
        '3x': '1.5rem',
        '4x': '2rem',
        '5x': '2.5rem',
        '6x': '3rem',
        '8x': '4rem',
        '10x': '5rem',
        '12x': '6rem',
      },
    },
  },
  plugins: [],
}
