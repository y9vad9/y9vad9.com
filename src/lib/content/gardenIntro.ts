import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { processMarkdown, type WikiLinkResolver } from '@lib/mdx/pipeline'
import { processNoteImage } from '@lib/images/processNoteImage'
import { createWikiLinkResolver, type ResolvableNote } from '@lib/notes/wikiLinkResolver'

/**
 * The author's own opening for the garden index, read from
 * `content/garden/<locale>.md`.
 *
 * Deliberately *not* a note. Living under `content/notes/` would enrol it in
 * `listAllNotes`, the mention graph, the search index, the tab system and the
 * note list itself — five places that would each need an exclusion, and
 * exclusions are where the bugs live. Nobody wants a "Welcome" node in their
 * knowledge graph. Keeping it outside the note repository costs nothing: it
 * still goes through the same markdown pipeline, so links, images and
 * components all work.
 *
 * Returns null when the file is absent or blank, and the index then renders
 * no intro at all. That is on purpose. This slot used to hold
 * `garden.welcomeDescription` — a framework string shipped by the template —
 * which read as filler precisely because it was: generic copy standing in for
 * the author's voice. Blank beats boilerplate. Templates should ship an
 * example `content/garden/<locale>.md` instead, where it is obviously the
 * author's to rewrite or delete.
 */
export const GARDEN_INTRO_DIR = 'content/garden'

/** Longest `<meta name="description">` most engines will show. */
const SUMMARY_MAX = 160

/**
 * Read `content/garden/<locale>.md`, or null if there isn't one.
 *
 * The locale guard lives here because this is the function that builds a
 * filesystem path from it — locales come from the configured list, but nothing
 * downstream should have to remember that.
 */
async function readIntroSource(locale: string): Promise<string | null> {
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(locale)) return null
  const file = path.join(process.cwd(), GARDEN_INTRO_DIR, `${locale}.md`)
  try {
    return await fs.readFile(file, 'utf8')
  } catch {
    // No intro for this locale — the common case for a fresh site, and for
    // any locale the author has not written one in yet.
    return null
  }
}

/**
 * The intro's opening as plain text, for the garden index's meta description.
 *
 * Same reasoning as the intro itself, applied to the one place the framework
 * string outlived its removal: `garden.welcomeDescription` was dropped from
 * the page for reading as filler — "A living collection of notes, ideas, and
 * connections." — and stayed on as the `<meta description>` of every adopter's
 * garden, which is where filler does the most damage. An author's own opening
 * line is a real description; a template's is noise with a shared fingerprint.
 *
 * Returns null when there is no intro, and the caller then omits the field so
 * the site-level description applies. Blank beats boilerplate here too.
 */
export async function loadGardenIntroSummary(locale: string): Promise<string | null> {
  const raw = await readIntroSource(locale)
  if (!raw) return null

  const firstParagraph = matter(raw)
    .content.split(/\n\s*\n/)
    .map((block) => block.trim())
    // Skip headings and other block markers — an author whose intro opens with
    // "## Start here" means the prose underneath.
    .find((block) => block.length > 0 && !/^[#>\-*|]/.test(block))
  if (!firstParagraph) return null

  const text = firstParagraph
    // Enough markdown stripping for a description: links to their text,
    // emphasis and code fences to nothing.
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => alias ?? target)
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null

  if (text.length <= SUMMARY_MAX) return text
  // Cut on a word boundary rather than mid-word, then ellipsis.
  const clipped = text.slice(0, SUMMARY_MAX)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`
}

export async function loadGardenIntro(
  locale: string,
  /**
   * The corpus `[[Wiki Links]]` in the intro resolve against. Omit it and
   * links render as literal brackets — deliberately, rather than resolving
   * against nothing and marking every one broken. "We looked and it isn't
   * there" is a different claim from "we never looked."
   */
  notes?: Iterable<ResolvableNote>,
): Promise<string | null> {
  const dir = path.join(process.cwd(), GARDEN_INTRO_DIR)
  const raw = await readIntroSource(locale)
  if (!raw) return null

  // Frontmatter is not needed here, but an author pasting a note in would
  // otherwise see `---\ntitle: …` rendered as body text.
  const { content } = matter(raw)
  if (!content.trim()) return null

  // The intro is the page whose job is pointing readers into the garden, so
  // it gets the same link resolution a note does — when there is a corpus to
  // resolve against.
  const resolveWikiLink: WikiLinkResolver | undefined = notes
    ? createWikiLinkResolver(notes)
    : undefined

  const { html } = await processMarkdown(content, {
    // Relative images resolve next to the intro file, exactly as they do
    // beside a note.
    resolveImage: (ref) => processNoteImage(ref, dir),
    resolveWikiLink,
  })
  return html.trim() || null
}
