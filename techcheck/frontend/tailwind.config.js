/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#1e6fd9',
          700: '#1558b0',
          800: '#1e40af',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
