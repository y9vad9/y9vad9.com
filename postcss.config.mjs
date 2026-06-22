// Tailwind 4 moved the PostCSS plugin out of the main package into
// `@tailwindcss/postcss`. The plugin owns its own scanning so the
// historical `tailwind.config.ts` is no longer wired here — the
// equivalents are declared in CSS via `@theme` (see `globals.css`).
// Autoprefixer is unnecessary with Tailwind 4 (the engine emits
// already-prefixed properties), so we drop it.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
