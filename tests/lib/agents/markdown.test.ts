import { describe, it, expect } from 'vitest'
import {
  resolveLinksToAbsolute,
  buildNoteMarkdown,
  type MirrorContext,
} from '@lib/agents/markdown'
import type { Note } from '@core/Note'

const NOTES: Record<string, string> = {
  'deep-modules': 'Deep Modules',
  'semantic-typing': 'Semantic Typing',
}

const ctx: MirrorContext = {
  locale: 'en',
  noteUrl: (slug) => `https://example.com/en/notes/${slug}`,
  absoluteUrl: (p) => `https://example.com${p}`,
  resolve: (target) => {
    const key = target.trim().toLowerCase()
    const bySlug = NOTES[key]
    if (bySlug) return { slug: key, title: bySlug }
    const entry = Object.entries(NOTES).find(([, title]) => title.toLowerCase() === key)
    return entry ? { slug: entry[0], title: entry[1] } : null
  },
}

function note(overrides: Partial<Note> = {}): Note {
  return {
    slug: 'deep-modules',
    title: 'Deep Modules',
    preview: 'A short preview.',
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
    body: '<p>html</p>',
    headings: [],
    outgoingLinks: [],
    rawText: 'raw',
    readingTimeMinutes: 1,
    ...overrides,
  } as Note
}

const EMPTY = { parents: [], series: [], backlinks: [], related: [] }
const CFG = {
  enabled: true,
  resolveWikilinks: true,
  include: {
    frontmatter: false,
    parents: false,
    series: false,
    backlinks: false,
    outgoing: false,
    relatedNotes: false,
  },
}

describe('resolveLinksToAbsolute', () => {
  it('rewrites [[Target]] by slug', () => {
    expect(resolveLinksToAbsolute('See [[deep-modules]].', ctx)).toBe(
      'See [deep-modules](https://example.com/en/notes/deep-modules).',
    )
  })

  it('rewrites [[Target]] by title', () => {
    expect(resolveLinksToAbsolute('See [[Semantic Typing]].', ctx)).toContain(
      '](https://example.com/en/notes/semantic-typing)',
    )
  })

  it('keeps the display half of [[Target|Display]]', () => {
    expect(resolveLinksToAbsolute('See [[deep-modules|depth]].', ctx)).toBe(
      'See [depth](https://example.com/en/notes/deep-modules).',
    )
  })

  it('degrades an unresolved wiki link to plain text rather than a dead anchor', () => {
    // A `#` link in a mirror is worse than none — an agent may follow it.
    const out = resolveLinksToAbsolute('See [[no-such-note]].', ctx)
    expect(out).toBe('See no-such-note.')
    expect(out).not.toContain('](')
  })

  it('rewrites the bare-target markdown shorthand the pipeline also accepts', () => {
    expect(resolveLinksToAbsolute('[the note](deep-modules)', ctx)).toBe(
      '[the note](https://example.com/en/notes/deep-modules)',
    )
  })

  it('leaves a spaced destination alone — CommonMark never parsed it as a link', () => {
    // `[x](Deep Modules)` is literal text, not a link, so rewriting it would
    // invent a link the rendered page does not have.
    const src = '[the note](Deep Modules)'
    expect(resolveLinksToAbsolute(src, ctx)).toBe(src)
  })

  it('drops a bare target that resolves to nothing, matching the wiki-link case', () => {
    expect(resolveLinksToAbsolute('[the note](no-such-note)', ctx)).toBe('the note')
  })

  it('inserts the locale into a bare content route', () => {
    // Authors write `/notes/x` because the app resolves the locale at runtime.
    // A mirror has no such context, so the bare path would be a 404.
    expect(resolveLinksToAbsolute('[x](/notes/software-design)', ctx)).toBe(
      '[x](https://example.com/en/notes/software-design)',
    )
  })

  it('leaves an already-localised route untouched', () => {
    expect(resolveLinksToAbsolute('[x](/en/notes/foo)', ctx)).toBe(
      '[x](https://example.com/en/notes/foo)',
    )
  })

  it('locale-prefixes a link to the notes index', () => {
    expect(resolveLinksToAbsolute('[all](/notes)', ctx)).toBe(
      '[all](https://example.com/en/notes)',
    )
  })

  it('does NOT locale-prefix asset paths', () => {
    // /images/a.png is not a route; prefixing it would break the image.
    expect(resolveLinksToAbsolute('![alt](/images/a.png)', ctx)).toBe(
      '![alt](https://example.com/images/a.png)',
    )
  })

  it('leaves external links alone', () => {
    const src = '[docs](https://example.org/a)'
    expect(resolveLinksToAbsolute(src, ctx)).toBe(src)
  })

  it('never rewrites inside a fenced code block', () => {
    const src = ['Before [[deep-modules]].', '', '```md', 'Use [[deep-modules]] here.', '```'].join('\n')
    const out = resolveLinksToAbsolute(src, ctx)
    expect(out).toContain('Before [deep-modules](https://example.com/en/notes/deep-modules).')
    // A note documenting wiki-link syntax must keep its own example intact.
    expect(out).toContain('Use [[deep-modules]] here.')
  })

  it('resumes rewriting after the fence closes', () => {
    const src = ['```', '[[deep-modules]]', '```', '', 'After [[deep-modules]].'].join('\n')
    const out = resolveLinksToAbsolute(src, ctx)
    expect(out.split('\n')[1]).toBe('[[deep-modules]]')
    expect(out).toContain('After [deep-modules](https://example.com/en/notes/deep-modules).')
  })

  it('preserves link titles', () => {
    expect(resolveLinksToAbsolute('[x](/a "Title")', ctx)).toBe(
      '[x](https://example.com/a "Title")',
    )
  })
})

