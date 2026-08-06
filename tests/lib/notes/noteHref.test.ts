import { describe, it, expect } from 'vitest'
import { buildNoteHref } from '@lib/notes/noteHref'
import { processMarkdown } from '@lib/mdx/pipeline'

/**
 * Wiki links used to be written as `/notes/<slug>`, which is not a route this
 * site serves — every page lives under a locale. It resolved only because a
 * host-level redirect rewrote it, and that redirect cannot know what the
 * reader was reading, so it answers in the primary locale. Following a link
 * inside a Ukrainian note therefore landed on the English one, via two hops:
 *
 *   /notes/foo  →302→  /en/notes/foo  →308→  /en/notes/foo/
 */
describe('buildNoteHref', () => {
  it('carries the locale, so a link out of a translated note stays in it', () => {
    expect(buildNoteHref('uk', 'contract-violation-handling', true)).toBe(
      '/uk/notes/contract-violation-handling/',
    )
  })

  it('matches the URL shape of a static export, which slashes its paths', () => {
    // Without this the export answers the slashless form with a 308 — a
    // redirect on every internal link in the garden.
    expect(buildNoteHref('en', 'foo', true)).toBe('/en/notes/foo/')
  })

  it('leaves the slash off when the build does not use them', () => {
    expect(buildNoteHref('en', 'foo', false)).toBe('/en/notes/foo')
  })

  it('does not assume a locale is two letters', () => {
    expect(buildNoteHref('pt-BR', 'foo', false)).toBe('/pt-BR/notes/foo')
  })
})

describe('processMarkdown wiki links', () => {
  const resolve = (t: string) =>
    t.toLowerCase() === 'foo' ? { slug: 'foo', title: 'Foo' } : null

  it('refuses to resolve wiki links without being told where they point', async () => {
    // The old locale-free form is the obvious default, and defaulting to it is
    // how the bug survived. A caller that resolves links knows its locale.
    await expect(
      processMarkdown('See [[Foo]].', { resolveWikiLink: resolve }),
    ).rejects.toThrow(/noteHref/)
  })

  it('locale-prefixes a bare markdown link too, not just [[wiki]] syntax', async () => {
    // `[Foo](foo)` — no slash, no extension, no scheme — is treated as a wiki
    // link by a separate pass from the `[[…]]` one. Both write an href, so
    // both have to be covered or half the fix goes unnoticed.
    const r = await processMarkdown('See [Foo](foo).', {
      resolveWikiLink: resolve,
      noteHref: (slug) => `/de/notes/${slug}/`,
    })
    expect(r.html).toContain('href="/de/notes/foo/"')
  })

  it('still collects the link as an outgoing edge once it carries a locale', async () => {
    // The outgoing-link scanner used to accept at most one two-letter segment
    // before `notes/`. A locale-prefixed href had to keep matching, or the
    // links panel and the graph would both quietly lose the edge.
    const r = await processMarkdown('See [[Foo]].', {
      resolveWikiLink: resolve,
      noteHref: (slug) => `/pt-BR/notes/${slug}/`,
    })
    expect(r.html).toContain('href="/pt-BR/notes/foo/"')
    expect(r.outgoingLinks).toContainEqual({ kind: 'internal', slug: 'foo' })
  })

  it('collects an edge from a hand-written locale-prefixed markdown link', async () => {
    const r = await processMarkdown('See [Foo](/uk/notes/foo/).')
    expect(r.outgoingLinks).toContainEqual({ kind: 'internal', slug: 'foo' })
  })

  it('still collects an edge from a locale-free one an author typed', async () => {
    const r = await processMarkdown('See [Foo](/notes/foo).')
    expect(r.outgoingLinks).toContainEqual({ kind: 'internal', slug: 'foo' })
  })
})
