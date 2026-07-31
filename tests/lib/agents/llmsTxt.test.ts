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

const HEADERS = {
  locales: ['en'],
  mirrors: true,
  llmsTxt: true,
  llmsFull: false,
  nonNoteRoutes: ['graph'],
}

describe('buildHeadersFile', () => {
  it('serves mirrors inline as markdown instead of a download', () => {
    const out = buildHeadersFile(HEADERS)
    expect(out).toContain('/en/notes/*.md')
    expect(out).toContain('Content-Type: text/markdown; charset=utf-8')
  })

  it('marks mirrors noindex so they do not compete with the HTML', () => {
    expect(buildHeadersFile(HEADERS)).toContain('X-Robots-Tag: noindex')
  })

  it('emits a rule per locale', () => {
    const out = buildHeadersFile({ ...HEADERS, locales: ['en', 'uk'] })
    expect(out).toContain('/en/notes/*.md')
    expect(out).toContain('/uk/notes/*.md')
  })

  it('omits the mirror rules when mirrors are off', () => {
    const out = buildHeadersFile({ ...HEADERS, mirrors: false })
    expect(out).not.toContain('text/markdown')
    expect(out).toContain('/llms.txt')
  })

  it('only declares llms-full.txt when it is actually written', () => {
    expect(buildHeadersFile(HEADERS)).not.toContain('/llms-full.txt')
    expect(buildHeadersFile({ ...HEADERS, llmsFull: true })).toContain('/llms-full.txt')
  })
})

describe('buildHeadersFile — Link headers', () => {
  it('advertises the site index from every page in a locale', () => {
    const out = buildHeadersFile(HEADERS)
    expect(out).toContain('/en/*')
    expect(out).toContain('Link: </llms.txt>; rel="index"; type="text/plain"')
  })

  it('scopes the index pointer per locale rather than globally', () => {
    // `/*` would attach the header to every image and JS chunk too.
    expect(buildHeadersFile(HEADERS)).not.toContain('\n/*\n')
  })

  it('drops the index pointer when there is no llms.txt to point at', () => {
    expect(buildHeadersFile({ ...HEADERS, llmsTxt: false })).not.toContain('rel="index"')
  })

  it('points each note page at its own mirror via a path placeholder', () => {
    const out = buildHeadersFile(HEADERS)
    expect(out).toContain('/en/notes/:slug/')
    expect(out).toContain('Link: </en/notes/:slug.md>; rel="alternate"; type="text/markdown"')
  })

  it('keeps the trailing slash on the note-page rule', () => {
    // Verified against `wrangler pages dev`: without it the same rule also
    // matches `/en/notes/foo.md`, which would advertise `/en/notes/foo.md.md`.
    expect(buildHeadersFile(HEADERS)).not.toContain('\n/en/notes/:slug\n')
  })

  it('takes the Link back off pages under /notes/ that are not notes', () => {
    // Matching rules combine rather than override, so `graph` would otherwise
    // advertise a mirror that 404s.
    const out = buildHeadersFile(HEADERS)
    expect(out).toContain('/en/notes/graph/')
    expect(out).toContain('  ! Link')
  })

  it('strips the Link in every locale, not just the first', () => {
    const out = buildHeadersFile({ ...HEADERS, locales: ['de', 'en', 'uk'] })
    for (const l of ['de', 'en', 'uk']) expect(out).toContain(`/${l}/notes/graph/`)
  })

  it('emits no removal rules when there are no non-note routes', () => {
    expect(buildHeadersFile({ ...HEADERS, nonNoteRoutes: [] })).not.toContain('! Link')
  })

  it('has no note-page Link rules at all when mirrors are off', () => {
    const out = buildHeadersFile({ ...HEADERS, mirrors: false })
    expect(out).not.toContain(':slug')
    expect(out).not.toContain('! Link')
  })

  it('stays well inside the 100-rule host limit for a large multilingual site', () => {
    // Cloudflare Pages caps `_headers` at 100 rules, which is why note pages
    // use one placeholder rule per locale rather than one rule per note.
    const out = buildHeadersFile({ ...HEADERS, locales: ['de', 'en', 'uk'], llmsFull: true })
    const rules = out.split('\n').filter((l) => l.startsWith('/')).length
    expect(rules).toBeLessThan(20)
  })
})

describe('buildHeadersFile — locale coverage', () => {
  it('emits a rule for every locale it is handed', () => {
    // Regression: site-wide artifacts were once accumulated across per-locale
    // calls, but Next generates pages in separate worker processes, so each
    // worker saw only a slice and wrote a file missing the other locales.
    const out = buildHeadersFile({ ...HEADERS, locales: ['de', 'en', 'uk'] })
    for (const l of ['de', 'en', 'uk']) expect(out).toContain(`/${l}/notes/*.md`)
  })
})

import { resolveConfigHref, type SiteProfile } from '@lib/agents/llmsTxt'

const hrefCtx = {
  locale: 'en',
  hasMirrors: true,
  noteUrl: (l: string, s: string) => `https://example.com/${l}/notes/${s}`,
  mirrorUrl: (l: string, s: string) => `https://example.com/${l}/notes/${s}.md`,
  absoluteUrl: (p: string) => `https://example.com${p}`,
}

