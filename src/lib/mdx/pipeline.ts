import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeKatex from 'rehype-katex'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeStringify from 'rehype-stringify'
import { visit, SKIP } from 'unist-util-visit'
import { toString as hastToString } from 'hast-util-to-string'
import type { Root as HastRoot, Element, ElementContent } from 'hast'
import type { Root as MdastRoot, Text as MdastText, Link as MdastLink, PhrasingContent } from 'mdast'
import type { Heading, OutgoingLink } from '@core/Note'

/**
 * Resolver used by the wiki-link plugin to map a `[[Target]]` reference to
 * an actual note. Targets may be a slug or a title — implementations should
 * normalise (case-insensitive, whitespace-tolerant) and return null when
 * nothing matches (the link is then rendered as broken).
 */
export type WikiLinkResolver = (target: string) => { slug: string; title: string } | null

/**
 * Resolves a relative image reference written in a note (e.g. `./diagram.png`)
 * to a final `<img>` payload. Returning null leaves the original reference in
 * place — useful when the file can't be found.
 */
export type ImageResolver = (ref: string) => Promise<{
  src: string
  srcset?: string
  width?: number
  height?: number
} | null>

/**
 * Resolves a relative video reference (anything ending in `.mp4`, `.webm`,
 * `.mov`, `.m4v`, `.ogg`/`.ogv`) written in a note to a public URL plus
 * its MIME type. Returning null leaves the original `<img>` in place.
 */
export type VideoResolver = (ref: string) => Promise<{
  src: string
  mimeType: string
} | null>

// ── Custom rehype plugins ────────────────────────────────────────────────
//
// Each function below returns a unified Plugin: `() => Transformer`.
// At `.use(plugin())`-time, unified invokes the outer function and stores
// the returned transformer to run against each parsed AST.

function rehypeExtractHeadings(out: Heading[]) {
  return () => (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      const m = /^h([1-4])$/.exec(node.tagName)
      if (!m) return
      const depth = Number(m[1]) as 1 | 2 | 3 | 4
      const id = typeof node.properties?.id === 'string' ? node.properties.id : ''
      if (!id) return
      out.push({ id, depth, text: hastToString(node) })
    })
  }
}

/**
 * Walks the rendered body once and collects every outgoing link in document
 * order, classifying each as internal (a note ref) or external (an http(s)
 * URL). The right-side panel renders the list as-is, so the visible order
 * matches the order the author wrote the links in the body. Duplicates
 * within a kind are skipped — the panel only ever shows the first
 * mention.
 */
