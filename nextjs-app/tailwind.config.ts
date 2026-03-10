import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        border: 'var(--border)',
        surface: 'var(--surface)',
        'surface-light': 'var(--surface-light)',
        'surface-hover': '#3f3f46',
        primary: 'var(--primary)',
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        destructive: 'var(--destructive)',
        danger: '#ef4444',
        success: '#22c55e',
        warning: '#eab308',
        secondary: { DEFAULT: '#1a1a2e', foreground: '#d4d4d8' },
        work: {
          DEFAULT: '#3b82f6',
          light: '#60a5fa',
          dark: '#1d4ed8',
          bg: 'rgba(59, 130, 246, 0.1)',
        },
        learn: {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
          dark: '#d97706',
          bg: 'rgba(245, 158, 11, 0.1)',
        },
        business: {
          DEFAULT: '#10b981',
          light: '#34d399',
          dark: '#059669',
          bg: 'rgba(16, 185, 129, 0.1)',
        },
        personal: {
          DEFAULT: '#8b5cf6',
          light: '#a78bfa',
          dark: '#7c3aed',
          bg: 'rgba(139, 92, 246, 0.1)',
        },
      },
      animation: {
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
