import { describe, it, expect } from 'vitest'
import {
  buildCrawlerRules,
  crawlerPolicy,
  resolveCrawlerPolicy,
  AI_CRAWLERS,
} from '@lib/agents/crawlers'

const SITE_DISALLOW = ['/notes/graph', '/private']

function tokens(rules: ReturnType<typeof buildCrawlerRules>) {
  return rules.map((r) => r.userAgent)
}

describe('buildCrawlerRules', () => {
  it('emits nothing when no policy is set, leaving robots.txt untouched', () => {
    expect(buildCrawlerRules(undefined, SITE_DISALLOW)).toEqual([])
    expect(buildCrawlerRules({}, SITE_DISALLOW)).toEqual([])
  })

  it('blocks only the training group when asked', () => {
    const rules = buildCrawlerRules({ training: 'block' }, SITE_DISALLOW)
    expect(tokens(rules)).toContain('GPTBot')
    expect(tokens(rules)).toContain('ClaudeBot')
    expect(tokens(rules)).toContain('Google-Extended')
    // Citation crawlers must be untouched — that's the point of the split.
    expect(tokens(rules)).not.toContain('OAI-SearchBot')
    expect(tokens(rules)).not.toContain('PerplexityBot')
    for (const r of rules) expect(r.disallow).toBe('/')
  })

  it('supports the common "do not train on me, but do cite me" policy', () => {
    const rules = buildCrawlerRules({ training: 'block', aiSearch: 'allow' }, SITE_DISALLOW)
    const byToken = new Map(rules.map((r) => [r.userAgent, r]))
    expect(byToken.get('GPTBot')?.disallow).toBe('/')
    expect(byToken.get('OAI-SearchBot')?.allow).toBe('/')
    expect(byToken.get('Claude-SearchBot')?.allow).toBe('/')
  })

  it('repeats the site-wide disallow on every allow rule', () => {
    // Load-bearing: robots.txt groups are not merged. A crawler obeys the most
    // specific group naming it and ignores `User-agent: *` entirely, so a bare
    // `Allow: /` would hand that crawler the paths everyone else is denied.
    const rules = buildCrawlerRules({ aiSearch: 'allow' }, SITE_DISALLOW)
    expect(rules.length).toBeGreaterThan(0)
    for (const r of rules) expect(r.disallow).toEqual(SITE_DISALLOW)
  })

  it('lets a per-token override beat its group', () => {
    const rules = buildCrawlerRules(
      { training: 'block', overrides: { CCBot: 'allow' } },
      SITE_DISALLOW,
    )
    const byToken = new Map(rules.map((r) => [r.userAgent, r]))
    expect(byToken.get('GPTBot')?.disallow).toBe('/')
    expect(byToken.get('CCBot')?.allow).toBe('/')
  })

  it('emits a group for an override naming a crawler it does not ship', () => {
    const rules = buildCrawlerRules({ overrides: { 'BrandNewBot': 'block' } }, SITE_DISALLOW)
    expect(rules).toEqual([{ userAgent: 'BrandNewBot', disallow: '/' }])
  })

  it('never emits a token twice', () => {
    const rules = buildCrawlerRules(
      { training: 'block', aiSearch: 'block', userTriggered: 'block', overrides: { GPTBot: 'allow' } },
      SITE_DISALLOW,
    )
    expect(new Set(tokens(rules)).size).toBe(rules.length)
  })

  it('covers the user-triggered group independently', () => {
    const rules = buildCrawlerRules({ userTriggered: 'block' }, SITE_DISALLOW)
    expect(tokens(rules).sort()).toEqual(['ChatGPT-User', 'Claude-User', 'Perplexity-User'])
  })
})

