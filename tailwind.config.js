/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // New HourWise Brand Colors
        'hw': {
          'navy-950': 'var(--hw-navy-950)',
          'navy-900': 'var(--hw-navy-900)',
          'navy-800': 'var(--hw-navy-800)',
          'blue-700': 'var(--hw-blue-700)',
          'blue-600': 'var(--hw-blue-600)',
          'cyan-500': 'var(--hw-cyan-500)',
          'teal-500': 'var(--hw-teal-500)',
          'green-500': 'var(--hw-green-500)',
          'amber-500': 'var(--hw-amber-500)',
          'red-500': 'var(--hw-red-500)',
          'slate-50': 'var(--hw-slate-50)',
          'slate-100': 'var(--hw-slate-100)',
          'slate-300': 'var(--hw-slate-300)',
          'slate-500': 'var(--hw-slate-500)',
          'white': 'var(--hw-white)',
        },
        // Legacy Brand Mapping (Redirecting to new colors for compatibility)
        'brand-dark': 'var(--hw-navy-950)',
        'brand-card': 'var(--hw-navy-900)',
        'brand-accent': 'var(--hw-blue-600)',
        'brand-accent-dark': 'var(--hw-blue-700)',
        'brand-border': 'var(--hw-navy-800)',
        'compliance-success': 'var(--hw-green-500)',
        'compliance-warning': 'var(--hw-amber-500)',
        'compliance-danger': 'var(--hw-red-500)',
        'compliance-info': 'var(--hw-cyan-500)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
