import { describe, it, expect } from 'vitest'
import { absoluteUrl, localizedPath, noteUrl, siteUrl } from '@lib/seo/url'

describe('seo/url', () => {
  it('siteUrl strips trailing slashes', () => {
    expect(siteUrl().endsWith('/')).toBe(false)
  })

  it('absoluteUrl prepends siteUrl and normalises leading slash', () => {
    expect(absoluteUrl('/notes')).toBe(`${siteUrl()}/notes`)
    expect(absoluteUrl('notes')).toBe(`${siteUrl()}/notes`)
  })

  it('absoluteUrl passes through fully-qualified URLs', () => {
    expect(absoluteUrl('https://example.com/x')).toBe('https://example.com/x')
  })

  it('localizedPath prefixes once', () => {
    expect(localizedPath('en', '/notes')).toBe('/en/notes')
    expect(localizedPath('en', 'notes')).toBe('/en/notes')
    expect(localizedPath('en', '/en/notes')).toBe('/en/notes')
    expect(localizedPath('en')).toBe('/en')
  })

  it('noteUrl composes everything', () => {
    expect(noteUrl('en', 'foo')).toBe(`${siteUrl()}/en/notes/foo`)
  })
})

/**
 * `seo.siteUrl` wins over `NEXT_PUBLIC_BASE_URL`, and `??` only falls through
 * on null/undefined — so a *placeholder* value wins exactly as loudly as a
 * real one. The template shipped `siteUrl: 'https://example.com'`, which made
 * the env var the README tells you to set inert: follow the deployment section
 * verbatim and every canonical URL, hreflang alternate, sitemap entry, RSS
 * guid and OG image on the site pointed at example.com. Nothing warned.
 */
describe('shipped site.config.ts', () => {
  it('does not ship a placeholder origin that would beat the env var', async () => {
    const { config } = await import('~/site.config')
    const shipped = config.seo?.siteUrl
    // Either absent (env decides, as the docs assume) or a real origin.
    expect(shipped === undefined || !/example\.com|your-domain/.test(shipped)).toBe(true)
  })
})
