/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./templates/**/*.html', './static/*.js'],
  theme: {
    extend: {
      colors: {
        // Festive palette: deep pine night, cranberry, gold, snow.
        pine: { 950: '#06201a', 900: '#0b2e26', 800: '#124037', 700: '#1a5a4c' },
        cranberry: { 700: '#8f1d2c', 600: '#b02a3a', 500: '#d13b4a' },
        gold: { 300: '#ffe27a', 400: '#f9c94a', 500: '#e0a92c' },
        snow: { 50: '#fffdf6', 100: '#f7f3e8' },
      },
      fontFamily: {
        display: ['"Mountains of Christmas"', 'Georgia', 'serif'],
        body: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
