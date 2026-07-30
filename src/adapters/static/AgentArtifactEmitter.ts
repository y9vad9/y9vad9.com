import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import type { Note } from '@core/Note'
import type { NoteRepository } from '@core/NoteRepository'
import type { Locale } from '@config/site'
import { config as siteConfig } from '~/site.config'
import { noteUrl, absoluteUrl } from '@lib/seo/url'
import { resolveAgentsConfig, markdownMirrorPath } from '@lib/agents/config'
import { buildNoteMarkdown, type LinkResolver, type MirrorContext } from '@lib/agents/markdown'
import { buildLlmsTxt, buildLlmsFullTxt, buildHeadersFile } from '@lib/agents/llmsTxt'

const PUBLIC_ROOT = path.join(process.cwd(), 'public')
const NOTES_ROOT = path.join(process.cwd(), 'content', 'notes')

/**
 * Accumulates per-locale results so the site-wide artifacts (`llms.txt`,
 * `_headers`) can be written once every locale has been through. Each locale's
 * layout invokes the emitter independently during the build, and there is no
 * "all locales done" hook to hang the final write on — so every call rewrites
 * the shared files from whatever has been collected so far. The last call wins
 * and by then the map is complete.
 */
const collected = new Map<Locale, { notes: Note[]; bodies: Map<string, string> }>()
const emitted = new Set<Locale>()

/** Mirrors `normaliseKey` in FileSystemNoteRepository. */
function normaliseKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/**
 * Slug-or-title resolver over a note list, matching the wiki-link resolver
 * the MDX pipeline is given. Rebuilt here rather than exported from the
 * repository because the repository builds its own from frontmatter metadata
 * before bodies are processed; by the time we run, full notes are available.
 */
function buildResolver(notes: Note[]): LinkResolver {
  const bySlug = new Map<string, Note>()
  const byTitle = new Map<string, Note>()
  for (const n of notes) {
    bySlug.set(n.slug.toLowerCase(), n)
    byTitle.set(n.title.toLowerCase(), n)
  }
  return (target) => {
    const hit =
      bySlug.get(target.toLowerCase()) ??
      byTitle.get(target.toLowerCase()) ??
      bySlug.get(normaliseKey(target))
    return hit ? { slug: hit.slug, title: hit.title } : null
  }
}

/**
 * Read the markdown source for a note.
 *
 * `note.body` is already-rendered HTML, so the mirror has to go back to the
 * file. This reads the same `content/notes/<locale>/<slug>.md` the filesystem
 * repository does; returns null when the source isn't on disk, which is the
 * normal case for repositories that aren't file-backed.
 */
async function readRawBody(locale: string, slug: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(NOTES_ROOT, locale, `${slug}.md`), 'utf-8')
    return matter(raw).content
  } catch {
    return null
  }
}

function seriesSiblings(notes: Note[], note: Note): Note[] {
  if (!note.series) return []
  return notes
    .filter((n) => n.series === note.series)
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
}

function backlinksOf(notes: Note[], note: Note): Note[] {
  return notes.filter(
    (n) =>
      n.slug !== note.slug &&
      n.outgoingLinks.some((l) => l.kind === 'internal' && l.slug === note.slug),
  )
}

/** Same heuristic as `getRelatedNotes`: shared parents, most overlap first. */
function relatedOf(notes: Note[], note: Note, count = 5): Note[] {
  if (note.parents.length === 0) return []
  const scores = new Map<string, number>()
  for (const other of notes) {
    if (other.slug === note.slug) continue
    const shared = other.parents.filter((p) => note.parents.includes(p)).length
    if (shared > 0) scores.set(other.slug, shared)
  }
  const bySlug = new Map(notes.map((n) => [n.slug, n]))
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([slug]) => bySlug.get(slug))
    .filter((n): n is Note => n !== undefined)
}

/**
 * Writes the agent-facing artifacts for one locale, plus the site-wide ones.
 *
 * Everything is off unless `agents.*` opts in, so the common case is an early
 * return costing one config read. Output goes to `public/`, which Next copies
 * into the export — the same route `emitStaticData` already uses.
 */
export async function emitAgentArtifacts(
  repo: NoteRepository,
  locale: Locale,
): Promise<void> {
  // These are build products. In server mode the layout runs per request, and
  // writing into `public/` on a live request would be both pointless and
  // impossible on a read-only filesystem — so gate on the build phase, which
  // covers the static export (entirely a build) and server builds alike.
  if (process.env.NEXT_PHASE !== 'phase-production-build') return

  const cfg = resolveAgentsConfig()
  if (!cfg.markdown.enabled && !cfg.llmsTxt.enabled) return
  if (emitted.has(locale)) return
  emitted.add(locale)

  const all = await repo.listAll()
  // A note excluded from search engines shouldn't get a machine-readable
  // mirror either — the author asked for it not to be surfaced.
  const notes = all.filter((n) => !n.noindex)
  const resolve = buildResolver(all)

  const ctx: MirrorContext = {
    locale,
    noteUrl: (slug) => noteUrl(locale, slug),
    absoluteUrl,
    resolve,
  }

  const bodies = new Map<string, string>()

  if (cfg.markdown.enabled) {
    const outDir = path.join(PUBLIC_ROOT, locale, 'notes')
    await fs.mkdir(outDir, { recursive: true })

    await Promise.all(
      notes.map(async (note) => {
        const rawBody = await readRawBody(locale, note.slug)
        if (rawBody === null) return
        const doc = buildNoteMarkdown(
          note,
          rawBody,
          {
            series: cfg.markdown.include.series ? seriesSiblings(notes, note) : [],
            backlinks: cfg.markdown.include.backlinks ? backlinksOf(notes, note) : [],
            related: cfg.markdown.include.relatedNotes ? relatedOf(notes, note) : [],
          },
          cfg.markdown,
          ctx,
        )
        bodies.set(`${locale}/${note.slug}`, doc)
        await fs.writeFile(path.join(outDir, `${note.slug}.md`), doc, 'utf-8')
      }),
    )
  }

  collected.set(locale, { notes, bodies })

  if (cfg.llmsTxt.enabled) {
    const locales: Array<{ locale: string; notes: Note[] }> = []
    const allBodies = new Map<string, string>()
    for (const [loc, data] of collected) {
      locales.push({ locale: loc, notes: data.notes })
      for (const [key, body] of data.bodies) allBodies.set(key, body)
    }
    locales.sort((a, b) => a.locale.localeCompare(b.locale))

    const llmsCtx = {
      siteName: siteConfig.owner.name,
      siteDescription: siteConfig.owner.bio,
      noteUrl: (loc: string, slug: string) => noteUrl(loc, slug),
      mirrorUrl: (loc: string, slug: string) => absoluteUrl(markdownMirrorPath(loc, slug)),
      hasMirrors: cfg.markdown.enabled,
    }

    await fs.writeFile(
      path.join(PUBLIC_ROOT, 'llms.txt'),
      buildLlmsTxt(locales, llmsCtx),
      'utf-8',
    )
    if (cfg.llmsTxt.full) {
      await fs.writeFile(
        path.join(PUBLIC_ROOT, 'llms-full.txt'),
        buildLlmsFullTxt(locales, allBodies, llmsCtx),
        'utf-8',
      )
    }
  }

  if (cfg.discovery.emitHeadersFile) {
    await fs.writeFile(
      path.join(PUBLIC_ROOT, '_headers'),
      buildHeadersFile(Array.from(collected.keys()).sort()),
      'utf-8',
    )
  }
}
