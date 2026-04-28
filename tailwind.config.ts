import type { Config } from 'tailwindcss'

/**
 * Color palette inspired by Hokusai's "The Great Wave off Kanagawa"
 *
 * The woodblock print uses a distinctive palette:
 * - Prussian blue (imported pigment, revolutionary for the era)
 * - Indigo (traditional Japanese ai-iro)
 * - Cream/off-white (washi paper tone)
 * - Foam white (wave crests)
 * - Deep navy (ocean depths)
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wave: {
          // Deep ocean tones
          deepest: '#0a0f1e',
          deep: '#0f1a2e',
          prussian: '#1a3050',
          indigo: '#2d4a6e',

          // Mid tones
          steel: '#4a6d8c',
          slate: '#6b8eb4',

          // Light / foam tones
          crest: '#c8dce8',
          foam: '#dce8f0',
          spray: '#eef4f8',
          cream: '#f5efe0',

          // Accent — the warm tones from the print
          sand: '#c4a86c',
          bark: '#8b6f47',
          fuji: '#e8dcc8',
        },

        // Keep ocean as an alias for backward compat in components
        ocean: {
          50: '#eef4f8',
          100: '#dce8f0',
          200: '#c8dce8',
          300: '#9bbdd4',
          400: '#6b8eb4',
          500: '#4a6d8c',
          600: '#2d4a6e',
          700: '#1a3050',
          800: '#0f1a2e',
          900: '#0a0f1e',
          950: '#060a14',
        },

        dory: {
          blue: '#2d4a6e',
          dark: '#0a0f1e',
          deeper: '#060a14',
          glow: '#c8dce8',
          sand: '#f5efe0',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'ocean-gradient': 'linear-gradient(180deg, #0a0f1e 0%, #0f1a2e 30%, #1a3050 60%, #142640 100%)',
        'card-glow': 'radial-gradient(ellipse at center, rgba(200, 220, 232, 0.1) 0%, transparent 70%)',
      },
      boxShadow: {
        'card': '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 6px rgba(45, 74, 110, 0.15)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(107, 142, 180, 0.2)',
        'glow': '0 0 20px rgba(107, 142, 180, 0.25)',
        'wave': '0 0 20px rgba(45, 74, 110, 0.4)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'sway': 'sway 8s ease-in-out infinite',
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
          '0%, 100%': { boxShadow: '0 0 10px rgba(107, 142, 180, 0.15)' },
          '50%': { boxShadow: '0 0 25px rgba(107, 142, 180, 0.35)' },
        },
        sway: {
          '0%, 100%': { transform: 'translateX(0) rotate(0deg)' },
          '25%': { transform: 'translateX(3px) rotate(0.5deg)' },
          '75%': { transform: 'translateX(-3px) rotate(-0.5deg)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