function rehypeExtractAllOutgoingLinks(out: OutgoingLink[]) {
  return () => (tree: HastRoot) => {
    const seenSlugs = new Set<string>()
    const seenHrefs = new Set<string>()
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return
      const href = typeof node.properties?.href === 'string' ? node.properties.href : null
      if (!href) return
      if (/^https?:\/\//i.test(href)) {
        if (seenHrefs.has(href)) return
        seenHrefs.add(href)
        out.push({ kind: 'external', href })
        return
      }
      const m =
        href.match(/^\/(?:[a-z]{2}\/)?notes\/([^#?/]+)/) ??
        href.match(/^(?:\.\.?\/)?([^#?/.]+)\.md$/) ??
        href.match(/^\[\[([^\]]+)\]\]$/)
      if (!m) return
      const slug = m[1]
      if (seenSlugs.has(slug)) return
      seenSlugs.add(slug)
      out.push({ kind: 'internal', slug })
    })
  }
}

/**
 * Defer embedded iframes until they scroll into view.
 *
 * A pasted YouTube embed is the most expensive thing most notes contain. The
 * iframe boots a near-complete video player whether or not anyone presses
 * play — measured on one note here: 13 requests, ~1 MB, and 531 ms of main
 * thread, more than the entire application's own JavaScript. `loading="lazy"`
 * holds all of that back until the reader actually scrolls to the video,
 * which keeps it off the critical path without changing what happens when
 * they get there.
 *
 * An author-supplied `loading` is left alone — writing `loading="eager"` on a
 * specific embed is a deliberate choice.
 */
function rehypeLazyIframes() {
  // `<iframe` that does not already carry a `loading` attribute. The embeds
  // this targets arrive as raw HTML, so there is no parsed node to edit.
  const BARE_IFRAME = /<iframe\b(?![^>]*\bloading\s*=)([^>]*?)(\/?)>/gi

  return () => (tree: HastRoot) => {
    visit(tree, (node) => {
      // An author pastes YouTube's snippet as literal HTML, and with
      // `allowDangerousHtml` that survives to the output as a `raw` node —
      // a string, never an `element`. Matching only on `element` silently did
      // nothing to precisely the embeds this exists for.
      if (node.type === 'raw') {
        const raw = node as unknown as { value?: unknown }
        if (typeof raw.value === 'string' && raw.value.includes('<iframe')) {
          raw.value = raw.value.replace(BARE_IFRAME, '<iframe loading="lazy"$1$2>')
        }
        return
      }
      if (node.type !== 'element') return
      const el = node as Element
      if (el.tagName !== 'iframe') return
      if (el.properties?.loading !== undefined) return
      el.properties = { ...(el.properties ?? {}), loading: 'lazy' }
    })
  }
}

/**
 * Unwrap `[![](x.png)](x.png)` — an image linked to itself.
 *
 * Editors that export image galleries (Obsidian among them) emit this
 * constantly, and on a site that processes its images it is actively broken.
 * The `<img src>` gets rewritten to the generated `/notes-assets/…webp`, but
 * the `<a href>` is left as the author wrote it, so the anchor points at a
 * raw attachment path that the build never publishes — a guaranteed 404 on
 * every click. The wrapper also suppresses two behaviours the image should
 * have had: it hides the image from the carousel detector, which looks for a
 * cell containing exactly one `<img>`, and it swallows the click that would
 * otherwise open the lightbox.
 *
 * Only self-links are unwrapped. `[![](thumb.png)](https://example.com)` is a
 * deliberate link and is left alone, which is why the comparison is against
 * the image's own `src` rather than "does this anchor contain an image".
 *
 * Must run before `rehypeNoteImages` — afterwards the `src` has been
 * rewritten and no longer resembles the `href` it was written to match. It
 * also runs before `rehypeInlineImages`, which strips `?inline` from the
 * `src` but cannot strip it from the `href`.
 */
function rehypeUnwrapSelfLinkedImages() {
  const normalise = (value: string): string => {
    let out = value.trim()
    try {
      out = decodeURI(out)
    } catch {
      // A malformed escape is not a match candidate; compare it raw.
    }
    return out.replace(/^\.\//, '')
  }

  return () => (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return
      const href = typeof node.properties?.href === 'string' ? node.properties.href : ''
      if (!href) return

      // Anchor text alongside the image means the link is doing something of
      // its own; only a bare image wrapper is safe to remove.
      const hasText = node.children.some(
        (child) => child.type === 'text' && child.value.trim() !== '',
      )
      if (hasText) return

      const elements = node.children.filter(
        (child): child is Element => child.type === 'element',
      )
      if (elements.length !== 1 || elements[0].tagName !== 'img') return

      const img = elements[0]
      const src = typeof img.properties?.src === 'string' ? img.properties.src : ''
      if (!src || normalise(href) !== normalise(src)) return

      node.tagName = img.tagName
      node.properties = img.properties
      node.children = img.children
    })
  }
}

// Detects the `?inline` marker on image URLs and turns the image into an
// inline emoji-sized element. Authors write `![alt](/path/img.gif?inline)`
// and we (a) strip the marker so the browser fetches the real file, (b)
// tag the img with the `inline-image` class which `globals.css` styles as
// a fixed-height inline-block, and (c) hoist it out of its wrapping <p> so
// the inline glyph flows alongside surrounding text rather than living in
// its own paragraph (Markdown auto-wraps top-level images in a <p>).
function rehypeInlineImages() {
  const INLINE_QUERY = /\?inline(?=$|&|#)/

  function markInlineIfMatched(node: Element): boolean {
    if (node.tagName !== 'img') return false
    const src = typeof node.properties?.src === 'string' ? node.properties.src : ''
    if (!src || !INLINE_QUERY.test(src)) return false
    const stripped = src.replace(INLINE_QUERY, '').replace(/[?&]$/, '')
    const existingClass = node.properties?.className
    const classes = Array.isArray(existingClass)
      ? [...(existingClass as Array<string | number>).map(String), 'inline-image']
      : ['inline-image']
    node.properties = {
      ...(node.properties ?? {}),
      src: stripped,
      className: classes,
    }
    // Inline images shouldn't carry srcset/width/height that the note-image
    // resolver may have attached — they'd fight the fixed CSS height.
    if (node.properties) {
      delete (node.properties as Record<string, unknown>).srcset
      delete (node.properties as Record<string, unknown>).sizes
      delete (node.properties as Record<string, unknown>).width
      delete (node.properties as Record<string, unknown>).height
    }
    return true
  }

  return () => (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'img') return
      markInlineIfMatched(node)
    })
  }
}

