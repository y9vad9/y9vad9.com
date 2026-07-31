import { describe, it, expect } from 'vitest'
import { buildRobots, renderRobotsTxt, type RobotsGroup } from '@lib/agents/robots'

/**
 * These run against whatever `site.config.ts` a fork ships, so they assert on
 * invariants rather than on one site's configuration. `groups` is a single
 * wildcard group by default and grows per-bot groups once `agents.crawlers`
 * is set; `Content-Signal` appears only once `agents.contentSignals` is.
 */
function groups(): RobotsGroup[] {
  return buildRobots().groups
}

function wildcard(): RobotsGroup {
  const hit = groups().find((g) => g.userAgent === '*')
  expect(hit, 'robots.txt must always keep a `User-agent: *` group').toBeDefined()
  return hit!
}

describe('buildRobots', () => {
  it('always emits a wildcard group allowing /', () => {
    expect(wildcard()).toMatchObject({ userAgent: '*', allow: '/' })
  })

  it('disallows the configured noindex paths (default includes /notes/graph)', () => {
    expect(wildcard().disallow ?? []).toContain('/notes/graph')
  })

  it('points at the sitemap', () => {
    expect(buildRobots().sitemap).toMatch(/\/sitemap\.xml$/)
  })

  it('repeats the site-wide disallow on every allow group', () => {
    // robots.txt groups are not merged: a crawler named by a specific group
    // ignores the wildcard entirely. Any group that says `Allow: /` without
    // restating the exclusions would hand that one crawler the private paths.
    const siteDisallow = wildcard().disallow ?? []
    for (const group of groups()) {
      if (group.userAgent === '*' || group.allow !== '/') continue
      expect(group.disallow ?? []).toEqual(siteDisallow)
    }
  })

  it('states the same content signal in every group, for the same reason', () => {
    // A signal only in the wildcard group would be invisible to exactly the
    // crawlers it is aimed at, since they read their own group and stop.
    const signals = new Set(groups().map((g) => g.contentSignal ?? null))
    expect(signals.size).toBe(1)
  })

  it('names each user agent at most once', () => {
    const agents = groups().map((g) => g.userAgent)
    expect(new Set(agents).size).toBe(agents.length)
  })
})

describe('buildRobots — out-of-the-box stance', () => {
  // onvu ships "crawl me, cite me, don't train on me". These assert the
  // whole file says that, not just one directive of it.
  const text = () => renderRobotsTxt(buildRobots())

  it('turns the training crawlers away', () => {
    expect(text()).toContain('User-Agent: GPTBot\nContent-Signal: ')
    for (const token of ['GPTBot', 'ClaudeBot', 'Google-Extended']) {
      const group = groups().find((g) => g.userAgent === token)
      expect(group?.disallow, `${token} should be blocked by default`).toEqual(['/'])
      expect(group?.allow).toBeUndefined()
    }
  })

  it('never blocks an ordinary search engine', () => {
    // Blocking these would delist the site from search entirely.
    const named = groups().map((g) => g.userAgent)
    expect(named).not.toContain('Googlebot')
    expect(named).not.toContain('Bingbot')
  })

  it('leaves the AI-answer crawlers to fall through to the wildcard allow', () => {
    const named = groups().map((g) => g.userAgent)
    expect(named).not.toContain('OAI-SearchBot')
    expect(named).not.toContain('PerplexityBot')
    expect(wildcard().allow).toBe('/')
  })

  it('states the matching use preference in every group', () => {
    const out = text()
    expect(out).toContain('Content-Signal: search=yes, ai-train=no')
    // One per group, plus none missed.
    const groupCount = groups().length
    expect(out.match(/^Content-Signal: /gm) ?? []).toHaveLength(groupCount)
  })

  it('explains itself to whoever opens the file', () => {
    expect(text().startsWith('# Content-Signal states how this content')).toBe(true)
  })
})

describe('renderRobotsTxt', () => {
  const doc = {
    preamble: [],
    groups: [{ userAgent: '*', allow: '/', disallow: ['/notes/graph'] }],
    host: 'https://example.com',
    sitemap: 'https://example.com/sitemap.xml',
  }

  it('reproduces the exact output the Next metadata route used to emit', () => {
    // This file replaced `app/robots.ts`; a site that configures none of the
    // new options must get a byte-identical robots.txt, not merely an
    // equivalent one.
    expect(renderRobotsTxt(doc)).toBe(
      'User-Agent: *\nAllow: /\nDisallow: /notes/graph\n\n' +
        'Host: https://example.com\n' +
        'Sitemap: https://example.com/sitemap.xml\n',
    )
  })

  it('puts Content-Signal directly under the user-agent line it qualifies', () => {
    const out = renderRobotsTxt({
      ...doc,
      groups: [{ ...doc.groups[0], contentSignal: 'search=yes, ai-train=no' }],
    })
    expect(out).toContain('User-Agent: *\nContent-Signal: search=yes, ai-train=no\nAllow: /')
  })

  it('omits the directive entirely when there is no signal', () => {
    expect(renderRobotsTxt(doc)).not.toContain('Content-Signal')
  })

  it('emits the preamble as comments above the first group', () => {
    const out = renderRobotsTxt({ ...doc, preamble: ['# hello'] })
    expect(out.startsWith('# hello\n\nUser-Agent: *')).toBe(true)
  })

  it('renders a blocked group with no Allow line', () => {
    const out = renderRobotsTxt({
      ...doc,
      groups: [{ userAgent: 'GPTBot', disallow: ['/'] }],
    })
    expect(out).toContain('User-Agent: GPTBot\nDisallow: /\n')
    expect(out).not.toContain('Allow:')
  })
})
