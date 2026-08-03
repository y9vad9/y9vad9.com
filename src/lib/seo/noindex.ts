import { config as siteConfig } from '~/site.config'
import { routing } from '@i18n/routing'

/**
 * What `seo.noindexPaths` means, in one place.
 *
 * It had two consumers that disagreed about the shape of its entries, and each
 * carried its own copy of the default:
 *
 *   - the sitemap compared them against *unprefixed* paths (`/notes/graph`)
 *   - robots.txt emitted them *verbatim* (`Disallow: /notes/graph`)
 *
 * Every real page URL is locale-prefixed, and `Disallow` is a prefix match
 * from the site root, so the robots half matched nothing at all — not
 * `/en/notes/graph`, not `/uk/notes/graph`. The rule looked like protection
 * and was decoration. (`tests/app/robots.test.ts` asserted the string appeared
 * in the output, not that it matched a URL, so it locked the bug in.)
 *
 * Configured paths stay unprefixed, because that is how an author thinks about
 * their own routes. Expanding them across `routing.locales` is this module's
 * job, so adding a locale can never leave a disallow rule behind.
 */
export const DEFAULT_NOINDEX_PATHS: readonly string[] = ['/notes/graph']

/** As configured — unprefixed, one entry per route the author named. */
export function noindexPaths(): readonly string[] {
  return siteConfig.seo?.noindexPaths ?? DEFAULT_NOINDEX_PATHS
}

/** Does this unprefixed path sit under a noindex route? Used by the sitemap. */
export function isNoindexPath(path: string): boolean {
  return noindexPaths().includes(path)
}

/**
 * The same list as robots.txt needs it: one rule per locale.
 *
 * The bare path is kept alongside the expansions. It costs a line, and it is
 * the correct rule for a site that ever stops prefixing its URLs — the entry
 * an author wrote should not quietly become wrong because routing changed.
 */
export function robotsDisallowPaths(): string[] {
  const configured = noindexPaths()
  const out: string[] = []
  for (const path of configured) {
    out.push(path)
    for (const locale of routing.locales) out.push(`/${locale}${path}`)
  }
  return out
}
