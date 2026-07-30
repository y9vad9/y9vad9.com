import { config as siteConfig } from '~/site.config'
import type { ThemeOption } from '@config/site'

export type Theme = string

/** Whether a palette paints on a light or a dark canvas. */
export type Polarity = 'light' | 'dark' | 'system'

const DEFAULT_THEMES: ThemeOption[] = [
  { id: 'light', label: 'light', icon: 'Sun', dark: false },
  { id: 'dark', label: 'dark', icon: 'Moon', dark: true },
  { id: 'warm', label: 'warm', icon: 'Coffee', dark: true },
  { id: 'forest', label: 'forest', icon: 'Trees', dark: true },
  { id: 'system', label: 'system', icon: 'Monitor' },
]

export const THEME_OPTIONS: ThemeOption[] = siteConfig.themes ?? DEFAULT_THEMES
export const THEMES: Theme[] = THEME_OPTIONS.map((t) => t.id)

/**
 * Polarity of every configured theme, for `color-scheme`.
 *
 * `system` — and any custom theme that hasn't declared `dark` in
 * `site.config.ts` — maps to the CSS keyword pair `light dark`, which tells
 * the browser to follow the OS preference. That's the safe neutral: it keeps
 * the UA canvas, form controls and scrollbars tracking the reader's own
 * setting instead of guessing wrong in one direction.
 */
export function themePolarity(id: Theme): Polarity {
  const declared = THEME_OPTIONS.find((t) => t.id === id)?.dark
  if (declared === true) return 'dark'
  if (declared === false) return 'light'
  return 'system'
}

/** The `color-scheme` value for a theme id. */
export function colorSchemeFor(id: Theme): 'light' | 'dark' | 'light dark' {
  const polarity = themePolarity(id)
  return polarity === 'system' ? 'light dark' : polarity
}

/**
 * `color-scheme` for the `<meta>` tag — the only lever that reaches the very
 * first frame.
 *
 * Next hoists the stylesheet to the top of `<head>`, and an inline script that
 * follows a stylesheet link doesn't execute until that CSS has loaded. So the
 * bootstrap script below, despite being synchronous, cannot colour the canvas
 * the browser paints *before* CSS arrives — on a cold mobile load that blank
 * white canvas is the flash. A meta tag needs no execution, so the parser
 * honours it immediately.
 *
 * It can only carry one static value (this is a static export), so it carries
 * the configured default. A returning reader whose stored theme differs is
 * corrected by the script the moment CSS lands, still before any content
 * paints.
 */
export const META_COLOR_SCHEME = colorSchemeFor(siteConfig.defaultTheme)

/**
 * Swap the `theme-*` class on `<html>` and keep `color-scheme` in step.
 *
 * `color-scheme` is what stops the white flash on a cold load: the browser
 * paints its own canvas before the render-blocking stylesheet arrives, and
 * without this it always picks white. Setting it inline — from the bootstrap
 * script in `<head>`, before the stylesheet — makes that first paint match
 * the theme the reader is about to get.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  html.className = `${html.className.replace(/\btheme-\S+/g, '').trim()} theme-${theme}`.trim()
  html.style.colorScheme = colorSchemeFor(theme)
}

/**
 * Source for the blocking `<head>` script that paints the right theme on the
 * very first frame.
 *
 * It has to be inline and synchronous — anything deferred runs after the
 * first paint, which is precisely the flash we're removing. The polarity map
 * and the configured default are baked in at build time so the script needs
 * no imports.
 *
 * Note the `else` branch: the previous version only touched `<html>` when
 * `localStorage` already held a theme, so a first-ever visit rendered with
 * the bare `:root` palette (light) until React hydrated and the provider
 * applied the real default. On a dark phone that read as a light-to-dark
 * flicker seconds into the load.
 */
export function themeBootstrapScript(): string {
  const polarities: Record<string, string> = {}
  for (const id of THEMES) polarities[id] = colorSchemeFor(id)
  const fallback = colorSchemeFor(siteConfig.defaultTheme)

  return (
    `(function(){try{` +
    `var m=${JSON.stringify(polarities)},t=${JSON.stringify(siteConfig.defaultTheme)};` +
    `try{var s=localStorage.getItem('theme');if(s){var p=JSON.parse(s);` +
    `if(p&&p.state&&p.state.theme)t=p.state.theme;}}catch(e){}` +
    `var r=document.documentElement;` +
    `r.className=(r.className.replace(/\\btheme-\\S+/g,'').trim()+' theme-'+t).trim();` +
    `r.style.colorScheme=m[t]||${JSON.stringify(fallback)};` +
    `}catch(e){}})();`
  )
}
