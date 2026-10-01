const withOpacity = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

const tokens = ['background', 'surface', 'surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest', 'on-surface', 'on-surface-variant', 'outline', 'outline-variant', 'primary', 'on-primary', 'primary-container', 'on-primary-container', 'primary-fixed', 'on-primary-fixed-variant', 'secondary', 'secondary-container', 'on-secondary-container', 'tertiary', 'tertiary-container', 'on-tertiary-container', 'error', 'on-error', 'error-container', 'on-error-container', 'inverse-surface', 'inverse-on-surface']

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: Object.fromEntries(tokens.map((t) => [t, withOpacity(t)])),
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem' },
      boxShadow: {
        card: '0 1px 2px rgb(11 28 48 / 0.04), 0 4px 16px rgb(11 28 48 / 0.06)',
        pop: '0 12px 40px rgb(11 28 48 / 0.18)',
      },
    },
  },
  plugins: [],
}
