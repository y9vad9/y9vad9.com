import { describe, it, expect } from 'vitest'
import { isExternalHref, slugFromPathname } from '@lib/url'

describe('isExternalHref', () => {
  it('treats http(s) and protocol-relative as external', () => {
    expect(isExternalHref('http://example.com')).toBe(true)
    expect(isExternalHref('https://example.com/page')).toBe(true)
    expect(isExternalHref('//cdn.example.com/file.js')).toBe(true)
  })

  it('treats other URL schemes as external', () => {
    expect(isExternalHref('mailto:hello@example.com')).toBe(true)
    expect(isExternalHref('tel:+15551234')).toBe(true)
    expect(isExternalHref('ftp://files.example.com')).toBe(true)
  })

  it('treats site-relative paths as internal', () => {
    expect(isExternalHref('/notes')).toBe(false)
    expect(isExternalHref('/en/notes/foo')).toBe(false)
  })

  it('treats fragments and bare strings as internal', () => {
    expect(isExternalHref('#section')).toBe(false)
    expect(isExternalHref('foo.md')).toBe(false)
  })

  it('returns false for empty / falsy', () => {
    expect(isExternalHref('')).toBe(false)
  })
})

describe('slugFromPathname', () => {
  it('reads the last segment without a trailing slash', () => {
    expect(slugFromPathname('/en/notes/foo')).toBe('foo')
  })

  // The regression: `trailingSlash: true` in the static export made the
  // naive `split('/').pop()` return '' for every note page in production.
  it('reads the same slug when a trailing slash is present', () => {
    expect(slugFromPathname('/en/notes/foo/')).toBe('foo')
  })

  it('ignores query strings and hashes', () => {
    expect(slugFromPathname('/en/notes/foo/?q=bar&hit=2')).toBe('foo')
    expect(slugFromPathname('/en/notes/foo#section')).toBe('foo')
  })

  it('returns empty for root-ish paths', () => {
    expect(slugFromPathname('/')).toBe('')
    expect(slugFromPathname('')).toBe('')
  })
})
