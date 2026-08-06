import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import readingTime from 'reading-time'
import type { NoteRepository } from '@core/NoteRepository'
import type { Note } from '@core/Note'
import { processMarkdown } from '@lib/mdx/pipeline'
import { createWikiLinkResolver } from '@lib/notes/wikiLinkResolver'
import { noteHrefFor } from '@lib/notes/noteHref'
import { processNoteImage } from '@lib/images/processNoteImage'
import { processNoteVideo } from '@lib/images/processNoteVideo'
import { processStaticImage } from '@lib/images/processStaticImage'
import type { Locale } from '@config/site'

const NOTES_ROOT = path.join(process.cwd(), 'content', 'notes')

function localeDir(locale: Locale): string {
  return path.join(NOTES_ROOT, locale)
}

type NoteMeta = Omit<
  Note,
  | 'body'
  | 'headings'
  | 'outgoingLinks'
  | 'rawText'
  | 'coverImageSrcSet'
  | 'coverImageWidth'
  | 'coverImageHeight'
>

function parseNoteMeta(slug: string, raw: string): NoteMeta {
  const { data, content } = matter(raw)
  return {
    slug,
    title: String(data.title ?? slug),
    preview: String(data.preview ?? ''),
    coverImage: data.coverImage ? String(data.coverImage) : null,
    date: data.date ? new Date(data.date) : null,
    updated: data.updated ? new Date(data.updated) : null,
    description: data.description ? String(data.description) : null,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    author: data.author ? String(data.author) : null,
    noindex: Boolean(data.noindex),
    ogImage: data.ogImage ? String(data.ogImage) : null,
    parents: Array.isArray(data.parents) ? data.parents.map(String) : [],
    series: data.series ? String(data.series) : null,
    order: data.order != null ? Number(data.order) : null,
    isArchived: Boolean(data.archived),
    isDraft: Boolean(data.draft),
    isEpic: Boolean(data.epic),
    isPinned: Boolean(data.pinned),
    readingTimeMinutes: Math.ceil(readingTime(content).minutes),
  }
}

export class FileSystemNoteRepository implements NoteRepository {
  private cache: Map<string, Note> | null = null
  private listPromise: Promise<Note[]> | null = null
  private readonly dir: string

  constructor(private readonly locale: Locale) {
    this.dir = localeDir(locale)
  }

  async getBySlug(slug: string): Promise<Note | null> {
    // Make sure cache (and resolver) is warm so wiki links resolve correctly.
    const all = await this.listAll()
    return all.find((n) => n.slug === slug) ?? null
  }

