import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Cool gray and blue corporate theme
        background: {
          DEFAULT: '#f8fafc', // Light gray background
          secondary: '#ffffff', // Pure white for cards/surfaces
          tertiary: '#f1f5f9', // Slightly darker gray for elevated surfaces
          dark: '#1e293b', // Dark mode background
          'dark-secondary': '#334155', // Dark mode cards
          'dark-tertiary': '#475569' // Dark mode elevated surfaces
        },
        foreground: {
          DEFAULT: '#0f172a', // Dark text on light background
          secondary: '#475569', // Secondary text
          muted: '#64748b', // Muted text
          dark: '#f8fafc', // Light text on dark background
          'dark-secondary': '#cbd5e1', // Dark mode secondary text
          'dark-muted': '#94a3b8' // Dark mode muted text
        },
        // Primary accent: Deep corporate blue
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // Main blue
          600: '#2563eb', // Deep blue for headers
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          DEFAULT: '#2563eb'
        },
        // Secondary accent: Lighter blue for hover states
        secondary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9', // Lighter blue
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          DEFAULT: '#0ea5e9'
        },
        // Status colors for corporate environment
        success: {
          DEFAULT: '#059669',
          foreground: '#ecfdf5',
          dark: '#10b981'
        },
        warning: {
          DEFAULT: '#d97706',
          foreground: '#fffbeb',
          dark: '#f59e0b'
        },
        error: {
          DEFAULT: '#dc2626',
          foreground: '#fef2f2',
          dark: '#ef4444'
        },
        // Border and ring colors
        border: {
          DEFAULT: '#e2e8f0',
          secondary: '#cbd5e1',
          dark: '#334155',
          'dark-secondary': '#475569'
        },
        ring: '#2563eb'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'corporate': 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        'corporate-dark': 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
      },
      boxShadow: {
        'corporate': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'corporate-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'corporate-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }
    }
  },
  plugins: []
} satisfies Config

