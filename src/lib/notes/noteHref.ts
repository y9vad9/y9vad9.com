import { config as siteConfig } from '~/site.config'
import { resolveStaticTarget } from '@lib/buildMode'
import type { Locale } from '@config/site'

/** Builds the `href` for a link to a note, given its slug. */
export type NoteHref = (slug: string) => string

/**
 * Where a link to a note should point.
 *
 * Wiki links are written into the HTML by a rehype plugin rather than by a
 * `<Link>`, so nothing downstream fills in the parts Next would have added.
 * Both parts matter, and both were missing:
 *
 * **The locale.** A bare `/notes/<slug>` is not a route this site serves —
 * every page lives under a locale prefix. It only ever resolved because a
 * host-level redirect caught it, and a redirect has to guess which language
 * the reader wanted. It guesses the primary one, so every wiki link followed
 * from a translated note landed the reader back in English.
 *
 * **The trailing slash.** A static export sets `trailingSlash`, and asking a
 * static host for the slashless form earns a 308 to the slashed one. Cheap,
 * but it is a redirect on every internal link in the garden, and it is
 * avoidable by spelling the URL the way the export writes it.
 *
 * Deliberately no `basePath`: `ArticleEnhancer` hands this attribute straight
 * to `router.push`, which prefixes the base path itself, so including it here
 * would apply it twice. That leaves raw non-JS navigation under a subpath
 * deployment as-is — a separate, pre-existing gap that `publicPath` documents.
 */
export function buildNoteHref(
  locale: Locale,
  slug: string,
  trailingSlash: boolean,
): string {
  return `/${locale}/notes/${slug}${trailingSlash ? '/' : ''}`
}

/**
 * `buildNoteHref` bound to one locale and to this build's URL shape.
 *
 * The trailing-slash rule is read from the same pair `next.config.ts` reads
 * for `trailingSlash`, so the links a build writes cannot disagree with the
 * files it emits.
 */
export function noteHrefFor(locale: Locale): NoteHref {
  const trailingSlash = resolveStaticTarget(process.env.ONVU_MODE, siteConfig.mode)
  return (slug) => buildNoteHref(locale, slug, trailingSlash)
}