function rehypeImageCarousel() {
  return () => (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'table') return

      // Only consider data cells (<td>); header cells (<th>) carry titles, not content.
      const dataCells: Element[] = []
      visit(node, 'element', (cell: Element) => {
        if (cell.tagName === 'td') dataCells.push(cell)
      })
      if (dataCells.length === 0) return

      const allImages = dataCells.every((cell) => {
        const elements = cell.children.filter(
          (c): c is Element => c.type === 'element',
        )
        return elements.length === 1 && elements[0].tagName === 'img'
      })
      if (!allImages) return

      const images: ElementContent[] = []
      for (const cell of dataCells) {
        for (const child of cell.children) {
          if (child.type === 'element' && child.tagName === 'img') {
            images.push(child)
          }
        }
      }

      node.tagName = 'div'
      node.properties = { className: ['carousel'] }
      node.children = images
    })
  }
}

// ── Wiki link plugin ─────────────────────────────────────────────────────
//
// Transforms `[[Target]]` and `[[Target|Display]]` syntax inside text nodes
// into Markdown links resolved against the project's note collection.
// Unresolved targets are still rendered as anchors but marked with the
// `wikilink-broken` class so authors can spot dangling references.

const WIKILINK_RE = /\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g

/**
 * A "bare" link target — no slashes, no protocol, no fragment, no file
 * extension — should be treated as a wiki-link target. This catches the
 * common `[Note Title](Note Title)` shorthand that authors fall into.
 */
