import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { readLocalePreference, rememberLocale } from '@lib/i18n/localePreference'

/**
 * The unprefixed `/notes/<slug>` route consults a stored language before it
 * falls back to `navigator.language`. Nothing wrote that key, so the branch was
 * unreachable: a reader who explicitly switched to German kept being bounced by
 * their browser's setting every time they followed a link without a prefix.
 */
beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('locale preference', () => {
  it('reads back what a language switcher stored', async () => {
    rememberLocale('de')
    expect(readLocalePreference()).toBe('de')
  })

  it('is nothing until the reader chooses', () => {
    expect(readLocalePreference()).toBeNull()
  })

  it('stores the bare code, which is what the redirect route reads', () => {
    // Not a zustand `persist` envelope. A `{"state":{…}}` wrapper would have to
    // be parsed by a consumer that only wants the value.
    rememberLocale('uk')
    expect(localStorage.getItem('locale')).toBe('uk')
  })

  it('ignores a locale the site no longer supports', () => {
    // A site that drops a language should not keep redirecting to routes it has
    // stopped building.
    localStorage.setItem('locale', 'fr')
    expect(readLocalePreference()).toBeNull()
  })

  it('ignores rubbish in the key', () => {
    localStorage.setItem('locale', '../../etc/passwd')
    expect(readLocalePreference()).toBeNull()
  })

  it('survives storage being unavailable', () => {
    // Private browsing and blocked-cookie origins both throw on access.
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('SecurityError')
      },
      setItem() {
        throw new Error('SecurityError')
      },
    })
    expect(readLocalePreference()).toBeNull()
    expect(() => rememberLocale('de')).not.toThrow()
  })
})
