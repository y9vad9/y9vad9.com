import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { routing } from '@i18n/routing'
import { FileSystemNoteRepository } from '@adapters/fs/FileSystemNoteRepository'
import type { Locale } from '@config/site'
import type { Note } from '@core/Note'

/**
 * Content-health tests. These walk the actual `content/notes/` tree and
 * assert the references an author writes are valid:
 *
 *   - Cover images and body images point at files that exist.
 *   - Embedded videos point at files that exist.
 *   - Internal links (plain `/notes/<slug>` refs or resolved wiki links)
 *     point at notes that exist. Broken wiki links — `[[Missing]]` — are
 *     intentionally allowed because they have a dedicated visual marker
 *     (`wikilink-broken`); they're an editorial signal, not a bug.
 *   - External URLs are well-formed enough that `new URL(href)` accepts
 *     them. We don't hit the network.
 *
 * Failures are reported with `<file>:<line>` references so an author
 * jumping into their editor lands on the exact line that needs fixing.
 */

// Compute roots lazily so a test that chdirs into a tmp content set still
// resolves assets against the right location.
function publicRoot(): string { return path.join(process.cwd(), 'public') }
function notesRoot(): string { return path.join(process.cwd(), 'content', 'notes') }

function fileExistsAt(absolutePath: string): boolean {
  try {
    return fs.statSync(absolutePath).isFile()
  } catch {
    return false
  }
}

/**
 * A single content-health problem with enough context that the test
 * output points the author straight at the offending markdown line.
 */
interface Issue {
  /** Locale-prefixed path: `content/notes/en/foo.md`. */
  file: string
  /** 1-based line number where the offending reference appears in the
   *  raw markdown, or `null` if we couldn't locate it (the offence might
   *  be in frontmatter or in a generated fragment). */
  line: number | null
  /** What category of mistake: `image`, `video`, `link`, `external-url`,
   *  `frontmatter`. */
  kind: string
  /** The exact reference string the author wrote (URL, slug, or label). */
  ref: string
  /** Human-readable explanation of why this fails. */
  reason: string
}

function reportIssues(issues: Issue[], summary: string): void {
  if (issues.length === 0) return
  const lines = issues.map((i) => {
    const loc = i.line === null ? i.file : `${i.file}:${i.line}`
    return `  • ${loc}\n      ${i.kind}: ${i.reason}\n      ref: ${i.ref}`
  })
  // expect.fail keeps the assertion shape vitest expects but lets us
  // control every byte of the message — no "expected [] to equal [...]"
  // noise, just the punch list.
  expect.fail(
    `${summary} (${issues.length} issue${issues.length === 1 ? '' : 's'}):\n\n${lines.join('\n\n')}\n`,
  )
}

/**
 * Best-effort line lookup. Returns the 1-based line of the first occurrence
 * of `needle` in `raw`, ignoring matches inside the frontmatter block (the
 * content actually authored). Returns `null` if we can't find it.
 */
function findLine(raw: string, needle: string): number | null {
  if (!needle) return null
  // Skip the frontmatter — it's separately validated.
  let body = raw
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3)
    if (end > 0) body = raw.slice(end + 4)
  }
  const before = raw.length - body.length
  const idx = body.indexOf(needle)
  if (idx === -1) return null
  // Count newlines up to the match in the ORIGINAL string so the line
  // number matches the editor's view of the file.
  const absoluteIdx = before + idx
  return raw.slice(0, absoluteIdx).split(/\r?\n/).length
}

/**
 * Validate an `<img src>` / `<video><source src>` reference. Returns
 * `null` if everything is fine, or a `{ reason }` shape if not. The
 * caller adds the file path / line.
 */
