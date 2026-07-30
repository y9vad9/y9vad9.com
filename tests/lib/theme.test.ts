import { describe, it, expect } from 'vitest'
import { colorSchemeFor, themePolarity, themeBootstrapScript, THEMES } from '@lib/theme'
import { config as siteConfig } from '~/site.config'

/**
 * The bootstrap script is emitted as a string and runs in `<head>` against
 * globals, so the only honest way to test it is to run it. `new Function`
 * shadows `document` and `localStorage` with fakes, which also lets these
 * tests stay in the fast node pool.
 */
function runBootstrap(stored: string | null, startingClass = 'geist-sans geist-mono') {
  const html = { className: startingClass, style: { colorScheme: '' } }
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
