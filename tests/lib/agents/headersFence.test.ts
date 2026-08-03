import { describe, it, expect } from 'vitest'
import { buildHeadersFile } from '@lib/agents/llmsTxt'
import { composeFencedFile, hasFencedBlock, type Fence } from '@lib/hosting/fencedBlock'

/**
 * The content of the generated `_headers` block, as `AgentArtifactEmitter`
 * composes it. The fence mechanics themselves are covered against the real
 * writer in `tests/lib/hosting/fencedBlock.test.ts`; what is left here is
 * whether the rules inside the block track the locales they were built for.
 */
const FENCE: Fence = {
  begin: '# --- onvu:agents begin (generated, do not edit) ---',
  end: '# --- onvu:agents end ---',
}

const SITE_HEADERS = [
  '/*',
  '  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
  "  Content-Security-Policy: default-src 'self'",
  '',
  '/images/*',
  '  Cache-Control: public, max-age=31536000, immutable',
].join('\n')

function merge(base: string, locales: string[]): string {
  const generated = buildHeadersFile({
    locales,
    mirrors: true,
    llmsTxt: true,
    llmsFull: false,
    nonNoteRoutes: ['graph'],
  })
  return composeFencedFile(base, FENCE, generated)
}

describe('the generated _headers block', () => {
  it('is recognisable as ours on the next build', () => {
    expect(hasFencedBlock(merge(SITE_HEADERS, ['en']), FENCE)).toBe(true)
  })

  it('leaves the site\'s own headers in place', () => {
    const out = merge(SITE_HEADERS, ['en'])
    expect(out).toContain('Strict-Transport-Security')
    expect(out).toContain("Content-Security-Policy: default-src 'self'")
    expect(out).toContain('/images/*')
  })

  it('serves a mirror rule per locale', () => {
    const out = merge(SITE_HEADERS, ['en', 'de', 'uk'])
    for (const l of ['en', 'de', 'uk']) expect(out).toContain(`/${l}/notes/*.md`)
  })

  it('stands alone when the site has no _headers of its own', () => {
    const out = merge('', ['en'])
    expect(out.startsWith(FENCE.begin)).toBe(true)
    expect(out).toContain('/en/notes/*.md')
  })
})
