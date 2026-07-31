import { describe, it, expect } from 'vitest'
import { buildHeadersFile } from '@lib/agents/llmsTxt'

/**
 * Mirrors the fence handling in `AgentArtifactEmitter.writeHeadersFile`.
 *
 * `_headers` is a file sites already own — CSP, HSTS, cache policy — so the
 * generated block is fenced and replaced in place rather than the file being
 * overwritten. These tests pin the two ways that went wrong in practice.
 */
const BEGIN = '# --- onvu:agents begin (generated, do not edit) ---'
const END = '# --- onvu:agents end ---'

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fenceRegex() {
  return new RegExp(`\\n*${escape(BEGIN)}[\\s\\S]*?${escape(END)}\\n*`, 'g')
}

function merge(existing: string | null, locales: string[]): string {
  const base = existing === null ? '' : existing.replace(fenceRegex(), '\n').trimEnd()
  const generated = buildHeadersFile({
    locales,
    mirrors: true,
    llmsTxt: true,
    llmsFull: false,
    nonNoteRoutes: ['graph'],
  })
  const block = `${BEGIN}\n${generated.trimEnd()}\n${END}`
  return base ? `${base}\n\n${block}\n` : `${block}\n`
}

const SITE_HEADERS = [
  '/*',
  '  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
  "  Content-Security-Policy: default-src 'self'",
  '',
  '/images/*',
  '  Cache-Control: public, max-age=31536000, immutable',
].join('\n')

describe('_headers fence', () => {
  it('escapes the markers — unescaped, "(generated…)" is a capture group', () => {
    // The original bug: the fence never matched, so each build appended
    // another block instead of replacing the previous one.
    const withBlock = merge(SITE_HEADERS, ['en'])
    expect(fenceRegex().test(withBlock)).toBe(true)
  })

  it('never destroys the site\'s own headers', () => {
    const out = merge(SITE_HEADERS, ['en'])
    expect(out).toContain('Strict-Transport-Security')
    expect(out).toContain("Content-Security-Policy: default-src 'self'")
    expect(out).toContain('/images/*')
  })

  it('is idempotent — repeated merges keep exactly one block', () => {
    let out = merge(SITE_HEADERS, ['en'])
    for (let i = 0; i < 5; i++) out = merge(out, ['en'])
    expect(out.match(new RegExp(escape(BEGIN), 'g'))).toHaveLength(1)
    expect(out).toContain('Strict-Transport-Security')
  })

  it('replaces a stale block rather than stacking a new locale set on it', () => {
    const first = merge(SITE_HEADERS, ['en'])
    const second = merge(first, ['en', 'de', 'uk'])
    expect(second.match(new RegExp(escape(BEGIN), 'g'))).toHaveLength(1)
    for (const l of ['en', 'de', 'uk']) expect(second).toContain(`/${l}/notes/*.md`)
  })

  it('works when the site has no _headers of its own', () => {
    const out = merge(null, ['en'])
    expect(out.startsWith(BEGIN)).toBe(true)
    expect(out).toContain('/en/notes/*.md')
  })
})
