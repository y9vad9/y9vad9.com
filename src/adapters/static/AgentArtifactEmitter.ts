import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import type { Note } from '@core/Note'
import { createRepository } from '@adapters/createRepositories'
import { routing } from '@i18n/routing'
import { config as siteConfig } from '~/site.config'
import { noteUrl, absoluteUrl } from '@lib/seo/url'
import { resolveAgentsConfig, markdownMirrorPath } from '@lib/agents/config'
import { buildNoteMarkdown, type LinkResolver, type MirrorContext } from '@lib/agents/markdown'
import {
  buildLlmsTxt,
  buildLlmsFullTxt,
  buildHeadersFile,
  resolveConfigHref,
  type HeadersFileOptions,
  type SiteProfile,
} from '@lib/agents/llmsTxt'
import { loadSiteConfig } from '@lib/config/loadConfig'
import type { Locale } from '@config/site'

const PUBLIC_ROOT = path.join(process.cwd(), 'public')
const NOTES_ROOT = path.join(process.cwd(), 'content', 'notes')

/** Fences our generated block inside a user-owned `_headers`. */
const HEADERS_BEGIN = '# --- onvu:agents begin (generated, do not edit) ---'
const HEADERS_END = '# --- onvu:agents end ---'
/** Snapshot of the site's own `_headers`, so ours is never appended twice. */
const HEADERS_BASE = '.onvu-headers-base'

/**
 * Framework routes that sit directly under `/<locale>/notes/` without being
 * notes. They share the URL shape of a note page, so the generated per-note
 * `Link` header would otherwise point them at a mirror that does not exist.
 * Kept beside the route tree it mirrors: `src/app/[locale]/notes/*`.
 */
const NON_NOTE_ROUTES = ['graph']

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

/**
 * Resolve `note.parents` (frontmatter *names*) to note slugs.
 *
 * Same case-insensitive title match the note page uses, so a mirror links
 * exactly what the rendered breadcrumb links. A parent with no note behind it
 * keeps its name and gets no link, rather than being dropped or pointed at a
 * URL that 404s.
 */
