import { describe, it, expect } from 'vitest'
import { buildRedirectsFile } from '@lib/hosting/redirects'

/**
 * A static export generates `/en`, `/de`, `/uk` and no page at `/`, because
 * locale negotiation lives in `src/proxy.ts` and there is no middleware in a
 * static build. Without this file the site's own front door served its 404
 * page, and every internal link worked, so nothing pointed at the cause.
 */
describe('buildRedirectsFile', () => {
  const rules = (primary: string) =>
    buildRedirectsFile(primary)
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))

  it('sends the site root to the primary locale', () => {
    expect(rules('en')).toEqual(['/  /en/  302'])
  })

  it('follows the configured primary rather than assuming English', () => {
    // The reason this is generated instead of committed: a checked-in
    // `/ /en/ 302` would send a Ukrainian site's homepage to a language it may
    // not build at all.
    expect(rules('uk')).toEqual(['/  /uk/  302'])
    expect(rules('pt-BR')).toEqual(['/  /pt-BR/  302'])
  })

  it('redirects temporarily, so a later change of primary is not stuck in caches', () => {
    // A 301 off the site root is cached by browsers indefinitely.
    expect(buildRedirectsFile('en')).not.toMatch(/\b301\b/)
  })

  it('claims only the root', () => {
    // `/notes/<slug>` without a locale is a real route that picks a language
    // from the reader's stored preference and browser settings. A static rule
    // cannot do that, so it must not shadow those pages.
    expect(rules('en')).toHaveLength(1)
    expect(buildRedirectsFile('en')).not.toContain('/notes')
  })

  it('explains itself to whoever opens the file', () => {
    const comments = buildRedirectsFile('en')
      .split('\n')
      .filter((line) => line.startsWith('#'))
    expect(comments.length).toBeGreaterThan(0)
    expect(comments.join(' ')).toMatch(/generated/i)
  })
})
