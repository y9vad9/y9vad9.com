/**
 * Best-effort title resolution for external URLs surfaced in the outgoing
 * links panel. Runs server-side from the note page (both during `next
 * build` for static notes and on each request in dynamic mode), with a
 * process-wide cache so the same URL is fetched once per build / per
 * server lifetime — a popular reference cited from ten notes still hits
 * the network only once.
 *
 * Failure modes (timeout, blocking site, non-HTML response, malformed
 * HTML) all resolve to `null`; the caller falls back to displaying the
 * URL itself, so the panel still works offline / behind a firewall.
 *
 * Cache deliberately isn't persisted to disk: stale titles are worse than
 * the cost of re-fetching when the dev server restarts. If this ever
 * becomes a bottleneck the obvious move is a manifest written to
 * `.next/cache` and read back on warm starts.
 */

import { config as siteConfig } from '~/site.config'

const cache = new Map<string, string | null>()
const FETCH_TIMEOUT_MS = 5_000

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
}

export async function fetchExternalTitle(url: string): Promise<string | null> {
  // Off unless the site asks for it. An unconditional network call per
  // external link made `next build` non-reproducible and non-hermetic — see
  // `LinksConfig.fetchExternalTitles`.
  if (!siteConfig.links?.fetchExternalTitles) return null
  if (cache.has(url)) return cache.get(url) ?? null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // Some sites reject UA-less clients with a 4xx.
        'User-Agent':
          'Mozilla/5.0 (compatible; OnvuLinkTitler/1.0; +https://onvu.dev)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timer)
    if (!res.ok) {
      cache.set(url, null)
      return null
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('html')) {
      cache.set(url, null)
      return null
    }
    const html = await res.text()
    // Prefer Open Graph title (often a human-curated label) over <title>.
    const ogMatch = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    )
    const titleMatch = ogMatch ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch
      ? decodeBasicEntities(titleMatch[1].replace(/\s+/g, ' ').trim())
      : null
    cache.set(url, title)
    return title
  } catch {
    cache.set(url, null)
    return null
  }
}

/** Compact host+path label used when title fetch fails or is empty. */
export function urlLabel(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const path = u.pathname === '/' ? '' : u.pathname
    return `${host}${path}`
  } catch {
    return url
  }
}
