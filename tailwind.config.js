/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-dark': '#0f172a',
        'brand-card': '#1e293b',
        'brand-accent': '#38bdf8', // A slightly lighter blue for web links/hovers
        'brand-accent-dark': '#0ea5e9',
        'brand-border': '#334155',
        'compliance-success': '#22c55e',
        'compliance-warning': '#facc15',
        'compliance-danger': '#ef4444',
        'compliance-info': '#60a5fa',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
