/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        primary: 'var(--color-primary)',
        'primary-fg': 'var(--color-primary-fg)',
        secondary: 'var(--color-secondary)',
        'secondary-fg': 'var(--color-secondary-fg)',
        accent: 'var(--color-accent)',
        'accent-fg': 'var(--color-accent-fg)',
        muted: 'var(--color-muted)',
        'muted-fg': 'var(--color-muted-fg)',
        'neon-green': '#00ff9d',
      },
      animation: {
        'blob': "blob 10s infinite",
        'float': "float 6s ease-in-out infinite",
        'pulse-slow': "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.2)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.8)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        }
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
