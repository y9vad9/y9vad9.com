import type { Note } from '@core/Note'
import type { ResolvedAgentsConfig } from './config'

/**
 * Same grammar the MDX pipeline's wiki-link plugin uses — see
 * `remarkWikiLinks` in `@lib/mdx/pipeline`. Kept in step deliberately: a
 * mirror that resolved a different set of links than the rendered page would
 * be a quietly different document.
 */
const WIKILINK_RE = /\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g

/** Markdown inline/reference link whose target is bare (`[Text](Some Note)`). */
const MD_LINK_RE = /(!?)\[([^\]\n]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g

/** Fenced (``` or ~~~) and indented code — rewriting inside these would corrupt samples. */
const FENCE_RE = /^(\s*)(`{3,}|~{3,})/

export type LinkResolver = (target: string) => { slug: string; title: string } | null

export interface MirrorContext {
  locale: string
  /** Absolute URL for a note slug. */
  noteUrl: (slug: string) => string
  /** Absolute URL for a site-relative path. */
  absoluteUrl: (path: string) => string
  resolve: LinkResolver
}

/**
 * Mirrors `isBareLinkTarget` from the MDX pipeline: no slashes, protocol,
 * fragment or file extension means the author meant a note, not a URL.
 */
function isBareLinkTarget(url: string): boolean {
  if (!url) return false
  if (/[\\/:#?]/.test(url)) return false
  if (/^[a-z]+:/i.test(url)) return false
  if (/\.[a-z0-9]{1,5}$/i.test(url)) return false
  return true
}

/**
 * Absolutise a site-relative path, inserting the locale for content routes.
 *
 * Authors write `[Software Design](/notes/software-design)` — no locale,
 * because the app resolves that client-side against the current one. A mirror
 * has no such context, so the bare path would send an agent to a 404. Only
 * routes are locale-scoped: `/images/diagram.png` must be left alone, and a
 * path that already carries the locale is passed through untouched.
 */
function siteRelativeToAbsolute(url: string, ctx: MirrorContext): string {
  const isContentRoute = url === '/' || /^\/notes(\/|$)/.test(url)
  if (!isContentRoute) return ctx.absoluteUrl(url)
  return ctx.absoluteUrl(url === '/' ? `/${ctx.locale}` : `/${ctx.locale}${url}`)
}

/**
 * Run `fn` over prose only, leaving fenced code blocks untouched.
 *
 * Without this a note explaining wiki-link syntax inside a fence would have
 * its own example rewritten — the mirror would document something the reader
 * never wrote.
 */
function mapProseLines(source: string, fn: (line: string) => string): string {
  const lines = source.split('\n')
  let fence: string | null = null
  return lines
    .map((line) => {
      const match = FENCE_RE.exec(line)
      if (match) {
        const marker = match[2]
        if (fence === null) {
          fence = marker[0]
          return line
        }
        if (marker[0] === fence) {
          fence = null
          return line
        }
        return line
      }
      if (fence !== null) return line
      return fn(line)
    })
    .join('\n')
}

/**
 * Rewrite every internal reference to an absolute URL.
 *
 * Three shapes get rewritten: `[[Target]]`, `[[Target|Display]]`, and the
 * bare-target shorthand `[Text](Some Note)` the pipeline also accepts. Site
 * -relative links (`/notes/foo`) become absolute too, since an agent that
 * fetched the raw file has no origin to resolve them against.
 *
 * Unresolved wiki links degrade to plain text rather than a `#` anchor: a
 * dead link in a mirror is worse than no link, because an agent may follow it.
 */
export function resolveLinksToAbsolute(body: string, ctx: MirrorContext): string {
  return mapProseLines(body, (line) => {
    let out = line.replace(WIKILINK_RE, (_full, rawTarget: string, rawDisplay?: string) => {
      const target = rawTarget.trim()
      const display = (rawDisplay ?? rawTarget).trim()
      const hit = ctx.resolve(target)
      return hit ? `[${display}](${ctx.noteUrl(hit.slug)})` : display
    })

    out = out.replace(
      MD_LINK_RE,
      (full, bang: string, text: string, url: string, title?: string) => {
        const suffix = title ?? ''
        // Images keep their target; only their path needs absolutising.
        if (!bang && isBareLinkTarget(url)) {
          const hit = ctx.resolve(url)
          return hit ? `[${text}](${ctx.noteUrl(hit.slug)}${suffix})` : text
        }
        if (url.startsWith('/')) {
          return `${bang}[${text}](${siteRelativeToAbsolute(url, ctx)}${suffix})`
        }
        return full
      },
    )

    return out
  })
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}

function frontmatterBlock(note: Note, ctx: MirrorContext): string {
  const lines = ['---', `title: ${yamlString(note.title)}`]
  if (note.description ?? note.preview) {
    lines.push(`description: ${yamlString(note.description ?? note.preview)}`)
  }
  if (note.date) lines.push(`date: ${note.date.toISOString()}`)
  if (note.updated) lines.push(`updated: ${note.updated.toISOString()}`)
  if (note.tags.length > 0) lines.push(`tags: [${note.tags.map(yamlString).join(', ')}]`)
  if (note.parents.length > 0) {
    lines.push(`parents: [${note.parents.map(yamlString).join(', ')}]`)
  }
  if (note.series) lines.push(`series: ${yamlString(note.series)}`)
  if (note.order !== null) lines.push(`order: ${note.order}`)
  lines.push(`canonical: ${ctx.noteUrl(note.slug)}`)
  lines.push(`locale: ${yamlString(ctx.locale)}`)
  lines.push('---')
  return lines.join('\n')
}

function linkList(items: Array<{ title: string; url: string }>): string {
  return items.map((i) => `- [${i.title}](${i.url})`).join('\n')
}

export interface MirrorSections {
  /**
   * The note's parents. `slug` is null when the frontmatter names a parent
   * with no note behind it — the name is still worth stating, it just isn't
   * a link.
   */
  parents: Array<{ title: string; slug: string | null }>
  /** Siblings in the same series, in reading order. */
  series: Note[]
  /** Notes linking to this one. */
  backlinks: Note[]
  /** Notes sharing a parent. */
  related: Note[]
}

/**
 * Assemble the full mirror document for one note.
 *
 * Appendices are plain markdown headings rather than a bespoke format: the
 * point is for an agent to recognise the relationships without being told
 * about them, and "## Backlinks" followed by a list does that with no
 * convention to learn.
 */
export function buildNoteMarkdown(
  note: Note,
  rawBody: string,
  sections: MirrorSections,
  cfg: ResolvedAgentsConfig['markdown'],
  ctx: MirrorContext,
): string {
  const body = cfg.resolveWikilinks ? resolveLinksToAbsolute(rawBody, ctx) : rawBody
  const parts: string[] = []

  if (cfg.include.frontmatter) parts.push(frontmatterBlock(note, ctx))
  parts.push(`# ${note.title}`)
  parts.push(body.trim())

  // Parents first: where the note sits in the hierarchy is the most
  // structural thing about it, and the frontmatter above only names them.
  if (cfg.include.parents && sections.parents.length > 0) {
    parts.push(
      '## Parent notes\n\n' +
        sections.parents
          .map((p) => (p.slug ? `- [${p.title}](${ctx.noteUrl(p.slug)})` : `- ${p.title}`))
          .join('\n'),
    )
  }

  if (cfg.include.series && note.series && sections.series.length > 0) {
    const position = note.order !== null ? ` (part ${note.order})` : ''
    parts.push(
      `## Series: ${note.series}${position}\n\n` +
        linkList(
          sections.series.map((n) => ({
            title: n.slug === note.slug ? `${n.title} — this note` : n.title,
            url: ctx.noteUrl(n.slug),
          })),
        ),
    )
  }

  if (cfg.include.backlinks && sections.backlinks.length > 0) {
    parts.push(
      '## Backlinks\n\nNotes that link to this one.\n\n' +
        linkList(sections.backlinks.map((n) => ({ title: n.title, url: ctx.noteUrl(n.slug) }))),
    )
  }

  if (cfg.include.outgoing) {
    const outgoing = note.outgoingLinks
      .map((l) => {
        if (l.kind === 'internal') {
          const hit = ctx.resolve(l.slug)
          return hit ? { title: hit.title, url: ctx.noteUrl(hit.slug) } : null
        }
        return { title: l.href, url: l.href }
      })
      .filter((x): x is { title: string; url: string } => x !== null)
    if (outgoing.length > 0) {
      parts.push('## Links from this note\n\n' + linkList(outgoing))
    }
  }

  if (cfg.include.relatedNotes && sections.related.length > 0) {
    parts.push(
      '## Related notes\n\n' +
        linkList(sections.related.map((n) => ({ title: n.title, url: ctx.noteUrl(n.slug) }))),
    )
  }

  parts.push(`---\n\nCanonical HTML version: ${ctx.noteUrl(note.slug)}`)

  return `${parts.join('\n\n')}\n`
}