function checkAsset(
  src: string,
  kind: 'image' | 'video',
  locale: string,
): string | null {
  if (!src) return `empty ${kind} src`
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(src)) return null // external URL
  if (src.startsWith('data:')) return null
  if (src.startsWith('//')) return null // protocol-relative — treated as external

  if (src.startsWith('/')) {
    const trimmed = src.replace(/^\/+/, '').split(/[?#]/)[0]
    return fileExistsAt(path.join(publicRoot(), trimmed))
      ? null
      : `not found at public/${trimmed}`
  }

  // Co-located ref — resolve against the note's locale dir.
  const cleaned = src.replace(/^\.\//, '').split(/[?#]/)[0]
  const localeDir = path.join(notesRoot(), locale)
  const candidate = path.resolve(localeDir, cleaned)
  if (!candidate.startsWith(localeDir + path.sep) && candidate !== localeDir) {
    return `escapes content/notes/${locale}: ${src}`
  }
  return fileExistsAt(candidate)
    ? null
    : `not found at content/notes/${locale}/${cleaned}`
}

function extractByTag(html: string, tag: string, attr: 'src' | 'href'): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*\\s${attr}=("|')([^"']+)\\1`, 'gi')
  const out: string[] = []
  for (const m of html.matchAll(re)) out.push(m[2])
  return out
}

function extractAnchors(
  html: string,
): Array<{ href: string; noteSlug: string | null; broken: boolean; label: string }> {
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  const out: Array<{ href: string; noteSlug: string | null; broken: boolean; label: string }> = []
  for (const m of html.matchAll(re)) {
    const attrs = m[1]
    const inner = m[2]
    const hrefMatch = attrs.match(/\shref=("|')([^"']+)\1/i)
    if (!hrefMatch) continue
    const href = hrefMatch[2]
    const classMatch = attrs.match(/\sclass=("|')([^"']*)\1/i)
    const broken = !!classMatch && /\bwikilink-broken\b/.test(classMatch[2])
    const slugMatch = attrs.match(/\sdata-note-slug=("|')([^"']+)\1/i)
    const noteSlug = slugMatch ? slugMatch[2] : null
    const label = inner.replace(/<[^>]+>/g, '').trim()
    out.push({ href, noteSlug, broken, label })
  }
  return out
}

function slugFromHref(href: string): string | null {
  const m = href.match(/^\/(?:[a-z]{2}\/)?notes\/([^#?/]+)/)
  return m ? m[1] : null
}

/** Read a note's raw markdown for line-number lookups. */
function readRaw(locale: string, slug: string): string {
  try {
    return fs.readFileSync(path.join(notesRoot(), locale, `${slug}.md`), 'utf-8')
  } catch {
    return ''
  }
}

/** Convenience to build the file path string used in failure output. */
function notePath(locale: string, slug: string): string {
  return `content/notes/${locale}/${slug}.md`
}

/** Find the line of an image reference written like `![alt](src)`. */
function findImageLine(raw: string, src: string): number | null {
  // Try the canonical `(src)` first, then the bare src as a fallback so
  // we still anchor inside an HTML <img> tag or a JSX-y form.
  return findLine(raw, `(${src})`) ?? findLine(raw, src)
}

/** Find the line of a video reference (authored the same way as images). */
function findVideoLine(raw: string, src: string): number | null {
  return findLine(raw, `(${src})`) ?? findLine(raw, src)
}

/** Find the line of a markdown link `[label](href)`. */
function findLinkLine(raw: string, href: string, label: string): number | null {
  return (
    findLine(raw, `](${href})`) ??
    (label ? findLine(raw, `[${label}](`) : null) ??
    findLine(raw, href)
  )
}

/** Find the line of a wiki link `[[Target]]` or `[[Target|Label]]`. */
function findWikiLine(raw: string, slug: string, label: string): number | null {
  return (
    findLine(raw, `[[${slug}]]`) ??
    findLine(raw, `[[${slug}|`) ??
    (label ? findLine(raw, `[[${label}]]`) : null) ??
    (label ? findLine(raw, `[[${label}|`) : null)
  )
}

/**
 * Per-test budget.
 *
 * These cases build a real `FileSystemNoteRepository`, which runs the note
 * through the full MDX pipeline — including image encoding, since
 * `checkAsset` verifies the *generated* file exists under `public/`. That is
 * the point: it proves a reference resolves all the way to a real file.
 *
 * The cost grew sharply when the encoder moved to an 11-rung ladder at
 * `effort: 6` with animated-GIF re-encoding. From cold, the heaviest locale
 * takes ~51s on a 4-core laptop, which fits the old 60s budget locally and
 * blows it on CI's 2-core runners — the suite went red on every push while
 * passing on every dev machine. The budget now reflects what the work
 * actually costs; `Test CI` caches `public/notes-assets` so the steady state
 * is fast and only a content or encoder change pays this in full.
 */
const ASSET_TEST_TIMEOUT_MS = 240_000

for (const locale of routing.locales) {
  describe(`content health [${locale}]`, () => {
    it('cover images, body images and videos all resolve', async () => {
      const repo = new FileSystemNoteRepository(locale as Locale)
      const notes = await repo.listAll()
      if (notes.length === 0) return
      const issues: Issue[] = []
      for (const note of notes) {
        const file = notePath(locale, note.slug)
        const raw = readRaw(locale, note.slug)

        if (note.coverImage) {
          const reason = checkAsset(note.coverImage, 'image', locale)
          if (reason) {
            issues.push({
              file,
              line: findLine(raw, 'coverImage'),
              kind: 'cover image',
              ref: note.coverImage,
              reason,
            })
          }
        }
        for (const src of extractByTag(note.body, 'img', 'src')) {
          const reason = checkAsset(src, 'image', locale)
          if (reason) {
            issues.push({
              file,
              line: findImageLine(raw, src),
              kind: 'image',
              ref: src,
              reason,
            })
          }
        }
        for (const src of extractByTag(note.body, 'source', 'src')) {
          const reason = checkAsset(src, 'video', locale)
          if (reason) {
            issues.push({
              file,
              line: findVideoLine(raw, src),
              kind: 'video',
              ref: src,
              reason,
            })
          }
        }
      }
      reportIssues(issues, 'Asset references failed validation')
    }, ASSET_TEST_TIMEOUT_MS)

    it('every internal link points at an existing note (broken wikilinks excepted)', async () => {
      const repo = new FileSystemNoteRepository(locale as Locale)
      const notes = await repo.listAll()
      if (notes.length === 0) return
      const slugSet = new Set(notes.map((n: Note) => n.slug))
      const issues: Issue[] = []
      for (const note of notes) {
        const file = notePath(locale, note.slug)
        const raw = readRaw(locale, note.slug)

        for (const link of note.outgoingLinks) {
          if (link.kind !== 'internal') continue
          if (slugSet.has(link.slug)) continue
          issues.push({
            file,
            line:
              findWikiLine(raw, link.slug, '') ??
              findLinkLine(raw, `/notes/${link.slug}`, '') ??
              findLine(raw, link.slug),
            kind: 'dead internal link',
            ref: link.slug,
            reason: `target note "${link.slug}" does not exist in content/notes/${locale}/`,
          })
        }

        for (const a of extractAnchors(note.body)) {
          if (a.broken) continue
          if (a.noteSlug && !slugSet.has(a.noteSlug)) {
            issues.push({
              file,
              line: findWikiLine(raw, a.noteSlug, a.label) ?? findLinkLine(raw, a.href, a.label),
              kind: 'dead resolved link',
              ref: a.noteSlug,
              reason: `anchor with data-note-slug="${a.noteSlug}" but that slug is missing`,
            })
            continue
          }
          const slug = slugFromHref(a.href)
          if (slug && !slugSet.has(slug)) {
            issues.push({
              file,
              line: findLinkLine(raw, a.href, a.label),
              kind: 'dead plain link',
              ref: a.href,
              reason: `link points at /notes/${slug} but that note doesn't exist`,
            })
          }
        }
      }
      reportIssues(issues, 'Internal links failed validation')
    }, ASSET_TEST_TIMEOUT_MS)

    it('every external link is a syntactically valid URL', async () => {
      const repo = new FileSystemNoteRepository(locale as Locale)
      const notes = await repo.listAll()
      if (notes.length === 0) return
      const issues: Issue[] = []
      for (const note of notes) {
        const file = notePath(locale, note.slug)
        const raw = readRaw(locale, note.slug)
        for (const link of note.outgoingLinks) {
          if (link.kind !== 'external') continue
          try {
            new URL(link.href)
          } catch {
            issues.push({
              file,
              line: findLinkLine(raw, link.href, ''),
              kind: 'malformed URL',
              ref: link.href,
              reason: 'new URL(href) threw — check protocol and host syntax',
            })
          }
        }
      }
      reportIssues(issues, 'External URLs failed validation')
    }, ASSET_TEST_TIMEOUT_MS)

    it('co-located videos in subdirectories are accepted (pipeline materialises them)', async () => {
      const tmpRoot = await fsp.realpath(
        await fsp.mkdtemp(path.join(os.tmpdir(), `onvu-vid-${locale}-`)),
      )
      const before = process.cwd()
      try {
        const noteDir = path.join(tmpRoot, 'content', 'notes', locale)
        await fsp.mkdir(path.join(noteDir, 'media'), { recursive: true })
        await fsp.writeFile(path.join(noteDir, 'media', 'demo.mp4'), 'X')
        await fsp.writeFile(
          path.join(noteDir, 'demo.md'),
          `---\ntitle: Demo\n---\n\n![clip](./media/demo.mp4)`,
          'utf-8',
        )
        process.chdir(tmpRoot)
        vi.resetModules()
        const { FileSystemNoteRepository: Repo } = await import(
          '@adapters/fs/FileSystemNoteRepository'
        )
        const note = (await new Repo(locale as Locale).getBySlug('demo'))!
        expect(note).toBeTruthy()
        const videoSrcs = extractByTag(note.body, 'source', 'src')
        expect(videoSrcs).toHaveLength(1)
        const err = checkAsset(videoSrcs[0], 'video', locale)
        expect(err).toBeNull()
      } finally {
        process.chdir(before)
      }
    }, 30_000)

    it('rejects co-located refs that live under a different locale folder', async () => {
      const otherLocale = routing.locales.find((l) => l !== locale)
      if (!otherLocale) return
      const tmpRoot = await fsp.realpath(
        await fsp.mkdtemp(path.join(os.tmpdir(), `onvu-iso-${locale}-`)),
      )
      const before = process.cwd()
      try {
        await fsp.mkdir(path.join(tmpRoot, 'content', 'notes', otherLocale), { recursive: true })
        await fsp.mkdir(path.join(tmpRoot, 'content', 'notes', locale), { recursive: true })
        await fsp.writeFile(
          path.join(tmpRoot, 'content', 'notes', otherLocale, 'shared.png'),
          'X',
        )
        process.chdir(tmpRoot)
        const err = checkAsset('./shared.png', 'image', locale)
        expect(err).toMatch(new RegExp(`content/notes/${locale}/shared\\.png`))
      } finally {
        process.chdir(before)
      }
    })

    it('frontmatter has the minimum fields the rest of the app relies on', async () => {
      const repo = new FileSystemNoteRepository(locale as Locale)
      const notes = await repo.listAll()
      if (notes.length === 0) return
      const issues: Issue[] = []
      for (const note of notes) {
        const file = notePath(locale, note.slug)
        const raw = readRaw(locale, note.slug)
        if (!note.title || note.title === note.slug) {
          issues.push({
            file,
            line: findLine(raw, 'title:') ?? 1,
            kind: 'frontmatter',
            ref: 'title',
            reason: `frontmatter is missing 'title' or it falls back to the slug "${note.slug}"`,
          })
        }
        if (note.parents.some((p) => !p.trim())) {
          issues.push({
            file,
            line: findLine(raw, 'parents:'),
            kind: 'frontmatter',
            ref: 'parents',
            reason: 'one of the parent entries is empty',
          })
        }
        if (note.date && Number.isNaN(note.date.getTime())) {
          issues.push({
            file,
            line: findLine(raw, 'date:'),
            kind: 'frontmatter',
            ref: 'date',
            reason: "'date' could not be parsed by `new Date(...)`",
          })
        }
        if (note.updated && Number.isNaN(note.updated.getTime())) {
          issues.push({
            file,
            line: findLine(raw, 'updated:'),
            kind: 'frontmatter',
            ref: 'updated',
            reason: "'updated' could not be parsed by `new Date(...)`",
          })
        }
      }
      reportIssues(issues, 'Frontmatter validation failed')
    }, ASSET_TEST_TIMEOUT_MS)

    it('every parent name resolves to a note title in the same locale', async () => {
      // The breadcrumb in `NoteArticle` links each parent name to a note
      // by case-insensitive title match (see `[locale]/notes/[slug]/page.tsx`).
      // If no note matches, the parent renders as plain text — which is a
      // *silent* authoring drift: a renamed parent note leaves its children
      // pointing at nothing. Catch that here so the build fails loudly
      // instead of shipping dead breadcrumbs.
      const repo = new FileSystemNoteRepository(locale as Locale)
      const notes = await repo.listAll()
      if (notes.length === 0) return
      const titleSet = new Set(notes.map((n) => n.title.toLowerCase()))
      const issues: Issue[] = []
      for (const note of notes) {
        const file = notePath(locale, note.slug)
        const raw = readRaw(locale, note.slug)
        for (const parent of note.parents) {
          if (!parent.trim()) continue // covered by the frontmatter test above
          if (titleSet.has(parent.toLowerCase())) continue
          issues.push({
            file,
            line: findLine(raw, parent) ?? findLine(raw, 'parents:'),
            kind: 'frontmatter',
            ref: parent,
            reason: `parent "${parent}" does not match the title of any note in locale "${locale}" — the breadcrumb will render as plain text instead of a link. Either rename the parent to match a note title exactly, or create a parent note with that title.`,
          })
        }
      }
      reportIssues(issues, 'Parent resolution failed')
    }, ASSET_TEST_TIMEOUT_MS)
  })
}
