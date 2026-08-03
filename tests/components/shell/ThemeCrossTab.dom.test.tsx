import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { ThemeProvider } from '@components/shell/ThemeProvider'
import { useThemeStore } from '@store/themeStore'
import { THEME_STORAGE_KEY, readPersistedTheme } from '@lib/theme'
import { config as siteConfig } from '~/site.config'

/**
 * `persist` writes to `localStorage` but never listens to it, so two open tabs
 * share one stored value and disagree about it in memory. Nothing looks wrong
 * until a tab does a *full* load, because only then is the stored value read
 * again, and the tab silently adopts whatever another tab last chose. Client
 * navigation is unaffected, which is why it reads as random.
 */
function storageEvent(key: string, theme: string | null) {
  return new StorageEvent('storage', {
    key,
    newValue: theme === null ? null : JSON.stringify({ state: { theme }, version: 0 }),
  })
}

beforeEach(() => {
  useThemeStore.setState({ theme: 'warm' })
  document.documentElement.className = 'theme-warm'
})
afterEach(() => {
  useThemeStore.setState({ theme: siteConfig.defaultTheme })
})

describe('a theme chosen in another tab', () => {
  it('reaches this one without waiting for a reload', () => {
    render(<ThemeProvider><div /></ThemeProvider>)
    act(() => { window.dispatchEvent(storageEvent(THEME_STORAGE_KEY, 'forest')) })
    expect(useThemeStore.getState().theme).toBe('forest')
    expect(document.documentElement.className).toContain('theme-forest')
    expect(document.documentElement.className).not.toContain('theme-warm')
  })

  it('updates the polarity attribute too, not just the class', () => {
    render(<ThemeProvider><div /></ThemeProvider>)
    act(() => { window.dispatchEvent(storageEvent(THEME_STORAGE_KEY, 'light')) })
    expect(document.documentElement.dataset.polarity).toBe('light')
  })

  it('ignores writes to unrelated keys', () => {
    render(<ThemeProvider><div /></ThemeProvider>)
    act(() => { window.dispatchEvent(storageEvent('panels', 'dark')) })
    expect(useThemeStore.getState().theme).toBe('warm')
  })

  it('ignores a theme this site does not configure', () => {
    // A stale value from a fork that dropped a palette would otherwise apply a
    // class with no CSS behind it.
    render(<ThemeProvider><div /></ThemeProvider>)
    act(() => { window.dispatchEvent(storageEvent(THEME_STORAGE_KEY, 'ocean')) })
    expect(useThemeStore.getState().theme).toBe('warm')
  })

  it('ignores a cleared or unparseable value', () => {
    render(<ThemeProvider><div /></ThemeProvider>)
    act(() => { window.dispatchEvent(storageEvent(THEME_STORAGE_KEY, null)) })
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: THEME_STORAGE_KEY,
        newValue: '{"state":{"theme"',
      }))
    })
    expect(useThemeStore.getState().theme).toBe('warm')
  })

  it('stops listening once unmounted', () => {
    const { unmount } = render(<ThemeProvider><div /></ThemeProvider>)
    unmount()
    act(() => { window.dispatchEvent(storageEvent(THEME_STORAGE_KEY, 'forest')) })
    expect(useThemeStore.getState().theme).toBe('warm')
  })
})

describe('readPersistedTheme', () => {
  it('reads the envelope the bootstrap script and the store share', () => {
    expect(readPersistedTheme(JSON.stringify({ state: { theme: 'forest' } }))).toBe('forest')
  })

  it('returns null rather than guessing', () => {
    for (const raw of [null, undefined, '', 'not json', '{}', '{"state":{}}', '{"state":{"theme":42}}']) {
      expect(readPersistedTheme(raw)).toBeNull()
    }
  })
})
