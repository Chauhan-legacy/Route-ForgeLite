/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aerospace: {
          950: '#040711',
          900: '#080d1e',
          850: '#0d142e',
          800: '#131e42',
          750: '#1a2856',
          700: '#223572',
          600: '#2d4594',
        },
        cyan: {
          glow: '#00f2fe',
          neon: '#4facfe',
        },
        blue: {
          electric: '#2563eb',
          subtle: '#1e3a8a',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'aerospace': '0 8px 32px 0 rgba(0, 240, 255, 0.08), 0 0 0 1px rgba(0, 240, 255, 0.12)',
        'glow-cyan': '0 0 20px rgba(0, 242, 254, 0.35)',
        'glow-blue': '0 0 20px rgba(56, 189, 248, 0.25)',
      }
    },
  },
  plugins: [],
}

