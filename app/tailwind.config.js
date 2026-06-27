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
        sans: ['Charm', 'cursive'],
        serif: ['Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Editor neutral palette (Inverted for Light Theme)
        surface: {
          50: 'hsl(226, 24%, 7%)',     // Previously 950 (Darkest)
          100: 'hsl(224, 20%, 10%)',   // Previously 900
          200: 'hsl(222, 16%, 14%)',   // Previously 850
          300: 'hsl(220, 14%, 18%)',   // Previously 800
          400: 'hsl(220, 12%, 26%)',   // Previously 700
          500: 'hsl(220, 10%, 36%)',   // Previously 600
          600: 'hsl(220, 8%, 48%)',    // Previously 500
          700: 'hsl(220, 8%, 65%)',    // Previously 400
          800: 'hsl(220, 10%, 82%)',   // Previously 300
          850: 'hsl(220, 12%, 90%)',   // Previously 200
          900: 'hsl(220, 15%, 95%)',   // Previously 100
          950: 'hsl(220, 20%, 98%)',   // Previously 50 (Lightest - Backgrounds)
        },
        // Accent (Light blue matching screenshot)
        accent: {
          50: 'hsl(214, 100%, 97%)',
          100: 'hsl(214, 100%, 94%)',
          200: 'hsl(214, 96%, 88%)',
          300: 'hsl(214, 94%, 78%)',
          400: 'hsl(214, 90%, 65%)',
          500: 'hsl(214, 84%, 55%)',
          600: 'hsl(214, 82%, 48%)',
          700: 'hsl(214, 80%, 40%)',
          800: 'hsl(214, 76%, 32%)',
          900: 'hsl(214, 70%, 26%)',
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
