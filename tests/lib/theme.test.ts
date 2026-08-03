import { describe, it, expect } from 'vitest'
import {
  colorSchemeFor,
  themePolarity,
  themeBootstrapScript,
  themeLabel,
  THEMES,
  THEMEABLE,
} from '@lib/theme'
import { config as siteConfig } from '~/site.config'

/**
 * The bootstrap script is emitted as a string and runs in `<head>` against
 * globals, so the only honest way to test it is to run it. `new Function`
 * shadows `document` and `localStorage` with fakes, which also lets these
 * tests stay in the fast node pool.
 */
function runBootstrap(stored: string | null, startingClass = 'geist-sans geist-mono') {
  const attrs: Record<string, string> = {}
  const html = {
    className: startingClass,
    style: { colorScheme: '' },
    // The script stamps `data-polarity` here. Without this on the fake the
    // call throws into the script's own try/catch and the assertion below
    // would pass against a no-op.
    setAttribute: (k: string, v: string) => { attrs[k] = v },
    attrs,
  }
  const document = { documentElement: html }
  const localStorage = { getItem: (k: string) => (k === 'theme' ? stored : null) }
  new Function('document', 'localStorage', themeBootstrapScript())(document, localStorage)
  return html
}

describe('themePolarity / colorSchemeFor', () => {
  it('maps the built-in palettes to their canvas', () => {
    expect(themePolarity('light')).toBe('light')
    expect(themePolarity('dark')).toBe('dark')
    expect(themePolarity('warm')).toBe('dark')
    expect(themePolarity('forest')).toBe('dark')
  })

  it('lets the OS decide for `system` and for undeclared themes', () => {
    expect(colorSchemeFor('system')).toBe('light dark')
    expect(colorSchemeFor('a-theme-nobody-configured')).toBe('light dark')
  })

  it('emits a concrete keyword for every non-system configured theme', () => {
    for (const id of THEMES.filter((t) => t !== 'system')) {
      expect(['light', 'dark', 'light dark']).toContain(colorSchemeFor(id))
    }
  })
})

describe('themeBootstrapScript', () => {
  it('applies the configured default when nothing is stored', () => {
    // The regression: the old script only touched <html> when localStorage
    // already had a theme, so a first visit painted :root (light) until React
    // hydrated — a visible light-to-dark flip on a dark device.
    const html = runBootstrap(null)
    expect(html.className).toContain(`theme-${siteConfig.defaultTheme}`)
    expect(html.style.colorScheme).toBe(colorSchemeFor(siteConfig.defaultTheme))
  })

  it('applies the persisted theme and its colour scheme', () => {
    const html = runBootstrap(JSON.stringify({ state: { theme: 'dark' }, version: 0 }))
    expect(html.className).toContain('theme-dark')
    expect(html.style.colorScheme).toBe('dark')
  })

  it('keeps classes it does not own', () => {
    const html = runBootstrap(JSON.stringify({ state: { theme: 'forest' }, version: 0 }))
    expect(html.className).toContain('geist-sans')
    expect(html.className).toContain('geist-mono')
  })

  it('replaces a stale theme class instead of stacking one on top', () => {
    const html = runBootstrap(
      JSON.stringify({ state: { theme: 'dark' }, version: 0 }),
      'geist-sans theme-light',
    )
    expect(html.className).not.toContain('theme-light')
    expect(html.className.match(/\btheme-\S+/g)).toEqual(['theme-dark'])
  })

  it('falls back to the default on unparseable storage rather than throwing', () => {
    const html = runBootstrap('}{not json')
    expect(html.className).toContain(`theme-${siteConfig.defaultTheme}`)
  })

  it('falls back to the default when the persisted shape has no theme', () => {
    const html = runBootstrap(JSON.stringify({ state: {}, version: 0 }))
    expect(html.className).toContain(`theme-${siteConfig.defaultTheme}`)
  })

  it('never emits a class list with stray whitespace', () => {
    expect(runBootstrap(null, '').className).toBe(`theme-${siteConfig.defaultTheme}`)
  })
})

/**
 * Everything below derives from `ThemeOption` rather than from a list of
 * known theme names — the class of bug that made `content/theme.css`'s own
 * documented "add an ocean theme" walkthrough produce a broken site.
 */
describe('themeLabel', () => {
  it('prefers a translation when the catalogue actually has one', () => {
    const t = Object.assign((k: string) => (k === 'dark' ? 'Dark' : `theme.${k}`), {
      has: (k: string) => k === 'dark',
    })
    expect(themeLabel('dark', t)).toBe('Dark')
  })

  it('falls back to the literal label, not to a key path', () => {
    // next-intl does NOT throw on a missing key — it returns `theme.<key>`.
    // The header's try/catch assumed otherwise, so a custom theme's button
    // read "theme.ocean", and declaring `label: 'Ocean Blue'` made it worse:
    // "theme.Ocean Blue".
    const t = Object.assign((k: string) => `theme.${k}`, { has: () => false })
    expect(themeLabel('system', t)).toBe('system')
  })

  it('survives a translator with no `has`', () => {
    const t = ((k: string) => `theme.${k}`) as unknown as Parameters<typeof themeLabel>[1]
    expect(themeLabel('dark', t)).toBe('dark')
  })
})

describe('THEMEABLE', () => {
  it('tracks whether there is anything to switch between', () => {
    // The counterpart of MULTILINGUAL. With one theme configured the button
    // survived as a no-op that still wrote to localStorage — `cycleTheme`
    // resolves `cyclables[(0 + 1) % 1]` straight back to itself.
    expect(THEMEABLE).toBe(THEMES.length > 1)
  })
})

describe('bootstrap polarity', () => {
  it('stamps data-polarity before the stylesheet lands', () => {
    // The polarity-keyed rules are in the render-blocking stylesheet, so an
    // attribute that only arrived at hydration would paint one frame of
    // light-theme code blocks first — the flash this script exists to prevent.
    expect(runBootstrap(null).attrs['data-polarity']).toBe(
      themePolarity(siteConfig.defaultTheme),
    )
  })

  it('stamps the polarity of a persisted theme, not of the default', () => {
    const stored = JSON.stringify({ state: { theme: 'dark' } })
    expect(runBootstrap(stored).attrs['data-polarity']).toBe('dark')
  })
})
