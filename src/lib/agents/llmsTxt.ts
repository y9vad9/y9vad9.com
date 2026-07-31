import type { Note } from '@core/Note'

export interface LlmsTxtContext {
  siteName: string
  siteDescription: string
  /** Absolute URL of a note's HTML page. */
  noteUrl: (locale: string, slug: string) => string
  /** Absolute URL of a note's markdown mirror. */
  mirrorUrl: (locale: string, slug: string) => string
  /** Whether markdown mirrors exist to link to. */
  hasMirrors: boolean
}

export interface LocaleNotes {
  locale: string
  notes: Note[]
}

/** One row of a landing-page section — a job, a project, a degree. */
export interface ProfileItem {
  /** Lead text: role, project name, degree. */
  title: string
  /** Secondary detail: employer and period, institution and period. */
  meta?: string
  description?: string
  /** Already resolved to an absolute URL — see `resolveConfigHref`. */
  href?: string
}

export interface ProfileGroup {
  heading: string
  /** The fuller note behind the section, when the site declares one. */
  noteHref?: string
  items: ProfileItem[]
}

export interface SiteProfile {
  name: string
  bio: string
  socials: Array<{ label: string; url: string }>
  groups: ProfileGroup[]
}

/** Anything with a scheme — `https:`, `mailto:` — is somebody else's URL. */
const EXTERNAL_HREF = /^[a-z][a-z0-9+.-]*:/i

/**
 * Turn a `site.config.ts` link into an absolute URL an agent can follow.
 *
 * Config links are written for the browser, where the locale is implied by
 * the page you're on — `notes/projects#cadento`, `/notes/education`, or a
 * bare `#projects`. An agent reading llms.txt has none of that context, so
 * every form has to be resolved here.
 *
 * Note references resolve to the *markdown mirror* when mirrors exist: an
 * agent following a link out of llms.txt wants the same cheap-to-read form
 * as everything else in the file. Fragments survive, since they still name
 * the heading being pointed at. External links pass through untouched.
 */
