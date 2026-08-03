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
 * Is there anything for the reader to switch between?
 *
 * The exact counterpart of `MULTILINGUAL` in `@i18n/routing`, which hides the
 * language switcher on a single-locale site for the reason stated there: a
 * control that only ever offers the value you already have is worse than no
 * control. Configure `themes: [{ id: 'light' }]` and the theme button used to
 * survive as a no-op that still wrote to localStorage — `cycleTheme` resolves
 * `cyclables[(0 + 1) % 1]` straight back to itself.
 *
 * Derived here rather than checked at each call site so the surfaces that
 * render it cannot disagree.
 */
export const THEMEABLE: boolean = THEME_OPTIONS.length > 1

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

/**
 * A translator that can be asked whether it holds a key, which is what
 * next-intl's `useTranslations` actually returns.
 */
export type ThemeTranslator = ((key: string) => string) & {
  has?: (key: string) => boolean
}

/**
 * What to call a theme in the UI: its `theme.<key>` translation if one exists,
 * otherwise the literal `label`, otherwise the id.
 *
 * Shared by all three surfaces that name a theme, because they had drifted
 * into three behaviours. The header wrapped `t()` in a try/catch on the
 * assumption that a missing key throws — it doesn't; next-intl returns the
 * key path — so a custom theme rendered the literal string `theme.ocean`, and
 * one declaring `label: 'Ocean Blue'` rendered `theme.Ocean Blue`. The garden
 * header and the command palette called `t()` raw with no fallback at all,
 * and the palette keyed off the id, ignoring `label` entirely — so one theme
 * could show two different wrong strings on the same site.
 *
 * `t.has()` is the supported way to ask. The optional chain is for callers
 * holding a bare translator (test doubles); those fall back to the literal,
 * which is the documented behaviour anyway.
 */
export function themeLabel(id: Theme, t: ThemeTranslator): string {
  const key = THEME_OPTIONS.find((o) => o.id === id)?.label ?? id
  return t.has?.(key) ? t(key) : key
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
  // Polarity as an attribute, so stylesheets can ask "is this palette dark?"
  // without knowing the theme's name. `themePolarity` already computed this
  // from `ThemeOption.dark` and then threw it away as far as CSS was
  // concerned, which is why `globals.css` had to enumerate
  // `.theme-dark, .theme-warm, .theme-forest` — a list no custom theme can
  // join. Follow `content/theme.css`'s own worked example and you got light
  // syntax highlighting on a near-black background.
  html.dataset.polarity = themePolarity(theme)
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
  const polarityAttr: Record<string, string> = {}
  for (const id of THEMES) {
    polarities[id] = colorSchemeFor(id)
    polarityAttr[id] = themePolarity(id)
  }
  const fallback = colorSchemeFor(siteConfig.defaultTheme)
  const fallbackPolarity = themePolarity(siteConfig.defaultTheme)

  return (
    `(function(){try{` +
    `var m=${JSON.stringify(polarities)},d=${JSON.stringify(polarityAttr)},` +
    `t=${JSON.stringify(siteConfig.defaultTheme)};` +
    `try{var s=localStorage.getItem('theme');if(s){var p=JSON.parse(s);` +
    `if(p&&p.state&&p.state.theme)t=p.state.theme;}}catch(e){}` +
    `var r=document.documentElement;` +
    `r.className=(r.className.replace(/\\btheme-\\S+/g,'').trim()+' theme-'+t).trim();` +
    `r.style.colorScheme=m[t]||${JSON.stringify(fallback)};` +
    // Stamped here too, not just in `applyTheme`. The polarity-keyed rules are
    // in the render-blocking stylesheet, so an attribute that only arrived at
    // hydration would paint one frame of light-theme code blocks first.
    `r.setAttribute('data-polarity',d[t]||${JSON.stringify(fallbackPolarity)});` +
    `}catch(e){}})();`
  )
}
