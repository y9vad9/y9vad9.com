import { describe, it, expect } from 'vitest'
import { routing } from '@i18n/routing'
import {
  noindexPaths,
  isNoindexPath,
  robotsDisallowPaths,
  DEFAULT_NOINDEX_PATHS,
} from '@lib/seo/noindex'

/**
 * `seo.noindexPaths` had two consumers that read its entries differently and
 * each carried its own copy of the default. The robots half emitted them raw,
 * so `Disallow: /notes/graph` never matched `/en/notes/graph` — every real URL
 * on the site is locale-prefixed. It looked like protection and was decoration.
 */
describe('noindexPaths', () => {
  it('keeps configured entries unprefixed, the way an author writes them', () => {
    expect(noindexPaths()).toEqual(DEFAULT_NOINDEX_PATHS)
    expect(isNoindexPath('/notes/graph')).toBe(true)
    expect(isNoindexPath('/notes/something-else')).toBe(false)
  })

  it('emits one robots rule per locale', () => {
    const rules = robotsDisallowPaths()
    // The actual bug: without these, the graph page was crawlable despite
    // being configured otherwise.
    for (const locale of routing.locales) {
      expect(rules).toContain(`/${locale}/notes/graph`)
    }
    expect(routing.locales.length).toBeGreaterThan(0)
  })

  it('keeps the bare path alongside the expansions', () => {
    // Correct for a site that ever stops prefixing its URLs — an author's
    // entry should not quietly become wrong because routing changed.
    expect(robotsDisallowPaths()).toContain('/notes/graph')
  })

  it('expands every configured entry, not just the first', () => {
    const rules = robotsDisallowPaths()
    // One bare + one per locale, for each configured path.
    expect(rules).toHaveLength(noindexPaths().length * (routing.locales.length + 1))
  })
})
