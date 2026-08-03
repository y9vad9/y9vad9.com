import { routing } from '@i18n/routing'
import { createRepository } from '@adapters/createRepositories'
import { listAllNotes } from '@core/ListNotes'

/**
 * Which locales a note actually exists in.
 *
 * `hreflang` was emitted for every configured locale on every path, and the
 * sitemap asserted the same — so a note written only in Ukrainian declared
 * `hreflang="en"` and `hreflang="de"` alternates pointing at 404s. Google
 * requires hreflang to be reciprocal: a cluster containing a dead URL is
 * discarded, so this didn't just add noise, it discarded the annotations for
 * the notes that *were* translated.
 *
 * There is nothing to infer here — the repositories are already read during
 * `generateStaticParams` and the sitemap build, so the answer is a lookup.
 *
 * Cached per process: the sitemap asks once for every note, and each locale's
 * repository memoises its own reads anyway.
 */
let cache: Promise<Map<string, string[]>> | null = null

export function noteLocaleIndex(): Promise<Map<string, string[]>> {
  cache ??= (async () => {
    const index = new Map<string, string[]>()
    await Promise.all(
      routing.locales.map(async (locale) => {
        const notes = await listAllNotes(createRepository(locale))
        for (const note of notes) {
          const list = index.get(note.slug)
          if (list) list.push(locale)
          else index.set(note.slug, [locale])
        }
      }),
    )
    // Keep configured order rather than whichever locale resolved first, so
    // the emitted annotations are stable between builds.
    for (const [slug, locales] of index) {
      index.set(
        slug,
        routing.locales.filter((l) => locales.includes(l)),
      )
    }
    return index
  })()
  return cache
}

/**
 * Locales that can serve `slug`. Falls back to every locale for a slug nothing
 * knows about — a route that isn't a note, like the garden index, exists
 * everywhere.
 */
export async function localesForNote(slug: string): Promise<string[]> {
  const index = await noteLocaleIndex()
  return index.get(slug) ?? [...routing.locales]
}

/** Test seam: forget the memoised index. */
export function resetNoteLocaleIndex(): void {
  cache = null
}
