/** @type {import('tailwindcss').Config} */
// NeXuS — local Tailwind build (replaces cdn.tailwindcss.com; theme ported from the old inline config).
// Colors resolve to CSS variables defined in index.css (theme-nexus/synthwave/forest/crimson).
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './constants.ts',
    './types.ts',
    './Vault.tsx',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
        },
        accent: {
          green: 'rgb(var(--color-accent-green) / <alpha-value>)',
          red: 'rgb(var(--color-accent-red) / <alpha-value>)',
          yellow: 'rgb(var(--color-accent-yellow) / <alpha-value>)',
        },
        'background-primary': 'rgb(var(--color-background-primary) / <alpha-value>)',
        'background-secondary': 'rgb(var(--color-background-secondary) / <alpha-value>)',
        'background-tertiary': 'rgb(var(--color-background-tertiary) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-accent': 'rgb(var(--color-text-accent) / <alpha-value>)',
        'border-neutral': 'rgb(var(--color-border-neutral) / <alpha-value>)',
        'border-strong': 'rgb(var(--color-border-strong) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
