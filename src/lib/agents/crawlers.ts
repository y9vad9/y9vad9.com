import { config as siteConfig } from '~/site.config'

export type CrawlerStance = 'allow' | 'block'

export type CrawlerGroup = 'training' | 'aiSearch' | 'userTriggered'

export interface CrawlerEntry {
  /** robots.txt user-agent token, exactly as the vendor documents it. */
  token: string
  group: CrawlerGroup
  vendor: string
  /** True when the token was checked against the vendor's own docs. */
  verified: boolean
}

/**
 * The AI crawler landscape, grouped by what blocking one actually costs you.
 *
 * The grouping is the whole point. "AI crawler" lumps together three jobs with
 * very different consequences, and the difference is not guessable from the
 * name:
 *
 *  - `training` — content feeds model training. Blocking costs you nothing in
 *    any search product.
 *  - `aiSearch` — retrieval crawlers whose index is what AI answers cite.
 *    Blocking these is what removes you from AI answers.
 *  - `userTriggered` — a fetch made because a person just asked a question
 *    about your page. Note OpenAI and Perplexity both document that these
 *    largely ignore robots.txt, since a human initiated the request — so a
 *    rule here is a statement of preference more than a control.
 *
 * `Google-Extended` deserves special mention: it is a robots.txt control
 * token, not a crawler with its own requests. Google states it "does not
 * impact a site's inclusion in Google Search nor is it used as a ranking
 * signal", so you can refuse Gemini training without touching Search or AI
 * Overviews. Googlebot and Bingbot are deliberately absent from every group
 * below — they are ordinary search crawlers, and blocking them would delist
 * you from search entirely.
 *
 * Tokens marked `verified` were checked against the vendor's own
 * documentation. The rest are widely documented but unconfirmed here; a
 * mistyped token is inert rather than harmful, but do not treat an
 * unverified entry as a guarantee.
 */
export const AI_CRAWLERS: CrawlerEntry[] = [
  // https://developers.openai.com/api/docs/bots
  { token: 'GPTBot', group: 'training', vendor: 'OpenAI', verified: true },
  { token: 'OAI-SearchBot', group: 'aiSearch', vendor: 'OpenAI', verified: true },
  { token: 'ChatGPT-User', group: 'userTriggered', vendor: 'OpenAI', verified: true },
  // https://support.claude.com/en/articles/8896518
  { token: 'ClaudeBot', group: 'training', vendor: 'Anthropic', verified: true },
  { token: 'Claude-SearchBot', group: 'aiSearch', vendor: 'Anthropic', verified: true },
  { token: 'Claude-User', group: 'userTriggered', vendor: 'Anthropic', verified: true },
  // https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers
  { token: 'Google-Extended', group: 'training', vendor: 'Google', verified: true },
  { token: 'Google-CloudVertexBot', group: 'aiSearch', vendor: 'Google', verified: true },
  // https://docs.perplexity.ai/guides/bots
  { token: 'PerplexityBot', group: 'aiSearch', vendor: 'Perplexity', verified: true },
  { token: 'Perplexity-User', group: 'userTriggered', vendor: 'Perplexity', verified: true },
  // Widely documented, not vendor-checked here.
  { token: 'CCBot', group: 'training', vendor: 'Common Crawl', verified: false },
  { token: 'Applebot-Extended', group: 'training', vendor: 'Apple', verified: false },
  { token: 'Meta-ExternalAgent', group: 'training', vendor: 'Meta', verified: false },
  { token: 'Amazonbot', group: 'training', vendor: 'Amazon', verified: false },
  { token: 'Bytespider', group: 'training', vendor: 'ByteDance', verified: false },
  { token: 'DuckAssistBot', group: 'aiSearch', vendor: 'DuckDuckGo', verified: false },
]

export interface CrawlerPolicyConfig {
  training?: CrawlerStance
  aiSearch?: CrawlerStance
  userTriggered?: CrawlerStance
  /**
   * Per-token stance, winning over the group default. Keys are user-agent
   * tokens and need not appear in `AI_CRAWLERS` — use this for a crawler the
   * framework doesn't know about, or to carve one vendor out of a group.
   */
  overrides?: Record<string, CrawlerStance>
}

export interface RobotsRule {
  userAgent: string
  allow?: string
  disallow?: string | string[]
}

/**
 * Turn the policy into robots.txt groups.
 *
 * The repeated `siteDisallow` on every allow rule is load-bearing, not
 * redundant. robots.txt groups are not merged: a crawler obeys the most
 * specific group that names it and ignores the wildcard group entirely. So a
 * bare `User-agent: GPTBot / Allow: /` would quietly hand that one crawler
 * the paths `User-agent: *` disallows — the private ones. Every emitted group
 * therefore restates the site-wide exclusions.
 *
 * Returns an empty array when nothing is configured, which keeps robots.txt
 * byte-identical for anyone who hasn't opted in.
 */
export function buildCrawlerRules(
  policy: CrawlerPolicyConfig | undefined,
  siteDisallow: string[],
): RobotsRule[] {
  if (!policy) return []
  const { overrides = {} } = policy

  const stanceFor = (entry: CrawlerEntry): CrawlerStance | undefined =>
    overrides[entry.token] ?? policy[entry.group]

  const rules: RobotsRule[] = []
  const seen = new Set<string>()

  for (const entry of AI_CRAWLERS) {
    const stance = stanceFor(entry)
    if (!stance) continue
    seen.add(entry.token)
    rules.push(
      stance === 'block'
        ? { userAgent: entry.token, disallow: '/' }
        : { userAgent: entry.token, allow: '/', disallow: siteDisallow },
    )
  }

  // Overrides naming a crawler the framework doesn't ship still get a group.
  for (const [token, stance] of Object.entries(overrides)) {
    if (seen.has(token)) continue
    rules.push(
      stance === 'block'
        ? { userAgent: token, disallow: '/' }
        : { userAgent: token, allow: '/', disallow: siteDisallow },
    )
  }

  return rules
}

/**
 * The effective policy: what the site configured, over onvu's defaults.
 *
 * **`training` defaults to `block`.** This is the one place onvu takes a
 * position rather than staying neutral, so it deserves a justification.
 *
 * Blocking the training group costs a site nothing it would otherwise have.
 * Every token in that group exists to collect training corpora, and none of
 * them is a search crawler: `Google-Extended` is a robots.txt control token
 * that Google states "does not impact a site's inclusion in Google Search nor
 * is it used as a ranking signal", and OpenAI and Anthropic each run separate
 * search crawlers (`OAI-SearchBot`, `Claude-SearchBot`) that this policy still
 * lets through. So the default is "crawl me, cite me, don't train on me" —
 * you stay findable and quotable in AI answers, and your writing stays out of
 * the next model.
 *
 * It is one line to opt back in:
 *
 *     agents: { crawlers: { training: 'allow' } }
 *
 * The other two groups have no default. Blocking `aiSearch` is what removes
 * you from AI answers, and `userTriggered` fetches largely ignore robots.txt
 * anyway — neither is a call onvu should make for you.
 */
export function crawlerPolicy(): CrawlerPolicyConfig {
  const configured = siteConfig.agents?.crawlers ?? {}
  return {
    training: configured.training ?? 'block',
    aiSearch: configured.aiSearch,
    userTriggered: configured.userTriggered,
    overrides: configured.overrides,
  }
}
