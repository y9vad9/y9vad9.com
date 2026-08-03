import { config as siteConfig } from '~/site.config'

export const DEV_FALLBACK_ORIGIN = 'http://localhost:3000'

/**
 * Origins that mean "nobody set this" — a template placeholder, or the
 * development fallback. Every canonical URL, hreflang alternate, sitemap
 * entry, RSS guid and OG `metadataBase` on the site is built from this value,
 * so shipping one of these is not a cosmetic defect: it points the whole site
 * at somebody else's domain.
 */
const PLACEHOLDER_ORIGINS = ['https://example.com', 'https://your-domain.com', DEV_FALLBACK_ORIGIN]

let warned = false

/**
 * Canonical origin, without a trailing slash.
 *
 * Precedence is `seo.siteUrl`, then `NEXT_PUBLIC_BASE_URL`, then localhost —
 * config beats environment, which is the right way round for an explicit
 * setting. The hazard is that `??` only falls through on null/undefined, so a
 * placeholder *value* wins just as loudly as a real one. The template used to
 * ship `siteUrl: 'https://example.com'`, which made the env var the README
 * tells you to set inert. That key is now commented out, and this warns if a
 * production build still resolves to a placeholder.
 */
export function siteUrl(): string {
  const raw =
    siteConfig.seo?.siteUrl ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    DEV_FALLBACK_ORIGIN
  const origin = raw.replace(/\/+$/, '')

  // Warn once per process, and only for a real build — `next dev` legitimately
  // runs on localhost, and a wall of warnings there teaches people to ignore
  // them.
  if (
    !warned &&
    process.env.NODE_ENV === 'production' &&
    PLACEHOLDER_ORIGINS.includes(origin)
  ) {
    warned = true
    console.warn(
      `[onvu] Building with siteUrl "${origin}". Every canonical URL, sitemap ` +
        `entry, RSS guid and OG image URL will point there. Set ` +
        `NEXT_PUBLIC_BASE_URL, or uncomment seo.siteUrl in site.config.ts.`,
    )
  }
  return origin
}

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path: string): string {
  if (!path) return siteUrl()
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path
  const normalised = path.startsWith('/') ? path : `/${path}`
  return `${siteUrl()}${normalised}`
}

/** Prepend a locale prefix once and only once. */
export function localizedPath(locale: string, path = '/'): string {
  const trimmed = path.replace(/^\/+/, '')
  const prefix = `${locale}/`
  if (trimmed.startsWith(prefix) || trimmed === locale) {
    return `/${trimmed}`
  }
  return trimmed === '' ? `/${locale}` : `/${locale}/${trimmed}`
}

export function noteUrl(locale: string, slug: string): string {
  return absoluteUrl(localizedPath(locale, `notes/${slug}`))
}