function parentsOf(all: Note[], note: Note): Array<{ title: string; slug: string | null }> {
  const byTitle = new Map(all.map((n) => [n.title.toLowerCase(), n.slug]))
  return note.parents.map((name) => ({
    title: name,
    slug: byTitle.get(name.toLowerCase()) ?? null,
  }))
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

/**
 * The landing page, as data an agent can read.
 *
 * Built from `site.config.ts` rather than parsed out of `content/landing.tsx`
 * — the JSX is user-owned and can be rewritten freely, but the entries it
 * renders come from config either way, so config is the stable source.
 *
 * Localised via `loadSiteConfig`, which merges `site.<locale>.config.ts` over
 * the base: a translated job title or project description is picked up here
 * without any extra wiring.
 */
async function buildProfile(
  locale: Locale,
  hrefCtx: Parameters<typeof resolveConfigHref>[1],
): Promise<SiteProfile> {
  const cfg = await loadSiteConfig(locale)
  const href = (raw: string | undefined) => resolveConfigHref(raw, hrefCtx)
  const noteHref = (slug: string | undefined) =>
    slug ? href(`notes/${slug}`) : undefined

  return {
    name: cfg.owner.name,
    bio: cfg.owner.bio,
    socials: cfg.owner.socials.map((s) => ({ label: s.platform, url: s.url })),
    groups: [
      {
        heading: 'Summary',
        noteHref: noteHref(cfg.navigation.summaryNote),
        items: [],
      },
      {
        heading: 'Work Experience',
        noteHref: noteHref(cfg.navigation.workExperienceNote),
        items: cfg.home.workExperience.map((e) => ({
          title: e.role,
          meta: [e.company, e.period].filter(Boolean).join(', '),
          href: href(e.url),
        })),
      },
      {
        heading: 'Projects',
        noteHref: noteHref(cfg.navigation.projectsNote),
        items: cfg.home.projects.map((e) => ({
          title: e.name,
          description: e.description,
          href: href(e.url),
        })),
      },
      {
        heading: 'Education',
        noteHref: noteHref(cfg.navigation.educationNote),
        items: cfg.home.education.map((e) => ({
          title: e.degree,
          meta: [e.institution, e.period].filter(Boolean).join(', '),
          href: href(e.url),
        })),
      },
    ],
  }
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
 * Writes every agent-facing artifact for the whole site.
 *
 * Deliberately locale-agnostic despite being invoked from a per-locale layout.
 * Next generates static pages across a pool of worker processes, so
 * module-level state is per-worker: an emitter that accumulated locales across
 * calls saw only whichever subset landed in its own process, and wrote an
 * `llms.txt` silently missing the rest. Each invocation instead builds the
 * complete picture from all configured locales, so whichever worker runs it
 * produces the same finished file. The guard below keeps that to once per
 * process; repeated writes across workers are idempotent.
 *
 * Everything is off unless `agents.*` opts in, so the common case is an early
 * return costing one config read. Output goes to `public/`, which Next copies
 * into the export — the same route `emitStaticData` already uses.
 */
let done = false

export async function emitAgentArtifacts(): Promise<void> {
  // These are build products. In server mode the layout runs per request, and
  // writing into `public/` on a live request would be both pointless and
  // impossible on a read-only filesystem — so gate on the build phase, which
  // covers the static export (entirely a build) and server builds alike.
  if (process.env.NEXT_PHASE !== 'phase-production-build') return

  const cfg = resolveAgentsConfig()
  if (!cfg.markdown.enabled && !cfg.llmsTxt.enabled) return
  if (done) return
  done = true

  const perLocale = await Promise.all(
    routing.locales.map(async (locale) => {
      const all = await createRepository(locale).listAll()
      // A note excluded from search engines shouldn't get a machine-readable
      // mirror either — the author asked for it not to be surfaced.
      const notes = all.filter((n) => !n.noindex)
      const ctx: MirrorContext = {
        locale,
        noteUrl: (slug) => noteUrl(locale, slug),
        absoluteUrl,
        resolve: buildResolver(all),
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
                parents: cfg.markdown.include.parents ? parentsOf(all, note) : [],
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

      return { locale: locale as string, notes, bodies }
    }),
  )

  const withNotes = perLocale.filter((l) => l.notes.length > 0)

  if (cfg.llmsTxt.enabled) {
    const allBodies = new Map<string, string>()
    for (const l of perLocale) for (const [k, v] of l.bodies) allBodies.set(k, v)

    const llmsCtx = {
      siteName: siteConfig.owner.name,
      siteDescription: siteConfig.owner.bio,
      noteUrl: (loc: string, slug: string) => noteUrl(loc, slug),
      mirrorUrl: (loc: string, slug: string) => absoluteUrl(markdownMirrorPath(loc, slug)),
      hasMirrors: cfg.markdown.enabled,
    }

    // One profile block, from the primary locale. llms.txt is a single
    // site-wide index; repeating the same three sections once per locale
    // would triple its length to restate the same jobs and degrees. The
    // localised wording still reaches agents through the note mirrors.
    const profile = await buildProfile(siteConfig.locales.primary, {
      ...llmsCtx,
      locale: siteConfig.locales.primary,
      absoluteUrl,
    })

    await fs.writeFile(
      path.join(PUBLIC_ROOT, 'llms.txt'),
      buildLlmsTxt(withNotes, llmsCtx, profile),
      'utf-8',
    )
    if (cfg.llmsTxt.full) {
      await fs.writeFile(
        path.join(PUBLIC_ROOT, 'llms-full.txt'),
        buildLlmsFullTxt(withNotes, allBodies, llmsCtx, profile),
        'utf-8',
      )
    }
  }

  if (cfg.discovery.emitHeadersFile) {
    await writeHeadersFile({
      locales: withNotes.map((l) => l.locale),
      mirrors: cfg.markdown.enabled,
      llmsTxt: cfg.llmsTxt.enabled,
      llmsFull: cfg.llmsTxt.enabled && cfg.llmsTxt.full,
      nonNoteRoutes: NON_NOTE_ROUTES,
    })
  }
}

/**
 * Merge our rules into `public/_headers` instead of writing it.
 *
 * `_headers` is a file sites already own — it typically carries CSP, HSTS and
 * cache-control policy — so clobbering it would silently strip a site's
 * security headers. Our block is fenced by markers and rewritten in place, so
 * repeat builds stay idempotent and hand-written rules either side survive.
 */
async function writeHeadersFile(opts: HeadersFileOptions): Promise<void> {
  const target = path.join(PUBLIC_ROOT, '_headers')
  const basePath = path.join(PUBLIC_ROOT, HEADERS_BASE)

  const read = async (p: string) => {
    try {
      return await fs.readFile(p, 'utf-8')
    } catch {
      return null
    }
  }

  const current = await read(target)
  // The markers carry `(generated, do not edit)`, so they must be escaped —
  // unescaped, those parentheses become a capture group, the fence never
  // matches, and every build appends another block instead of replacing one.
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const fence = new RegExp(
    `\\n*${escape(HEADERS_BEGIN)}[\\s\\S]*?${escape(HEADERS_END)}\\n*`,
    'g',
  )

  // Never append to our own output. Page generation runs across worker
  // processes, and read-then-append let two of them both observe a
  // fence-free file and each add a block. Instead the site's own rules are
  // captured once as a base and the file is rebuilt from it every time, so
  // concurrent workers write byte-identical content and duplication is not
  // representable.
  let base: string
  if (current === null) {
    base = ''
  } else if (fence.test(current)) {
    fence.lastIndex = 0
    base = (await read(basePath)) ?? current.replace(fence, '\n').trimEnd()
  } else {
    base = current.trimEnd()
    await fs.writeFile(basePath, base, 'utf-8')
  }

  const block = `${HEADERS_BEGIN}\n${buildHeadersFile(opts).trimEnd()}\n${HEADERS_END}`
  await fs.writeFile(target, base ? `${base}\n\n${block}\n` : `${block}\n`, 'utf-8')
}
