import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Note } from '@core/Note'

/**
 * `resolveAgentsConfig` reads the real `site.config.ts`, where every agent
 * feature ships off. Mock the module so both states are exercised regardless
 * of what the template happens to be configured with.
 */
async function loadJsonLd(agents: Record<string, unknown> | undefined) {
  vi.resetModules()
  const actual = await vi.importActual<typeof import('~/site.config')>('~/site.config')
  vi.doMock('~/site.config', () => ({
    config: { ...actual.config, agents, seo: { siteUrl: 'https://example.com' } },
  }))
  return import('@lib/seo/jsonLd')
}

const ALL_ON = {
  markdown: { enabled: true },
  discovery: { linkAlternate: true, jsonLdEncoding: true },
  schema: {
    series: true,
    mentions: true,
    definedTerms: true,
    citations: true,
    knowsAbout: true,
  },
}

function note(overrides: Partial<Note> = {}): Note {
  return {
    slug: 'deep-modules',
    title: 'Deep Modules',
    preview: 'Preview text.',
    coverImage: null,
    coverImageSrcSet: null,
    coverImageWidth: null,
    coverImageHeight: null,
    date: new Date('2024-02-10T00:00:00Z'),
    updated: null,
    description: null,
    tags: [],
    author: null,
    noindex: false,
    ogImage: null,
    parents: [],
    series: null,
    order: null,
    isArchived: false,
    isEpic: false,
    body: '',
    headings: [],
    outgoingLinks: [],
    rawText: '',
    readingTimeMinutes: 1,
    ...overrides,
  } as Note
}

beforeEach(() => {
  vi.resetModules()
})

describe('articleJsonLd — agent schema off (the default)', () => {
  it('emits none of the opt-in fields', async () => {
    const { articleJsonLd } = await loadJsonLd(undefined)
    const out = articleJsonLd(
      note({ series: 'Kotlin', order: 2, outgoingLinks: [{ kind: 'external', href: 'https://x.dev' }] }),
      'en',
      { mentions: [{ slug: 'other', title: 'Other' }] },
    )
    for (const key of ['encoding', 'isPartOf', 'position', 'mentions', 'citation']) {
      expect(out[key]).toBeUndefined()
    }
  })

  it('still emits the baseline Article fields', async () => {
    const { articleJsonLd } = await loadJsonLd(undefined)
    const out = articleJsonLd(note(), 'en')
    expect(out['@type']).toBe('Article')
    expect(out.headline).toBe('Deep Modules')
  })

  it('returns null for definedTermJsonLd', async () => {
    const { definedTermJsonLd } = await loadJsonLd(undefined)
    expect(definedTermJsonLd(note(), 'en')).toBeNull()
  })
})

describe('articleJsonLd — agent schema on', () => {
  it('points `encoding` at the markdown mirror', async () => {
    const { articleJsonLd } = await loadJsonLd(ALL_ON)
    const out = articleJsonLd(note(), 'en') as Record<string, Record<string, string>>
    expect(out.encoding.encodingFormat).toBe('text/markdown')
    expect(out.encoding.contentUrl).toBe('https://example.com/en/notes/deep-modules.md')
  })

  it('omits `encoding` for a noindex note, which has no mirror', async () => {
    const { articleJsonLd } = await loadJsonLd(ALL_ON)
    expect(articleJsonLd(note({ noindex: true }), 'en').encoding).toBeUndefined()
  })

  it('expresses a series as CreativeWorkSeries with position', async () => {
    const { articleJsonLd } = await loadJsonLd(ALL_ON)
    const out = articleJsonLd(note({ series: 'Kotlin Coroutines', order: 2 }), 'en', {
      seriesNotes: [
        { slug: 'a', title: 'Part One' },
        { slug: 'b', title: 'Part Two' },
      ],
    }) as Record<string, { '@type': string; name: string; hasPart: unknown[] }> & { position: number }
    expect(out.isPartOf['@type']).toBe('CreativeWorkSeries')
    expect(out.isPartOf.name).toBe('Kotlin Coroutines')
    expect(out.isPartOf.hasPart).toHaveLength(2)
    expect(out.position).toBe(2)
  })

  it('maps wiki-link mentions onto `mentions`', async () => {
    const { articleJsonLd } = await loadJsonLd(ALL_ON)
    const out = articleJsonLd(note(), 'en', {
      mentions: [{ slug: 'semantic-typing', title: 'Semantic Typing' }],
    }) as Record<string, Array<{ '@id': string; name: string }>>
    expect(out.mentions).toHaveLength(1)
    expect(out.mentions[0]['@id']).toBe('https://example.com/en/notes/semantic-typing')
  })

  it('cites outbound external links only, never internal ones', async () => {
    const { articleJsonLd } = await loadJsonLd(ALL_ON)
    const out = articleJsonLd(
      note({
        outgoingLinks: [
          { kind: 'external', href: 'https://example.org/paper' },
          { kind: 'internal', slug: 'other' },
        ],
      }),
      'en',
    ) as Record<string, Array<{ url: string }>>
    expect(out.citation).toHaveLength(1)
    expect(out.citation[0].url).toBe('https://example.org/paper')
  })

  it('builds a DefinedTerm inside the site glossary', async () => {
    const { definedTermJsonLd } = await loadJsonLd(ALL_ON)
    const out = definedTermJsonLd(note(), 'en')!
    expect(out['@type']).toBe('DefinedTerm')
    expect(out.termCode).toBe('deep-modules')
    expect((out.inDefinedTermSet as Record<string, string>)['@type']).toBe('DefinedTermSet')
  })

  it('adds knowsAbout to Person only when topics exist', async () => {
    const { personJsonLd } = await loadJsonLd(ALL_ON)
    expect(personJsonLd(['kotlin', 'design']).knowsAbout).toEqual(['kotlin', 'design'])
    expect(personJsonLd([]).knowsAbout).toBeUndefined()
  })

  it('leaves knowsAbout off when its flag is off, even with topics', async () => {
    const { personJsonLd } = await loadJsonLd({ ...ALL_ON, schema: { knowsAbout: false } })
    expect(personJsonLd(['kotlin']).knowsAbout).toBeUndefined()
  })
})