function isBareLinkTarget(url: string): boolean {
  if (!url) return false
  if (/[\\/:#?]/.test(url)) return false
  if (/^[a-z]+:/i.test(url)) return false // protocol like mailto:
  if (/\.[a-z0-9]{1,5}$/i.test(url)) return false // file extension
  return true
}

function remarkWikiLinks(resolve: WikiLinkResolver) {
  return () => (tree: MdastRoot) => {
    // Pass A: rewrite bare `[text](target)` markdown links into wiki links.
    visit(tree, 'link', (node: MdastLink) => {
      if (!isBareLinkTarget(node.url)) return
      const resolved = resolve(node.url)
      if (!resolved) {
        // Mark unresolved bare targets as broken wiki links too.
        node.data = {
          ...(node.data ?? {}),
          hProperties: {
            ...((node.data?.hProperties as Record<string, unknown> | undefined) ?? {}),
            className: ['wikilink', 'wikilink-broken'],
          },
        }
        node.url = '#'
        return
      }
      node.url = `/notes/${resolved.slug}`
      node.title = resolved.title
      node.data = {
        ...(node.data ?? {}),
        hProperties: {
          ...((node.data?.hProperties as Record<string, unknown> | undefined) ?? {}),
          className: ['wikilink'],
          'data-note-slug': resolved.slug,
        },
      }
    })

    // Pass B: rewrite explicit `[[Target]]` syntax inside text nodes.
    visit(tree, 'text', (node: MdastText, index, parent) => {
      if (!parent || index === undefined) return
      if (parent.type === 'link') return // never rewrite inside an existing link
      const text = node.value
      const matches = Array.from(text.matchAll(WIKILINK_RE))
      if (matches.length === 0) return

      const replacements: PhrasingContent[] = []
      let cursor = 0
      for (const m of matches) {
        const start = m.index ?? 0
        if (start > cursor) {
          replacements.push({ type: 'text', value: text.slice(cursor, start) })
        }
        const target = m[1].trim()
        const display = (m[2] ?? m[1]).trim()
        const resolved = resolve(target)
        const link: MdastLink = {
          type: 'link',
          url: resolved ? `/notes/${resolved.slug}` : '#',
          title: resolved ? resolved.title : undefined,
          children: [{ type: 'text', value: display }],
          data: {
            hProperties: {
              className: resolved ? ['wikilink'] : ['wikilink', 'wikilink-broken'],
              ...(resolved ? { 'data-note-slug': resolved.slug } : {}),
            },
          },
        }
        replacements.push(link)
        cursor = start + m[0].length
      }
      if (cursor < text.length) {
        replacements.push({ type: 'text', value: text.slice(cursor) })
      }

      parent.children.splice(index, 1, ...replacements)
      return [SKIP, index + replacements.length]
    })
  }
}

// ── Mermaid diagrams ─────────────────────────────────────────────────────
//
// Replace ```mermaid``` fenced code blocks with a placeholder `<div>` that
// carries the diagram source as a data-attribute. A client-side renderer
// finds these and hands them to the `mermaid` library at view time. Runs
// before `rehype-pretty-code` so the source isn't tokenised first.

// ── Co-located image rewriter ─────────────────────────────────────────────
//
// Rewrites markdown image references like `./diagram.png` (relative to the
// note's folder) to a resolved final URL — typically a content-addressed
// path under /notes-assets emitted by `processNoteImage`. Also attaches
// `srcset`, `width`, and `height` so the browser can pick an appropriate
// variant and avoid layout shift.

function rehypeNoteImages(resolve: ImageResolver) {
  return () => async (tree: HastRoot) => {
    const targets: Element[] = []
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'img') return
      const src = typeof node.properties?.src === 'string' ? node.properties.src : ''
      if (!src) return
      // Don't rewrite already-absolute, protocol, data, or public-prefixed URLs.
      if (/^[a-z]+:/i.test(src) || src.startsWith('/') || src.startsWith('//')) return
      targets.push(node)
    })
    await Promise.all(
      targets.map(async (node) => {
        const src = String(node.properties!.src)
        const resolved = await resolve(src)
        if (!resolved) return
        const classList = Array.isArray(node.properties?.className)
          ? (node.properties!.className as Array<string | number>).map(String)
          : []
        const isInline = classList.includes('inline-image')
        node.properties = {
          ...(node.properties ?? {}),
          src: resolved.src,
          loading: 'lazy',
          decoding: 'async',
          // Skip responsive variants for inline (emoji-sized) images — they
          // wouldn't be picked at the rendered size anyway.
          ...(!isInline && resolved.srcset
            ? {
                srcset: resolved.srcset,
                sizes: '(min-width: 768px) 720px, calc(100vw - 80px)',
              }
            : {}),
          ...(!isInline && resolved.width ? { width: resolved.width } : {}),
          ...(!isInline && resolved.height ? { height: resolved.height } : {}),
        }
      }),
    )
  }
}

