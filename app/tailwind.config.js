/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        charm: ['Charm', 'cursive'],
        serif: ['Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Editor neutral palette (Inverted for Light Theme)
        surface: {
          50: 'hsl(var(--surface-50))',
          100: 'hsl(var(--surface-100))',
          200: 'hsl(var(--surface-200))',
          300: 'hsl(var(--surface-300))',
          400: 'hsl(var(--surface-400))',
          500: 'hsl(var(--surface-500))',
          600: 'hsl(var(--surface-600))',
          700: 'hsl(var(--surface-700))',
          800: 'hsl(var(--surface-800))',
          850: 'hsl(var(--surface-850))',
          900: 'hsl(var(--surface-900))',
          950: 'hsl(var(--surface-950))',
        },
        // Accent (Forest Green matching theme)
        accent: {
          50: 'hsl(142, 100%, 97%)',
          100: 'hsl(142, 100%, 94%)',
          200: 'hsl(142, 96%, 88%)',
          300: 'hsl(142, 94%, 78%)',
          400: 'hsl(142, 90%, 65%)',
          500: 'hsl(142, 84%, 55%)',
          600: 'hsl(142, 82%, 48%)',
          700: 'hsl(142, 80%, 40%)',
          800: 'hsl(142, 76%, 32%)',
          900: 'hsl(142, 70%, 26%)',
        },
        // Success
        success: {
          400: 'hsl(142, 70%, 50%)',
          500: 'hsl(142, 68%, 42%)',
        },
        // Warning
        warning: {
          400: 'hsl(38, 95%, 58%)',
          500: 'hsl(38, 92%, 50%)',
        },
        // Danger
        danger: {
          400: 'hsl(0, 80%, 60%)',
          500: 'hsl(0, 76%, 52%)',
        },
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'slide-in-left': 'slideInLeft 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideInRight: {
          from: { transform: 'translateX(20px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-20px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
}
