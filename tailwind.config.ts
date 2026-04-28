import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#e6f4f9',
          100: '#c0e3f1',
          200: '#96d1e8',
          300: '#6bbfdf',
          400: '#4bb1d8',
          500: '#2ba3d1',
          600: '#2695c4',
          700: '#1f82b2',
          800: '#1970a0',
          900: '#0d5082',
          950: '#062d4f',
        },
        dory: {
          blue: '#1a6fb5',
          dark: '#0a1628',
          deeper: '#060f1d',
          glow: '#4fc3f7',
          sand: '#f5e6c8',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'ocean-gradient': 'linear-gradient(180deg, #0a1628 0%, #0d2847 40%, #1a4a6e 70%, #2d6a8e 100%)',
        'card-glow': 'radial-gradient(ellipse at center, rgba(79, 195, 247, 0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'card': '0 4px 12px rgba(0, 0, 0, 0.4), 0 0 8px rgba(79, 195, 247, 0.1)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(79, 195, 247, 0.25)',
        'glow': '0 0 20px rgba(79, 195, 247, 0.3)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(79, 195, 247, 0.2)' },
          '50%': { boxShadow: '0 0 25px rgba(79, 195, 247, 0.5)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
