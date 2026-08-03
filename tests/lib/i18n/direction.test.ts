import { describe, it, expect } from 'vitest'
import { localeDirection } from '@lib/i18n/direction'

/**
 * `<html dir>` is derived from the locale via `Intl` rather than from a list.
 * Every hand-written version of this list starts as `['ar','he','fa','ur']`
 * and is wrong by omission on day one.
 */
describe('localeDirection', () => {
  it('reads left-to-right languages as such', () => {
    for (const l of ['en', 'de', 'uk', 'ja', 'fil']) {
      expect(localeDirection(l)).toBe('ltr')
    }
  })

  it('reads the obvious right-to-left languages', () => {
    for (const l of ['ar', 'he', 'fa', 'ur']) {
      expect(localeDirection(l)).toBe('rtl')
    }
  })

  it('gets the ones a hand-written list forgets', () => {
    // Central Kurdish, Pashto, Sindhi, Dhivehi, Uyghur, Yiddish. CLDR knows
    // all of these; the four-entry list in everyone's `isRtl()` does not.
    for (const l of ['ckb', 'ps', 'sd', 'dv', 'ug', 'yi']) {
      expect(localeDirection(l)).toBe('rtl')
    }
  })

  it('follows the script subtag, not the language', () => {
    // The case that makes a language-keyed list wrong in the other direction:
    // the same language reads differently depending on how it is written.
    expect(localeDirection('az')).toBe('ltr')
    expect(localeDirection('az-Arab')).toBe('rtl')
    expect(localeDirection('pa')).toBe('ltr')
    expect(localeDirection('pa-Arab')).toBe('rtl')
  })

  it('handles a region subtag without losing the direction', () => {
    expect(localeDirection('ar-EG')).toBe('rtl')
    expect(localeDirection('en-GB')).toBe('ltr')
  })

  it('renders rather than throws on a malformed tag', () => {
    // A bad tag reaching this far is a config error, not a reason to fail a
    // page render.
    expect(localeDirection('not a locale')).toBe('ltr')
    expect(localeDirection('')).toBe('ltr')
  })
})
