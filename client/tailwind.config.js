/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0B0F',
        surface: '#15151D',
        primary: '#7C3AED',
        secondary: '#3B82F6',
        accent: '#F43F5E',
        text: '#F8FAFC',
        muted: '#94A3B8',
        border: 'rgba(255, 255, 255, 0.1)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        hi: ['"Noto Sans Devanagari"', 'Inter', 'sans-serif'],
        gu: ['"Noto Sans Gujarati"', 'Inter', 'sans-serif'],
        ta: ['"Noto Sans Tamil"', 'Inter', 'sans-serif'],
        te: ['"Noto Sans Telugu"', 'Inter', 'sans-serif'],
        bn: ['"Noto Sans Bengali"', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
      }
    },
  },
  plugins: [],
}
