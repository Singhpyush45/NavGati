/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Newsreader"', 'Georgia', 'serif'],
      },
      colors: {
        // Semantic tokens driven by CSS variables (light/dark aware)
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        sunken: 'rgb(var(--sunken) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        tide: 'rgb(var(--tide) / <alpha-value>)',
        tide2: 'rgb(var(--tide-2) / <alpha-value>)',
        violet: 'rgb(var(--violet) / <alpha-value>)',
        tideSoft: 'rgb(var(--tide-soft) / <alpha-value>)',
        signal: 'rgb(var(--signal) / <alpha-value>)',
        alert: 'rgb(var(--alert) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
      },
      borderRadius: { panel: '20px' },
    },
  },
  plugins: [],
};
