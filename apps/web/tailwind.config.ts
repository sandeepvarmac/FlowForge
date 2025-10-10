import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Background colors - using brand secondary colors
        background: {
          DEFAULT: '#f8fafc', // Light gray background
          secondary: '#ffffff', // Pure white for cards/surfaces
          tertiary: '#f1f5f9', // Slightly darker gray for elevated surfaces
          dark: '#000000', // Brand black for dark mode
          'dark-secondary': '#49494c', // Brand dark gray for cards
          'dark-tertiary': '#49494c' // Brand dark gray for elevated surfaces
        },
        foreground: {
          DEFAULT: '#000000', // Brand black for text
          secondary: '#49494c', // Brand dark gray for secondary text
          muted: '#64748b', // Muted text
          dark: '#f8fafc', // Light text on dark background
          'dark-secondary': '#cbd5e1', // Dark mode secondary text
          'dark-muted': '#94a3b8' // Dark mode muted text
        },
        // Primary accent: Brand blue gradient (#003ad3 → #1ca3ff)
        primary: {
          50: '#e6f0ff',
          100: '#cce0ff',
          200: '#99c2ff',
          300: '#66a3ff',
          400: '#3385ff',
          500: '#0075d4', // Brand bright blue
          600: '#003ad3', // Brand deep blue (primary)
          700: '#0030ab',
          800: '#002582',
          900: '#001a5a',
          DEFAULT: '#0075d4'
        },
        // Secondary accent: Brand light blue
        secondary: {
          50: '#e6f5ff',
          100: '#ccebff',
          200: '#99d6ff',
          300: '#66c2ff',
          400: '#33adff',
          500: '#1ca3ff', // Brand light blue
          600: '#008cd9', // Brand sky blue
          700: '#0075d4', // Brand bright blue
          800: '#005fa8',
          900: '#00497d',
          DEFAULT: '#1ca3ff'
        },
        // Brand accent colors
        accent: {
          orange: '#eb6510', // Brand orange
          yellow: '#ffc124', // Brand yellow
          DEFAULT: '#eb6510'
        },
        // Status colors using brand accents
        success: {
          DEFAULT: '#059669',
          foreground: '#ecfdf5',
          dark: '#10b981'
        },
        warning: {
          DEFAULT: '#ffc124', // Brand yellow for warnings
          foreground: '#fffbeb',
          dark: '#eb6510' // Brand orange for dark mode
        },
        error: {
          DEFAULT: '#dc2626',
          foreground: '#fef2f2',
          dark: '#ef4444'
        },
        // Border and ring colors using brand palette
        border: {
          DEFAULT: '#e2e8f0',
          secondary: '#cbd5e1',
          dark: '#49494c', // Brand dark gray
          'dark-secondary': '#49494c'
        },
        ring: '#0075d4' // Brand bright blue
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'corporate': 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        'corporate-dark': 'linear-gradient(135deg, #000000 0%, #49494c 100%)',
        'brand-gradient': 'linear-gradient(135deg, #003ad3 0%, #0075d4 50%, #1ca3ff 100%)', // Brand blue gradient
        'brand-gradient-subtle': 'linear-gradient(135deg, #e6f0ff 0%, #e6f5ff 100%)' // Subtle brand gradient
      },
      boxShadow: {
        'corporate': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'corporate-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'corporate-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'brand': '0 4px 12px 0 rgba(0, 58, 211, 0.15)', // Brand blue shadow
        'brand-lg': '0 10px 25px -5px rgba(0, 58, 211, 0.2)' // Brand blue large shadow
      }
    }
  },
  plugins: []
} satisfies Config

