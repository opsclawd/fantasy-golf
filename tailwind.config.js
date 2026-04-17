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
    },
  },
  plugins: [],
}