describe('buildNoteMarkdown', () => {
  it('leads with an H1 and always ends with the canonical HTML URL', () => {
    const out = buildNoteMarkdown(note(), 'Body text.', EMPTY, CFG, ctx)
    expect(out).toContain('# Deep Modules')
    expect(out.trimEnd().endsWith('https://example.com/en/notes/deep-modules')).toBe(true)
  })

  it('omits frontmatter unless asked', () => {
    expect(buildNoteMarkdown(note(), 'Body.', EMPTY, CFG, ctx).startsWith('---')).toBe(false)
  })

  it('emits frontmatter with the canonical URL when enabled', () => {
    const cfg = { ...CFG, include: { ...CFG.include, frontmatter: true } }
    const out = buildNoteMarkdown(note({ tags: ['design'] }), 'Body.', EMPTY, cfg, ctx)
    expect(out.startsWith('---\n')).toBe(true)
    expect(out).toContain('title: "Deep Modules"')
    expect(out).toContain('canonical: https://example.com/en/notes/deep-modules')
    expect(out).toContain('tags: ["design"]')
    expect(out).toContain('date: 2024-02-10T00:00:00.000Z')
  })

  it('leaves wiki links raw when resolveWikilinks is off', () => {
    const cfg = { ...CFG, resolveWikilinks: false }
    expect(buildNoteMarkdown(note(), 'See [[deep-modules]].', EMPTY, cfg, ctx)).toContain(
      '[[deep-modules]]',
    )
  })

  it('appends the series section with the current note marked', () => {
    const cfg = { ...CFG, include: { ...CFG.include, series: true } }
    const n = note({ series: 'Kotlin', order: 2 })
    const out = buildNoteMarkdown(
      n,
      'Body.',
      { ...EMPTY, series: [n, note({ slug: 'semantic-typing', title: 'Semantic Typing' })] },
      cfg,
      ctx,
    )
    expect(out).toContain('## Series: Kotlin (part 2)')
    expect(out).toContain('Deep Modules — this note')
  })

  it('appends backlinks', () => {
    const cfg = { ...CFG, include: { ...CFG.include, backlinks: true } }
    const out = buildNoteMarkdown(
      note(),
      'Body.',
      { ...EMPTY, backlinks: [note({ slug: 'semantic-typing', title: 'Semantic Typing' })] },
      cfg,
      ctx,
    )
    expect(out).toContain('## Backlinks')
    expect(out).toContain('[Semantic Typing](https://example.com/en/notes/semantic-typing)')
  })

  it('appends outgoing links, resolving internal ones to titles', () => {
    const cfg = { ...CFG, include: { ...CFG.include, outgoing: true } }
    const n = note({
      outgoingLinks: [
        { kind: 'internal', slug: 'semantic-typing' },
        { kind: 'external', href: 'https://example.org/x' },
      ],
    })
    const out = buildNoteMarkdown(n, 'Body.', EMPTY, cfg, ctx)
    expect(out).toContain('## Links from this note')
    expect(out).toContain('[Semantic Typing](https://example.com/en/notes/semantic-typing)')
    expect(out).toContain('https://example.org/x')
  })

  it('skips empty sections entirely rather than emitting bare headings', () => {
    const cfg = {
      ...CFG,
      include: {
        frontmatter: false,
        parents: true,
        series: true,
        backlinks: true,
        outgoing: true,
        relatedNotes: true,
      },
    }
    const out = buildNoteMarkdown(note(), 'Body.', EMPTY, cfg, ctx)
    expect(out).not.toContain('## Backlinks')
    expect(out).not.toContain('## Related notes')
    expect(out).not.toContain('## Links from this note')
  })
})

describe('buildNoteMarkdown — parent notes', () => {
  const cfg = { ...CFG, include: { ...CFG.include, parents: true } }

  it('links parents that resolve to a note', () => {
    const out = buildNoteMarkdown(
      note({ parents: ['Software Design'] }),
      'Body.',
      { ...EMPTY, parents: [{ title: 'Software Design', slug: 'software-design' }] },
      cfg,
      ctx,
    )
    expect(out).toContain('## Parent notes')
    expect(out).toContain('- [Software Design](https://example.com/en/notes/software-design)')
  })

  it('keeps an unresolved parent as plain text rather than a 404 link', () => {
    const out = buildNoteMarkdown(
      note({ parents: ['Nothing Here'] }),
      'Body.',
      { ...EMPTY, parents: [{ title: 'Nothing Here', slug: null }] },
      cfg,
      ctx,
    )
    expect(out).toContain('- Nothing Here')
    expect(out).not.toContain('](https://example.com/en/notes/nothing-here)')
  })

  it('places parents before the other relation sections', () => {
    const out = buildNoteMarkdown(
      note({ parents: ['Software Design'] }),
      'Body.',
      {
        parents: [{ title: 'Software Design', slug: 'software-design' }],
        series: [],
        backlinks: [note({ slug: 'semantic-typing', title: 'Semantic Typing' })],
        related: [],
      },
      { ...cfg, include: { ...cfg.include, backlinks: true } },
      ctx,
    )
    expect(out.indexOf('## Parent notes')).toBeLessThan(out.indexOf('## Backlinks'))
  })

  it('omits the section when the flag is off', () => {
    const out = buildNoteMarkdown(
      note({ parents: ['Software Design'] }),
      'Body.',
      { ...EMPTY, parents: [{ title: 'Software Design', slug: 'software-design' }] },
      CFG,
      ctx,
    )
    expect(out).not.toContain('## Parent notes')
  })

  it('omits the section for a note with no parents', () => {
    expect(buildNoteMarkdown(note(), 'Body.', EMPTY, cfg, ctx)).not.toContain('## Parent notes')
  })
})