describe('resolveConfigHref', () => {
  it('returns undefined for a missing or blank url', () => {
    // WorkEntry.url is required by the type but often left as ''.
    expect(resolveConfigHref(undefined, hrefCtx)).toBeUndefined()
    expect(resolveConfigHref('', hrefCtx)).toBeUndefined()
    expect(resolveConfigHref('   ', hrefCtx)).toBeUndefined()
  })

  it('passes external links through untouched', () => {
    expect(resolveConfigHref('https://github.com/x', hrefCtx)).toBe('https://github.com/x')
    expect(resolveConfigHref('mailto:a@b.c', hrefCtx)).toBe('mailto:a@b.c')
  })

  it('resolves a bare note path to the markdown mirror', () => {
    expect(resolveConfigHref('notes/projects', hrefCtx)).toBe(
      'https://example.com/en/notes/projects.md',
    )
  })

  it('keeps the fragment, which still names the section being pointed at', () => {
    expect(resolveConfigHref('notes/projects#cadento', hrefCtx)).toBe(
      'https://example.com/en/notes/projects.md#cadento',
    )
  })

  it('accepts a leading slash', () => {
    expect(resolveConfigHref('/notes/education', hrefCtx)).toBe(
      'https://example.com/en/notes/education.md',
    )
  })

  it('does not double up an already-localised path', () => {
    expect(resolveConfigHref('/en/notes/education', hrefCtx)).toBe(
      'https://example.com/en/notes/education.md',
    )
  })

  it('tolerates a trailing slash on the slug', () => {
    expect(resolveConfigHref('notes/projects/', hrefCtx)).toBe(
      'https://example.com/en/notes/projects.md',
    )
  })

  it('falls back to the HTML page when no mirrors were emitted', () => {
    expect(resolveConfigHref('notes/projects#x', { ...hrefCtx, hasMirrors: false })).toBe(
      'https://example.com/en/notes/projects#x',
    )
  })

  it('resolves a bare fragment against the localised landing page', () => {
    expect(resolveConfigHref('#projects', hrefCtx)).toBe('https://example.com/en#projects')
  })

  it('locale-prefixes a non-note site path', () => {
    expect(resolveConfigHref('/cv.pdf', hrefCtx)).toBe('https://example.com/en/cv.pdf')
  })
})

const PROFILE: SiteProfile = {
  name: 'Alex Rivers',
  bio: 'Engineer.',
  socials: [{ label: 'github', url: 'https://github.com/x' }],
  groups: [
    { heading: 'Summary', noteHref: 'https://example.com/en/notes/about.md', items: [] },
    {
      heading: 'Work Experience',
      noteHref: 'https://example.com/en/notes/work.md',
      items: [{ title: 'Senior Engineer', meta: 'Acme, 2022 – Present' }],
    },
    {
      heading: 'Projects',
      items: [
        {
          title: 'Cadento',
          description: 'A productivity app.',
          href: 'https://example.com/en/notes/projects.md#cadento',
        },
      ],
    },
    { heading: 'Education', items: [] },
  ],
}

describe('buildLlmsTxt — profile', () => {
  it('omits the profile block entirely when none is supplied', () => {
    expect(buildLlmsTxt(LOCALES, ctx)).not.toContain('## Profile')
  })

  it('renders the landing-page sections the notes list cannot cover', () => {
    const out = buildLlmsTxt(LOCALES, ctx, PROFILE)
    expect(out).toContain('## Profile')
    // Education is absent on purpose — see the drop-empty-section test below.
    for (const h of ['### Summary', '### Work Experience', '### Projects']) {
      expect(out).toContain(h)
    }
  })

  it('links an item that has a url and leaves bare the one that does not', () => {
    const out = buildLlmsTxt(LOCALES, ctx, PROFILE)
    expect(out).toContain('[Cadento](https://example.com/en/notes/projects.md#cadento)')
    expect(out).toContain('**Senior Engineer** — Acme, 2022 – Present')
  })

  it('points each section at its fuller note when one is configured', () => {
    const out = buildLlmsTxt(LOCALES, ctx, PROFILE)
    expect(out).toContain('Full note: https://example.com/en/notes/about.md')
  })

  it('keeps a section that has only a note link and no items', () => {
    // Summary is exactly this shape — a note, no config-driven rows.
    const out = buildLlmsTxt(LOCALES, ctx, PROFILE)
    const summary = out.slice(out.indexOf('### Summary'), out.indexOf('### Work Experience'))
    expect(summary).toContain('Full note:')
  })

  it('drops a section with neither items nor a note', () => {
    const out = buildLlmsTxt(LOCALES, ctx, PROFILE)
    expect(out).not.toContain('### Education')
  })

  it('lists socials once, as links', () => {
    expect(buildLlmsTxt(LOCALES, ctx, PROFILE)).toContain('[github](https://github.com/x)')
  })

  it('appears in llms-full.txt too', () => {
    expect(buildLlmsFullTxt(LOCALES, new Map(), ctx, PROFILE)).toContain('## Profile')
  })
})

describe('buildLlmsTxt — profile spacing', () => {
  it('never emits a blank line run inside the profile block', () => {
    const out = buildLlmsTxt(LOCALES, ctx, PROFILE)
    const block = out.slice(out.indexOf('## Profile'), out.indexOf('## Notes'))
    expect(block).not.toMatch(/\n\n\n/)
  })
})
