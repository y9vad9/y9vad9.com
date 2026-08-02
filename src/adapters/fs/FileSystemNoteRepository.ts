import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import readingTime from 'reading-time'
import type { NoteRepository } from '@core/NoteRepository'
import type { Note } from '@core/Note'
import { processMarkdown, type WikiLinkResolver } from '@lib/mdx/pipeline'
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
  const { data } = matter(raw)
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
    isEpic: Boolean(data.epic),
    isPinned: Boolean(data.pinned),
    readingTimeMinutes: Math.ceil(readingTime(raw).minutes),
  }
}

function normaliseKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/** Build a resolver mapping wiki-link targets (slug OR title) to a note. */
function buildResolver(metas: Map<string, NoteMeta>): WikiLinkResolver {
  const bySlug = new Map<string, NoteMeta>()
  const byTitle = new Map<string, NoteMeta>()
  for (const m of metas.values()) {
    bySlug.set(m.slug.toLowerCase(), m)
    byTitle.set(m.title.toLowerCase(), m)
  }
  return (target) => {
    const direct =
      bySlug.get(target.toLowerCase()) ??
      byTitle.get(target.toLowerCase()) ??
      bySlug.get(normaliseKey(target))
    return direct ? { slug: direct.slug, title: direct.title } : null
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
        files = await fs.readdir(this.dir)
      } catch {
        // Locale folder doesn't exist — that locale just has no notes yet.
        return []
      }
      const mdFiles = files.filter((f) => f.endsWith('.md'))

      // Pass 1: read frontmatter for every note so we can resolve [[wiki links]].
      const rawByslug = new Map<string, { raw: string; content: string }>()
      const metas = new Map<string, NoteMeta>()
      await Promise.all(
        mdFiles.map(async (file) => {
          const slug = file.replace(/\.md$/, '')
          const raw = await fs.readFile(path.join(this.dir, file), 'utf-8')
          const { content } = matter(raw)
          rawByslug.set(slug, { raw, content })
          metas.set(slug, parseNoteMeta(slug, raw))
        }),
      )

      const resolver = buildResolver(metas)

      // Pass 2: process markdown bodies with the resolver wired in. Each
      // note gets its own image resolver scoped to the directory containing
      // its `.md` file — so authors can reference `./diagram.png` or
      // `assets/foo.png` and have those copied + resized to a stable URL.
      const noteDir = this.dir
      const notes = await Promise.all(
        Array.from(rawByslug.entries()).map(async ([slug, { content }]) => {
          const meta = metas.get(slug)!
          const { html, headings, outgoingLinks, rawText } =
            await processMarkdown(content, {
              resolveWikiLink: resolver,
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

      this.cache = new Map(notes.map((n) => [n.slug, n]))
      return notes
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
