import type { MetadataRoute } from 'next'
import { config as siteConfig } from '~/site.config'
import { siteUrl } from '@lib/seo/url'
import { buildCrawlerRules, crawlerPolicy } from '@lib/agents/crawlers'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  const disallow = siteConfig.seo?.noindexPaths ?? ['/notes/graph']
  // No llms.txt pointer here on purpose: Next's robots route emits a fixed
  // set of directives and cannot carry comments, and llms.txt lives at a
  // fixed well-known path anyway — an agent finds it the same way it finds
  // this file. Mirrors are advertised per-page via `rel="alternate"`.
  //
  // AI crawler groups come first so their specific rules are easy to read;
  // the wildcard group still governs everything not named. Empty unless
  // `agents.crawlers` is configured, leaving robots.txt untouched by default.
  const crawlerRules = buildCrawlerRules(crawlerPolicy(), disallow)
  const wildcard = { userAgent: '*', allow: '/', disallow }

  return {
    // Unconfigured sites keep the exact single-group shape they had before
    // this feature existed — not merely equivalent output, the same value.
    rules: crawlerRules.length > 0 ? [...crawlerRules, wildcard] : wildcard,
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  }
}