/**
 * Detects `<img>` tags whose src points at a video file (`.mp4`, `.webm`, …)
 * and rewrites them into `<video controls preload="metadata">` with a
 * `<source>` child. Markdown gives us no syntax for videos, so authors write
 * them like images (`![caption](demo.mp4)`) and we adapt at render time.
 * Runs BEFORE the image resolver so Sharp never sees a non-image buffer.
 */
/**
 * Turn video-extension image references into real `<video>` elements.
 *
 * `preload="none"` rather than `"metadata"`: Chrome implements a metadata
 * preload as a full GET that it aborts once it has the header, followed by a
 * ranged re-request — two connections and, measured on a 2.09 MB webm here,
 * 94 KB pulled down on every page view whether or not anyone presses play.
 * The layout does not need the metadata either, since `.note-video` pins
 * `aspect-ratio: 16 / 9` in CSS, so nothing shifts when the video finally
 * loads. Readers who do press play pay exactly the same cost, just later.
 */
function rehypeNoteVideos(resolve: VideoResolver) {
  const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg|ogv)(\?[^#]*)?(#.*)?$/i
  return () => async (tree: HastRoot) => {
    const targets: Element[] = []
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'img') return
      const src = typeof node.properties?.src === 'string' ? node.properties.src : ''
      if (!src || !VIDEO_EXT.test(src)) return
      // Skip absolute/external URLs — they're already a resolved location;
      // the user can drop them straight in without our processing.
      if (/^[a-z]+:/i.test(src) || src.startsWith('//')) {
        const alt = typeof node.properties?.alt === 'string' ? node.properties.alt : ''
        const ext = src.match(VIDEO_EXT)![1].toLowerCase()
        const mime =
          ext === 'webm' ? 'video/webm'
            : ext === 'mov' ? 'video/quicktime'
              : ext === 'ogg' || ext === 'ogv' ? 'video/ogg'
                : 'video/mp4'
        node.tagName = 'video'
        node.properties = { controls: true, preload: 'none', className: ['note-video'] }
        node.children = [
          { type: 'element', tagName: 'source', properties: { src, type: mime }, children: [] },
          { type: 'text', value: alt || 'Video' },
        ]
        return
      }
      targets.push(node)
    })

    await Promise.all(
      targets.map(async (node) => {
        const src = String(node.properties!.src)
        const resolved = await resolve(src)
        if (!resolved) return
        const alt = typeof node.properties?.alt === 'string' ? node.properties.alt : ''
        node.tagName = 'video'
        node.properties = {
          controls: true,
          preload: 'none',
          className: ['note-video'],
        }
        node.children = [
          {
            type: 'element',
            tagName: 'source',
            properties: { src: resolved.src, type: resolved.mimeType },
            children: [],
          },
          { type: 'text', value: alt || 'Video' },
        ]
      }),
    )
  }
}

// ── External link enrichment (markdown rendering only) ──────────────────
//
// Tags `<a href="https://…">` links in the rendered body with an
// `external-link` class and opens them in a new tab. The class powers the
// CSS arrow icon in `globals.css`; the target/rel attributes give safe
// new-tab behaviour. No network access here — title resolution for the
// outgoing-links side panel happens in the note page server component
// (see `lib/links/fetchExternalTitle.ts`), which is where the result is
// actually surfaced to the user.

function rehypeExternalLinks() {
  return () => (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return
      const href =
        typeof node.properties?.href === 'string' ? node.properties.href : ''
      if (!/^https?:\/\//i.test(href)) return
      const existingClasses = Array.isArray(node.properties?.className)
        ? (node.properties!.className as Array<string | number>).map(String)
        : []
      node.properties = {
        ...(node.properties ?? {}),
        className: [...new Set([...existingClasses, 'external-link'])],
        target: '_blank',
        // `rel` is a space-separated list, and hast models those as arrays —
        // the serializer joins them back into `rel="noopener noreferrer"`.
        // A single string typechecked under the older @types/hast but was
        // always the wrong shape.
        rel: ['noopener', 'noreferrer'],
      }
    })
  }
}

