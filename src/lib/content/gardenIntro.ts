import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { processMarkdown } from '@lib/mdx/pipeline'
import { processNoteImage } from '@lib/images/processNoteImage'

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

export async function loadGardenIntro(locale: string): Promise<string | null> {
  // Locales come from the configured list, but this builds a filesystem path,
  // so refuse anything that could climb out of the directory.
  if (!/^[a-z]{2}(-[A-Za-z0-9]+)?$/.test(locale)) return null

  const dir = path.join(process.cwd(), GARDEN_INTRO_DIR)
  const file = path.join(dir, `${locale}.md`)

  let raw: string
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch {
    // No intro for this locale — the common case for a fresh site, and for
    // any locale the author has not written one in yet.
    return null
  }

  // Frontmatter is not needed here, but an author pasting a note in would
  // otherwise see `---\ntitle: …` rendered as body text.
  const { content } = matter(raw)
  if (!content.trim()) return null

  const { html } = await processMarkdown(content, {
    // Relative images resolve next to the intro file, exactly as they do
    // beside a note.
    resolveImage: (ref) => processNoteImage(ref, dir),
  })
  return html.trim() || null
}
