import type { MetadataRoute } from 'next'
import { createRepository } from '@adapters/createRepositories'
import { listAllNotes } from '@core/ListNotes'
import { routing } from '@i18n/routing'
import { absoluteUrl, localizedPath } from '@lib/seo/url'
import { isNoindexPath } from '@lib/seo/noindex'
import { noteLocaleIndex } from '@lib/seo/availableLocales'

export const dynamic = 'force-static'

/**
 * `xhtml:link` alternates for a path.
 *
 * `locales` defaults to every configured one, which is right for routes that
 * exist everywhere. Note entries pass the locales the note is actually written
 * in: the sitemap used to assert translations that 404, and since hreflang has
 * to be reciprocal, a dead entry invalidates the cluster rather than just
 * being ignored.
 */
function languagesFor(
  path: string,
  locales: readonly string[] = routing.locales,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const l of locales) out[l] = absoluteUrl(localizedPath(l, path))
  return out
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const entries: MetadataRoute.Sitemap = []

  for (const locale of routing.locales) {
    entries.push({
      url: absoluteUrl(localizedPath(locale, '/')),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
      alternates: { languages: languagesFor('/') },
    })
    if (!isNoindexPath('/notes')) {
      entries.push({
        url: absoluteUrl(localizedPath(locale, '/notes')),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
        alternates: { languages: languagesFor('/notes') },
      })
    }
  }

  const noteLocales = await noteLocaleIndex()

  const perLocaleNotes = await Promise.all(
    routing.locales.map(async (locale) => {
      const notes = await listAllNotes(createRepository(locale))
      return notes
        .filter((n) => !n.noindex && !isNoindexPath(`/notes/${n.slug}`))
        .map((n) => ({
          url: absoluteUrl(localizedPath(locale, `/notes/${n.slug}`)),
          lastModified: n.updated ?? n.date ?? now,
          changeFrequency: 'monthly' as const,
          priority: 0.6,
          alternates: {
            languages: languagesFor(`/notes/${n.slug}`, noteLocales.get(n.slug)),
          },
        }))
    }),
  )

  return [...entries, ...perLocaleNotes.flat()]
}
