import { describe, it, expect } from 'vitest'
import robots from '../../src/app/robots'

type Rule = { userAgent?: string | string[]; allow?: unknown; disallow?: unknown }

/**
 * `rules` is a single group by default and an array once `agents.crawlers`
 * adds per-bot groups. These tests run against whatever `site.config.ts` a
 * fork ships, so they normalise rather than assume — asserting on the shape
 * made the suite fail for any site that configured a crawler policy.
 */
function rulesOf(): Rule[] {
  const { rules } = robots()
  return (Array.isArray(rules) ? rules : [rules]) as Rule[]
}

function wildcard(): Rule {
  const hit = rulesOf().find((r) => r.userAgent === '*')
  expect(hit, 'robots.txt must always keep a `User-agent: *` group').toBeDefined()
  return hit!
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  return value === undefined ? [] : [value as string]
}

describe('robots', () => {
  it('always emits a wildcard group allowing /', () => {
    expect(wildcard()).toMatchObject({ userAgent: '*', allow: '/' })
  })

  it('disallows the configured noindex paths (default includes /notes/graph)', () => {
    expect(asList(wildcard().disallow)).toContain('/notes/graph')
  })

  it('points at the sitemap', () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/)
  })

  it('repeats the site-wide disallow on every allow group', () => {
    // robots.txt groups are not merged: a crawler named by a specific group
    // ignores the wildcard entirely. Any group that says `Allow: /` without
    // restating the exclusions would hand that one crawler the private paths.
    const siteDisallow = asList(wildcard().disallow)
    for (const rule of rulesOf()) {
      if (rule.userAgent === '*' || rule.allow !== '/') continue
      expect(asList(rule.disallow)).toEqual(siteDisallow)
    }
  })

  it('names each user agent at most once', () => {
    const agents = rulesOf().map((r) => String(r.userAgent))
    expect(new Set(agents).size).toBe(agents.length)
  })
})
