/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      colors: {
        obsidian: '#0c0b0a',
        vault: {
          bg: 'var(--cv-bg)',
          surface: 'var(--cv-surface)',
          elevated: 'var(--cv-surface-elevated)',
          text: 'var(--cv-text)',
          muted: 'var(--cv-text-muted)',
          subtle: 'var(--cv-text-subtle)',
          accent: 'var(--cv-accent)',
          accentStrong: 'var(--cv-accent-strong)',
        },
      },
      boxShadow: {
        vault: 'var(--cv-shadow)',
        glow: 'var(--cv-glow)',
      },
    },
  },
  plugins: [],
};