describe('AI_CRAWLERS registry', () => {
  it('never lists an ordinary search crawler — blocking one would delist the site', () => {
    const listed = AI_CRAWLERS.map((c) => c.token.toLowerCase())
    for (const searchBot of ['googlebot', 'bingbot', 'duckduckbot', 'applebot', 'slurp']) {
      expect(listed).not.toContain(searchBot)
    }
  })

  it('keeps Google-Extended in training, not aiSearch', () => {
    // It's a robots.txt token, not a crawler: Google states it "does not
    // impact a site's inclusion in Google Search". Filing it under aiSearch
    // would imply blocking it costs AI Overviews visibility. It doesn't.
    const entry = AI_CRAWLERS.find((c) => c.token === 'Google-Extended')
    expect(entry?.group).toBe('training')
  })

  it('has unique tokens', () => {
    const seen = AI_CRAWLERS.map((c) => c.token)
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('assigns every entry to a known group', () => {
    for (const c of AI_CRAWLERS) {
      expect(['training', 'aiSearch', 'userTriggered']).toContain(c.group)
    }
  })

  it('marks the major vendors as vendor-verified', () => {
    const verified = AI_CRAWLERS.filter((c) => c.verified).map((c) => c.token)
    for (const token of [
      'GPTBot',
      'OAI-SearchBot',
      'ClaudeBot',
      'Claude-SearchBot',
      'PerplexityBot',
      'Google-Extended',
    ]) {
      expect(verified).toContain(token)
    }
  })
})

describe('resolveCrawlerPolicy — defaults', () => {
  // Takes the configured value as an argument rather than reading
  // `site.config.ts`, so these assert onvu's defaults on any fork. Reading
  // the ambient config here would make the suite fail for every site that
  // configures a policy — which is exactly how the earlier robots test broke.
  it('blocks AI training when the site says nothing', () => {
    expect(resolveCrawlerPolicy(undefined).training).toBe('block')
    expect(resolveCrawlerPolicy({}).training).toBe('block')
  })

  it('takes no position on the other two groups', () => {
    // Blocking aiSearch is what removes you from AI answers, and
    // userTriggered fetches largely ignore robots.txt anyway. Neither is
    // onvu's call to make.
    expect(resolveCrawlerPolicy(undefined).aiSearch).toBeUndefined()
    expect(resolveCrawlerPolicy(undefined).userTriggered).toBeUndefined()
  })

  it('lets a site opt back into training with one key', () => {
    expect(resolveCrawlerPolicy({ training: 'allow' }).training).toBe('allow')
  })

  it('preserves the other keys it does not default', () => {
    const policy = resolveCrawlerPolicy({ aiSearch: 'allow', overrides: { CCBot: 'allow' } })
    expect(policy.aiSearch).toBe('allow')
    expect(policy.overrides).toEqual({ CCBot: 'allow' })
  })

  it('produces a crawlable, citable, untrainable site by default', () => {
    const rules = buildCrawlerRules(resolveCrawlerPolicy(undefined), SITE_DISALLOW)
    const byToken = new Map(rules.map((r) => [r.userAgent, r]))
    // Training crawlers turned away...
    expect(byToken.get('GPTBot')?.disallow).toBe('/')
    expect(byToken.get('ClaudeBot')?.disallow).toBe('/')
    expect(byToken.get('Google-Extended')?.disallow).toBe('/')
    // ...while the crawlers that put you in AI answers get no rule at all,
    // so they fall through to `User-agent: *` and are allowed.
    expect(byToken.has('OAI-SearchBot')).toBe(false)
    expect(byToken.has('PerplexityBot')).toBe(false)
  })

  it('never names an ordinary search engine, whatever the config', () => {
    for (const policy of [undefined, { training: 'block' as const }, { aiSearch: 'block' as const }]) {
      const tokenList = tokens(buildCrawlerRules(resolveCrawlerPolicy(policy), SITE_DISALLOW))
      expect(tokenList).not.toContain('Googlebot')
      expect(tokenList).not.toContain('Bingbot')
    }
  })

  it('is what this site actually ships', () => {
    // The one ambient-config assertion worth keeping: whatever the fork sets,
    // the resolver is the thing producing it.
    expect(crawlerPolicy()).toEqual(resolveCrawlerPolicy(crawlerPolicy()))
  })
})
