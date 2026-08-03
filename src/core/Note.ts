export interface Heading {
  id: string
  text: string
  /**
   * h1–h6. This capped at 4, while `rehype-slug` gave every heading an id —
   * so h5/h6 had working anchors that the table of contents never listed.
   */
  depth: 1 | 2 | 3 | 4 | 5 | 6
}

export type OutgoingLink =
  | { kind: 'internal'; slug: string }
  | { kind: 'external'; href: string }

export interface Note {
  slug: string
  title: string
  preview: string
  coverImage: string | null
  /** Responsive srcset string for `coverImage`, or null if the source is
   *  external / SVG / not in a bucket we own. Same format as the rest of
   *  the pipeline: `<url> <width>w, <url> <width>w`. */
  coverImageSrcSet: string | null
  coverImageWidth: number | null
  coverImageHeight: number | null
  date: Date | null
  /** Optional last-revision date. Rendered as "Updated …" next to `date`. */
  updated: Date | null
  /** SEO meta description; overrides `preview` for OG and `<meta description>`. */
  description: string | null
  /** Topical tags, surfaced as `keywords` meta and Article JSON-LD. */
  tags: string[]
  /** Optional author override (defaults to siteConfig.owner.name). */
  author: string | null
  /** Excluded from indexing — robots noindex, sitemap, and feed. */
  noindex: boolean
  /** Explicit social card override (absolute or site-relative). */
  ogImage: string | null
  parents: string[]
  series: string | null
  order: number | null
  isArchived: boolean
  /**
   * Kept in the repository, never published.
   *
   * Distinct from `archived`, which is a badge on a page that still exists,
   * and from `noindex`, which builds and lists the page while asking search
   * engines to look away. Neither is what a writer means by "not ready": a
   * vault of 400 notes has 250 nobody should see, and until this there was no
   * way to say so short of moving files out of the tree.
   *
   * Filtered at the repository boundary, so nothing downstream — the note
   * list, the graph, the search index, the sitemap, the feed, the markdown
   * mirrors, `generateStaticParams` — has to remember to exclude it.
   */
  isDraft: boolean
  isEpic: boolean
  /**
   * Author-chosen entry point, surfaced above everything else in the garden.
   *
   * Distinct from `isEpic`: an epic is a durable topic hub — another index to
   * traverse — while a pin is a note worth reading *now*. The index leads with
   * pins precisely because they need no traversal.
   */
  isPinned: boolean
  body: string
  headings: Heading[]
  /**
   * Every link out of this note in the order the author wrote them in the
   * body — internal note refs and external URLs interleaved. Used directly
   * for the right-side "Outgoing" panel so the visible order matches the
   * reading order; consumers that only care about internal links (mention
   * graph, backlinks) filter on `kind === 'internal'`.
   */
  outgoingLinks: OutgoingLink[]
  rawText: string
  readingTimeMinutes: number
}
