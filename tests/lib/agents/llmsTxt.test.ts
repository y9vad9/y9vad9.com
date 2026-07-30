import { describe, it, expect } from 'vitest'
import { buildLlmsTxt, buildLlmsFullTxt, buildHeadersFile } from '@lib/agents/llmsTxt'
import type { Note } from '@core/Note'

function note(slug: string, title: string, preview = 'A preview.'): Note {
  return {
    slug,
    title,
    preview,
    description: null,
    date: new Date('2024-01-01T00:00:00Z'),
  } as Note
}

const ctx = {
  siteName: 'Alex Rivers',
  siteDescription: 'Notes on software.',
  noteUrl: (l: string, s: string) => `https://example.com/${l}/notes/${s}`,
  mirrorUrl: (l: string, s: string) => `https://example.com/${l}/notes/${s}.md`,
  hasMirrors: true,
}

const LOCALES = [
  { locale: 'en', notes: [note('a', 'Alpha'), note('b', 'Beta')] },
  { locale: 'uk', notes: [note('c', 'Gamma')] },
]

describe('buildLlmsTxt', () => {
  it('opens with the site name and description', () => {
    const out = buildLlmsTxt(LOCALES, ctx)
    expect(out.startsWith('# Alex Rivers')).toBe(true)
    expect(out).toContain('> Notes on software.')
  })

  it('points at the markdown mirrors when they exist', () => {
    const out = buildLlmsTxt(LOCALES, ctx)
    expect(out).toContain('[Alpha](https://example.com/en/notes/a.md): A preview.')
  })

  it('falls back to HTML URLs when no mirrors were emitted', () => {
    const out = buildLlmsTxt(LOCALES, { ...ctx, hasMirrors: false })
    expect(out).toContain('[Alpha](https://example.com/en/notes/a)')
    expect(out).not.toContain('.md)')
  })

  it('groups by locale so an agent can pick a language without fetching', () => {
    const out = buildLlmsTxt(LOCALES, ctx)
    expect(out).toContain('## Notes (en)')
    expect(out).toContain('## Notes (uk)')
    expect(out.indexOf('## Notes (en)')).toBeLessThan(out.indexOf('## Notes (uk)'))
  })

  it('skips a locale with no notes rather than emitting an empty heading', () => {
    const out = buildLlmsTxt([...LOCALES, { locale: 'de', notes: [] }], ctx)
    expect(out).not.toContain('## Notes (de)')
  })

  it('collapses whitespace in previews so each entry stays on one line', () => {
    const messy = [{ locale: 'en', notes: [note('a', 'Alpha', 'multi\n\nline   preview')] }]
    const out = buildLlmsTxt(messy, ctx)
    expect(out).toContain(': multi line preview')
  })

  it('ends with exactly one trailing newline', () => {
    const out = buildLlmsTxt(LOCALES, ctx)
    expect(out.endsWith('\n')).toBe(true)
    expect(out.endsWith('\n\n')).toBe(false)
  })
})

describe('buildLlmsFullTxt', () => {
  it('inlines each body under its own heading with a source link', () => {
    const bodies = new Map([['en/a', '# Alpha\n\nBody of alpha.']])
    const out = buildLlmsFullTxt(LOCALES, bodies, ctx)
    expect(out).toContain('## Alpha')
    expect(out).toContain('Source: https://example.com/en/notes/a')
    expect(out).toContain('Body of alpha.')
  })

  it('skips notes with no captured body', () => {
    const out = buildLlmsFullTxt(LOCALES, new Map(), ctx)
    expect(out).not.toContain('## Alpha')
  })
})

describe('buildHeadersFile', () => {
  it('serves mirrors inline as markdown instead of a download', () => {
    const out = buildHeadersFile(['en'])
    expect(out).toContain('/en/notes/*.md')
    expect(out).toContain('Content-Type: text/markdown; charset=utf-8')
  })

  it('marks mirrors noindex so they do not compete with the HTML', () => {
    expect(buildHeadersFile(['en'])).toContain('X-Robots-Tag: noindex')
  })

  it('emits a rule per locale', () => {
    const out = buildHeadersFile(['en', 'uk'])
    expect(out).toContain('/en/notes/*.md')
    expect(out).toContain('/uk/notes/*.md')
  })
})