function rehypeMermaidPlaceholders() {
  return () => (tree: HastRoot) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre' || index === undefined || !parent) return
      const code = node.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'code',
      )
      if (!code) return
      const langClass = Array.isArray(code.properties?.className)
        ? (code.properties!.className as Array<string | number>)
        : []
      const isMermaid = langClass.some((c) => String(c) === 'language-mermaid')
      if (!isMermaid) return

      let source = ''
      for (const child of code.children) {
        if (child.type === 'text') source += child.value
      }
      source = source.replace(/\n+$/g, '')

      const placeholder: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['mermaid'],
          'data-mermaid-source': source,
        },
        children: [],
      }
      parent.children.splice(index, 1, placeholder)
    })
  }
}

function rehypeCaptureRawText(setter: (text: string) => void) {
  return () => (tree: HastRoot) => {
    const chunks: string[] = []
    visit(tree, 'text', (node) => {
      chunks.push(node.value)
    })
    setter(chunks.join(' ').replace(/\s+/g, ' ').trim())
  }
}

// ── Public API ───────────────────────────────────────────────────────────

export interface ProcessedNote {
  html: string
  headings: Heading[]
  outgoingLinks: OutgoingLink[]
  rawText: string
}

export async function processMarkdown(
  content: string,
  options: {
    resolveWikiLink?: WikiLinkResolver
    resolveImage?: ImageResolver
    resolveVideo?: VideoResolver
  } = {},
): Promise<ProcessedNote> {
  const headings: Heading[] = []
  const outgoingLinks: OutgoingLink[] = []
  let rawText = ''

  let chain = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
  if (options.resolveWikiLink) {
    chain = chain.use(remarkWikiLinks(options.resolveWikiLink))
  }
  const rehypeChain = chain
    .use(remarkRehype, { allowDangerousHtml: true })
    // Before every image plugin: it compares `href` against the *authored*
    // `src`, which later stages rewrite.
    .use(rehypeUnwrapSelfLinkedImages())
  // Inline-image detection runs BEFORE the note-image resolver so the
  // resolver sees a cleaned src (no `?inline` suffix) and so the inline
  // marker is in place — `rehypeNoteImages` skips srcset/width/height on
  // inline-marked images since the CSS pins their height.
  const withInline = rehypeChain.use(rehypeInlineImages())
  // Videos must run before image resolution, otherwise Sharp would try to
  // decode an mp4 buffer. After this plugin, video-extension `<img>` tags
  // become `<video>` and the image resolver skips them.
  const withVideos = options.resolveVideo
    ? withInline.use(rehypeNoteVideos(options.resolveVideo))
    : withInline
  const withImages = options.resolveImage
    ? withVideos.use(rehypeNoteImages(options.resolveImage))
    : withVideos
  const result = await withImages
    .use(rehypeSlug)
    // Extract headings BEFORE autolink injects '#' content
    .use(rehypeExtractHeadings(headings))
    .use(rehypeAutolinkHeadings, {
      behavior: 'append',
      properties: { className: ['anchor-icon'], ariaLabel: 'Link to section' },
      content: { type: 'text', value: '#' },
    })
    .use(rehypeExtractAllOutgoingLinks(outgoingLinks))
    .use(rehypeExternalLinks())
    .use(rehypeKatex)
    .use(rehypeLazyIframes())
    .use(rehypeImageCarousel())
    .use(rehypeCaptureRawText((t) => { rawText = t }))
    // Pull mermaid blocks out of the highlighting path — they're rendered
    // as diagrams on the client, not as syntax-highlighted source.
    .use(rehypeMermaidPlaceholders())
    .use(rehypePrettyCode, {
      theme: { dark: 'github-dark', light: 'github-light' },
      keepBackground: false,
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content)

  return { html: String(result), headings, outgoingLinks, rawText }
}
