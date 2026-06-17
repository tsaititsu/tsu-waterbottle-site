import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        deepPurple: '#3B0F75',
        purpleMain: '#5B21B6',
        lightPurple: '#EDE7F6',
        softPurple: '#F7F3FF',
        gold: '#C89B3C',
        lightGold: '#F2E4C4',
        darkGold: '#8A6A2A',
        textDark: '#1F1B2E',
        textMuted: '#6B6678',
        borderSoft: '#E6E1EE',
        bgGray: '#F7F7FA',
        lineGreen: '#06C755'
      },
      boxShadow: {
        soft: '0 8px 24px rgba(31, 27, 46, 0.08)'
      },
      fontFamily: {
        serifTC: ['Noto Serif TC', 'serif'],
        sansTC: ['Inter', 'Noto Sans TC', 'sans-serif']
      }
    }
  },
  plugins: []
}

export default config