  async listAll(): Promise<Note[]> {
    if (this.cache) return Array.from(this.cache.values())
    if (this.listPromise) return this.listPromise

    this.listPromise = (async () => {
      let files: string[]
      try {
        // Recursive: a vault is a tree, and this saw only its root. Every note
        // in a subfolder was silently invisible — no warning, no error, just an
        // empty garden. Slugs stay flat (the basename), so nothing downstream
        // has to learn about paths and existing URLs do not move; the folder
        // becomes an organisational convenience rather than a URL segment.
        files = await fs.readdir(this.dir, { recursive: true })
      } catch {
        // Locale folder doesn't exist — that locale just has no notes yet.
        return []
      }
      const mdFiles = files
        .filter((f) => f.endsWith('.md'))
        // A leading underscore on any segment means "not content" — the
        // convention every static generator uses for partials and scratch
        // folders, and the one an author reaches for to park work in progress.
        .filter((f) => !f.split(path.sep).some((seg) => seg.startsWith('_')))

      // Pass 1: read frontmatter for every note so we can resolve [[wiki links]].
      const rawByslug = new Map<string, { raw: string; content: string }>()
      const metas = new Map<string, NoteMeta>()
      /** slug → the file it came from, so a collision can name both sides. */
      const slugSources = new Map<string, string>()
      await Promise.all(
        mdFiles.map(async (file) => {
          // Basename, not path: two notes with the same filename in different
          // folders would collide, so that is reported rather than silently
          // resolved — see the duplicate check below.
          const slug = path.basename(file).replace(/\.md$/, '')
          const raw = await fs.readFile(path.join(this.dir, file), 'utf-8')
          const { content } = matter(raw)
          const clash = slugSources.get(slug)
          if (clash) {
            throw new Error(
              `[onvu] Two notes share the slug "${slug}": ` +
                `${clash} and ${file}. Slugs come from the filename, so a ` +
                `nested vault can collide across folders. Rename one.`,
            )
          }
          slugSources.set(slug, file)
          rawByslug.set(slug, { raw, content })
          metas.set(slug, parseNoteMeta(slug, raw))
        }),
      )

      const resolver = createWikiLinkResolver(metas.values())

      // Pass 2: process markdown bodies with the resolver wired in. Each
      // note gets its own image resolver scoped to the directory containing
      // its `.md` file — so authors can reference `./diagram.png` or
      // `assets/foo.png` and have those copied + resized to a stable URL.
      const notes = await Promise.all(
        Array.from(rawByslug.entries()).map(async ([slug, { content }]) => {
          const meta = metas.get(slug)!
          // Co-located images resolve beside the note's own file. With a flat
          // tree this was always the locale root; with a nested one, a note in
          // `permanent/` referencing `./diagram.png` means the copy in
          // `permanent/`.
          const noteDir = path.dirname(
            path.join(this.dir, slugSources.get(slug)!),
          )
          const { html, headings, outgoingLinks, rawText } =
            await processMarkdown(content, {
              resolveWikiLink: resolver,
              // This repository is per-locale, so its notes link within their
              // own language rather than through a redirect that guesses.
              noteHref: noteHrefFor(this.locale),
              resolveImage: (ref) => processNoteImage(ref, noteDir),
              resolveVideo: (ref) => processNoteVideo(ref, noteDir),
            })
          // Optimise the frontmatter cover image. Three cases:
          //   1. External URL (http://, data:) — left untouched.
          //   2. Relative path (`./cover.jpg`, `attachments/x.png`) —
          //      processNoteImage resolves against the note's directory.
          //   3. Absolute site path (`/notes-assets/foo.png`,
          //      `/images/banner.jpg`, or `/notes/<locale>/attachments/x`)
          //      — processStaticImage hits the same encoder, so a cover
          //      image and a body image pointing at the same file share
          //      one encoded output on disk.
          // Anything we can't optimise (SVG, unknown bucket, missing file)
          // falls back to the original ref so the original author intent
          // survives.
          let resolvedCoverImage: string | null = meta.coverImage
          let coverImageSrcSet: string | null = null
          let coverImageWidth: number | null = null
          let coverImageHeight: number | null = null
          if (meta.coverImage) {
            const isExternal = /^[a-z][a-z0-9+.-]*:\/\//i.test(meta.coverImage)
            if (!isExternal) {
              const optimised = meta.coverImage.startsWith('/')
                ? await processStaticImage(meta.coverImage)
                : await processNoteImage(meta.coverImage, noteDir)
              if (optimised) {
                resolvedCoverImage = optimised.src
                coverImageSrcSet = optimised.srcset || null
                coverImageWidth = optimised.width
                coverImageHeight = optimised.height
              }
            }
          }
          const note: Note = {
            ...meta,
            coverImage: resolvedCoverImage,
            coverImageSrcSet,
            coverImageWidth,
            coverImageHeight,
            body: html,
            headings,
            outgoingLinks,
            rawText,
          }
          return note
        }),
      )

      // Drafts stop here, at the single choke point every consumer already
      // goes through — the note list, the mention graph, the search index, the
      // sitemap, the feed, the markdown mirrors and `generateStaticParams`. A
      // filter per consumer is how one of them ends up forgotten, and the one
      // that forgets publishes the note.
      //
      // `ONVU_DRAFTS=1` shows them, so an author can read their own unfinished
      // writing on the dev server without editing frontmatter to check.
      const published =
        process.env.ONVU_DRAFTS === '1' ? notes : notes.filter((n) => !n.isDraft)

      this.cache = new Map(published.map((n) => [n.slug, n]))
      return published
    })()

    return this.listPromise
  }

  async listByParent(parent: string): Promise<Note[]> {
    const all = await this.listAll()
    return all.filter((n) =>
      n.parents.some((p) => p.toLowerCase() === parent.toLowerCase()),
    )
  }
}
