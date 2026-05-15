import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dashboard: {
          bg: '#e2e8f0',
          card: '#ffffff',
          border: '#cbd5e1',
          text: '#0f172a',
          muted: '#475569',
          success: '#16a34a',
          error: '#dc2626',
          accent: '#2563eb'
        },
      },
      boxShadow: {
        soft: '0 8px 24px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
