import { siteUrl } from '@lib/seo/url'
import { robotsDisallowPaths } from '@lib/seo/noindex'
import { buildCrawlerRules, crawlerPolicy } from './crawlers'
import { buildContentSignal, contentSignals } from './contentSignals'

export interface RobotsGroup {
  userAgent: string
  allow?: string
  disallow?: string[]
  /** Rendered `Content-Signal` value, or null to omit the directive. */
  contentSignal?: string | null
}

export interface RobotsDocument {
  /** Comment lines emitted above the first group. */
  preamble: string[]
  groups: RobotsGroup[]
  host: string
  sitemap: string
}

/**
 * Build robots.txt ourselves rather than through Next's metadata route.
 *
 * `app/robots.ts` would be the idiomatic home for this, but Next's serializer
 * only understands `User-Agent`, `Allow`, `Disallow`, `Crawl-delay`, `Host`
 * and `Sitemap` — it silently drops any key it doesn't recognise, so
 * `Content-Signal` and explanatory comments cannot travel through it. The
 * rendering below reproduces that serializer's exact output (directive order,
 * casing, blank lines) so a site that configures none of this gets a
 * byte-identical file to the one it had before.
 */
export function buildRobots(): RobotsDocument {
  // Locale-expanded: a bare `/notes/graph` never matched `/en/notes/graph`.
  const disallow = robotsDisallowPaths()
  const signal = buildContentSignal(contentSignals())

  // No llms.txt pointer here on purpose: it lives at a fixed well-known path,
  // so an agent finds it the same way it finds this file. Mirrors are
  // advertised per-page via `rel="alternate"`.
  //
  // AI crawler groups come first so their specific rules are easy to read;
  // the wildcard group still governs everything not named. Present out of the
  // box, because `crawlerPolicy` blocks the training group by default — see
  // there for why that costs a site nothing, and how to opt back in.
  const crawlerRules = buildCrawlerRules(crawlerPolicy(), disallow)

  const groups: RobotsGroup[] = [
    ...crawlerRules.map((rule) => ({
      userAgent: rule.userAgent,
      allow: rule.allow,
      disallow: rule.disallow === undefined
        ? undefined
        : Array.isArray(rule.disallow)
          ? rule.disallow
          : [rule.disallow],
      // Restated per group for the same reason `disallow` is: robots.txt
      // groups are not merged. A crawler that finds its own name obeys that
      // group and never reads `User-agent: *`, so a signal stated only in the
      // wildcard group would be invisible to precisely the crawlers it is
      // aimed at.
      contentSignal: signal,
    })),
    { userAgent: '*', allow: '/', disallow, contentSignal: signal },
  ]

  return {
    preamble: signal
      ? [
          '# Content-Signal states how this content may be used once fetched,',
          '# which is a separate question from whether it may be fetched at all.',
          '# An omitted signal expresses no preference either way.',
          '# https://contentsignals.org',
        ]
      : [],
    groups,
    host: siteUrl(),
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}

/**
 * Serialise to robots.txt text.
 *
 * Directive order within a group follows the Content Signals policy's own
 * examples: the signal sits directly under the user-agent line it qualifies,
 * ahead of the access rules.
 */
export function renderRobotsTxt(doc: RobotsDocument): string {
  let content = ''

  if (doc.preamble.length > 0) content += `${doc.preamble.join('\n')}\n\n`

  for (const group of doc.groups) {
    content += `User-Agent: ${group.userAgent}\n`
    if (group.contentSignal) content += `Content-Signal: ${group.contentSignal}\n`
    if (group.allow) content += `Allow: ${group.allow}\n`
    for (const path of group.disallow ?? []) content += `Disallow: ${path}\n`
    content += '\n'
  }

  content += `Host: ${doc.host}\n`
  content += `Sitemap: ${doc.sitemap}\n`

  return content
}
