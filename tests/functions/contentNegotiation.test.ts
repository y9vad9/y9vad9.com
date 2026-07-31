import { describe, it, expect } from 'vitest'
import { prefersMarkdown, noteSlug } from '../../functions/[locale]/notes/_middleware'

/**
 * The Cloudflare Pages middleware itself is exercised against the real
 * runtime (`wrangler pages dev`); these cover the two pure decisions inside
 * it, which is where the subtle mistakes live.
 */
describe('prefersMarkdown', () => {
  it('leaves a browser alone', () => {
    // Chrome's actual Accept header. Serving markdown here would break the site.
    expect(
      prefersMarkdown(
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      ),
    ).toBe(false)
  })

  it('honours a plain markdown request', () => {
    expect(prefersMarkdown('text/markdown')).toBe(true)
    expect(prefersMarkdown('text/x-markdown')).toBe(true)
  })

  it('leaves `curl` and other */* clients on HTML', () => {
    // `*/*` states no preference, and HTML is the representation a human
    // pasting the URL expects.
    expect(prefersMarkdown('*/*')).toBe(false)
  })

  it('respects an explicit preference for HTML over markdown', () => {
    expect(prefersMarkdown('text/markdown;q=0.5, text/html')).toBe(false)
    expect(prefersMarkdown('text/html;q=0.9, text/markdown;q=0.8')).toBe(false)
  })

  it('respects an explicit preference for markdown over HTML', () => {
    expect(prefersMarkdown('text/html;q=0.5, text/markdown;q=0.9')).toBe(true)
  })

  it('breaks a tie towards markdown, since asking for it is deliberate', () => {
    expect(prefersMarkdown('text/html, text/markdown')).toBe(true)
  })

  it('never negotiates on text/plain', () => {
    // Plenty of tooling sends text/plain while expecting something readable;
    // swapping the representation on them would be a surprise.
    expect(prefersMarkdown('text/plain')).toBe(false)
  })

  it('ignores a rejected type (q=0)', () => {
    expect(prefersMarkdown('text/markdown;q=0')).toBe(false)
  })

  it('handles a missing, empty or malformed header without throwing', () => {
    expect(prefersMarkdown(null)).toBe(false)
    expect(prefersMarkdown('')).toBe(false)
    expect(prefersMarkdown('text/markdown;q=abc')).toBe(false)
    expect(prefersMarkdown(';;;,,,')).toBe(false)
  })

  it('is case- and whitespace-insensitive, as the spec requires', () => {
    expect(prefersMarkdown('  TEXT/MARKDOWN ')).toBe(true)
  })
})

describe('noteSlug', () => {
  it('matches a note page with its trailing slash', () => {
    expect(noteSlug('/en/notes/deep-modules/')).toEqual({ locale: 'en', slug: 'deep-modules' })
  })

  it('matches without the trailing slash too', () => {
    expect(noteSlug('/uk/notes/kotlin')).toEqual({ locale: 'uk', slug: 'kotlin' })
  })

  it('rejects the notes index', () => {
    expect(noteSlug('/en/notes/')).toBeNull()
    expect(noteSlug('/en/notes')).toBeNull()
  })

  it('rejects the graph route, which lives under /notes/ without being one', () => {
    expect(noteSlug('/en/notes/graph/')).toBeNull()
  })

  it('rejects a path that already names a file', () => {
    // `/en/notes/x.md` is the mirror itself; negotiating it would be circular.
    expect(noteSlug('/en/notes/deep-modules.md')).toBeNull()
  })

  it('rejects anything deeper than one segment', () => {
    expect(noteSlug('/en/notes/a/b/')).toBeNull()
  })

  it('rejects paths outside a locale/notes shape', () => {
    expect(noteSlug('/en/')).toBeNull()
    expect(noteSlug('/notes/deep-modules/')).toBeNull()
  })
})