export function resolveConfigHref(
  raw: string | undefined,
  ctx: Pick<LlmsTxtContext, 'noteUrl' | 'mirrorUrl' | 'hasMirrors'> & {
    locale: string
    absoluteUrl: (path: string) => string
  },
): string | undefined {
  const value = raw?.trim()
  if (!value) return undefined
  if (EXTERNAL_HREF.test(value)) return value
  if (value.startsWith('#')) return ctx.absoluteUrl(`/${ctx.locale}${value}`)

  const path = value.replace(/^\/+/, '')
  // `en/notes/x` and `notes/x` name the same note; the locale is ours to add.
  const withoutLocale = path.startsWith(`${ctx.locale}/`)
    ? path.slice(ctx.locale.length + 1)
    : path
  const note = /^notes\/([^#?]+?)\/?([#?].*)?$/.exec(withoutLocale)
  if (note) {
    const slug = note[1]
    const suffix = note[2] ?? ''
    const base = ctx.hasMirrors
      ? ctx.mirrorUrl(ctx.locale, slug)
      : ctx.noteUrl(ctx.locale, slug)
    return `${base}${suffix}`
  }
  return ctx.absoluteUrl(`/${ctx.locale}/${withoutLocale}`)
}

function renderProfile(profile: SiteProfile): string[] {
  const out: string[] = ['## Profile', '']
  if (profile.socials.length > 0) {
    out.push(
      `Elsewhere: ${profile.socials.map((s) => `[${s.label}](${s.url})`).join(' · ')}`,
      '',
    )
  }

  for (const group of profile.groups) {
    if (group.items.length === 0 && !group.noteHref) continue
    out.push(`### ${group.heading}`, '')
    if (group.noteHref) out.push(`Full note: ${group.noteHref}`)
    // Blank line between the note pointer and the rows, but only when there
    // are rows — a section like Summary is just a pointer, and the separator
    // would leave a double gap before the next heading.
    if (group.noteHref && group.items.length > 0) out.push('')
    for (const item of group.items) {
      const label = item.href ? `[${item.title}](${item.href})` : item.title
      const parts = [`- **${label}**`]
      if (item.meta) parts.push(` — ${item.meta}`)
      if (item.description) parts.push(`: ${item.description}`)
      out.push(parts.join(''))
    }
    out.push('')
  }
  return out
}

function noteLine(note: Note, locale: string, ctx: LlmsTxtContext): string {
  const href = ctx.hasMirrors ? ctx.mirrorUrl(locale, note.slug) : ctx.noteUrl(locale, note.slug)
  const summary = (note.description ?? note.preview ?? '').replace(/\s+/g, ' ').trim()
  return summary ? `- [${note.title}](${href}): ${summary}` : `- [${note.title}](${href})`
}

/**
 * `/llms.txt` — a flat map of the site for an agent that lands on the root.
 *
 * Worth being honest about what this buys: measured crawler logs show the
 * major AI crawlers overwhelmingly skip `/llms.txt` and fetch HTML instead,
 * and Google has said it doesn't support the convention. It's shipped as
 * cheap insurance and for agents a reader points at the site by hand — not
 * as a ranking lever.
 *
 * Sections are grouped by locale so an agent can pick a language without
 * fetching anything, and each entry points at the markdown mirror when one
 * exists — that being the whole reason an agent would read this file.
 */
export function buildLlmsTxt(
  locales: LocaleNotes[],
  ctx: LlmsTxtContext,
  profile?: SiteProfile,
): string {
  const out: string[] = [`# ${ctx.siteName}`, '']
  if (ctx.siteDescription) out.push(`> ${ctx.siteDescription}`, '')

  out.push(
    ctx.hasMirrors
      ? 'Each link below is a markdown mirror of a note. Append `.md` to any note URL on this site to get the same thing; the canonical HTML page is linked at the foot of every mirror.'
      : 'Each link below is a note on this site.',
    '',
  )

  // The landing page is the one surface with no note behind it, so without
  // this an agent reading llms.txt would never learn the author's roles,
  // projects or education — only that some notes exist.
  if (profile) out.push(...renderProfile(profile))

  for (const { locale, notes } of locales) {
    if (notes.length === 0) continue
    out.push(`## Notes (${locale})`, '')
    for (const note of notes) out.push(noteLine(note, locale, ctx))
    out.push('')
  }

  return `${out.join('\n').trimEnd()}\n`
}

/**
 * `/llms-full.txt` — every note body inlined, for agents that would rather
 * make one request than N. Can get large; it's opt-in behind `llmsTxt.full`.
 */
export function buildLlmsFullTxt(
  locales: LocaleNotes[],
  bodies: Map<string, string>,
  ctx: LlmsTxtContext,
  profile?: SiteProfile,
): string {
  const out: string[] = [`# ${ctx.siteName}`, '']
  if (ctx.siteDescription) out.push(`> ${ctx.siteDescription}`, '')
  out.push('Full text of every note on this site.', '')
  if (profile) out.push(...renderProfile(profile))

  for (const { locale, notes } of locales) {
    for (const note of notes) {
      const body = bodies.get(`${locale}/${note.slug}`)
      if (!body) continue
      out.push(
        `## ${note.title}`,
        '',
        `Source: ${ctx.noteUrl(locale, note.slug)}`,
        '',
        body.trim(),
        '',
      )
    }
  }

  return `${out.join('\n').trimEnd()}\n`
}

export interface HeadersFileOptions {
  /** Locales that actually have notes. */
  locales: string[]
  /** Markdown mirrors exist, so they need a content type and a Link target. */
  mirrors: boolean
  /** `/llms.txt` exists. */
  llmsTxt: boolean
  /** `/llms-full.txt` exists too. */
  llmsFull: boolean
  /**
   * Routes directly under `/<locale>/notes/` that are pages rather than notes.
   * They match the same URL shape as a note but have no mirror behind them,
   * so the generated `Link` header has to be taken back off them.
   */
  nonNoteRoutes?: string[]
}

/**
 * `_headers` for Netlify / Cloudflare Pages.
 *
 * Three jobs.
 *
 * `Content-Type: text/markdown`, because most static hosts serve an unknown
 * extension as a download, which is exactly wrong for a file meant to be read
 * inline. `X-Robots-Tag: noindex`, which costs nothing — Google ignores
 * markdown by its own account — while stopping the mirrors competing with the
 * HTML as duplicate URLs. Neither affects an agent fetching directly.
 *
 * And `Link` (RFC 8288), which is the same information as the
 * `<link rel="alternate">` in each page's head, moved somewhere an agent can
 * read without parsing HTML — a `HEAD` request is enough. That matters for
 * the fetch-and-summarise agents this whole feature is aimed at: they learn
 * the cheap representation exists before paying for the expensive one.
 *
 * The path syntax is host-specific. `:slug` is a Cloudflare Pages / Netlify
 * placeholder that matches one path segment and can be interpolated back into
 * a header value; the trailing slash is load-bearing, since without it the
 * same rule also matches `…/foo.md` and would advertise `foo.md.md`.
 */
export function buildHeadersFile(opts: HeadersFileOptions): string {
  const { locales, mirrors, llmsTxt, llmsFull, nonNoteRoutes = [] } = opts
  const out = [
    '# Generated by onvu (agents.discovery.emitHeadersFile).',
    '# Markdown mirrors: served inline, kept out of human search indexes.',
    '',
  ]

  if (mirrors) {
    for (const locale of locales) {
      out.push(
        `/${locale}/notes/*.md`,
        '  Content-Type: text/markdown; charset=utf-8',
        '  X-Robots-Tag: noindex',
        '',
      )
    }
  }

  if (llmsTxt) out.push('/llms.txt', '  Content-Type: text/plain; charset=utf-8', '')
  if (llmsFull) out.push('/llms-full.txt', '  Content-Type: text/plain; charset=utf-8', '')

  if (llmsTxt) {
    out.push(
      '# The site index, discoverable from any page without parsing HTML.',
      '# Scoped per locale rather than `/*` so it stays off static assets.',
      '',
    )
    for (const locale of locales) {
      out.push(`/${locale}/*`, '  Link: </llms.txt>; rel="index"; type="text/plain"', '')
    }
  }

  if (mirrors) {
    out.push('# Each note page points at its own markdown mirror.', '')
    for (const locale of locales) {
      out.push(
        `/${locale}/notes/:slug/`,
        `  Link: </${locale}/notes/:slug.md>; rel="alternate"; type="text/markdown"`,
        '',
      )
    }
    if (nonNoteRoutes.length > 0) {
      // Matching rules combine rather than override, so a page under
      // `/notes/` that isn't a note can only be corrected by removing the
      // header again — otherwise it advertises a mirror that 404s, and a dead
      // link an agent will follow is worse than no link at all.
      out.push('# Pages under /notes/ that are not notes: no mirror to point at.', '')
      for (const locale of locales) {
        for (const route of nonNoteRoutes) {
          out.push(`/${locale}/notes/${route}/`, '  ! Link', '')
        }
      }
    }
  }

  return out.join('\n')
}
