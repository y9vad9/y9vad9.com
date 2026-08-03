import { routing } from '@i18n/routing'
import type { Locale } from '@config/site'

/**
 * Swap the locale prefix on a site path.
 *
 * Three surfaces switch language — the landing header, the garden header and
 * the command palette — and each had its own idea of how to do it. Two used
 * `pathname.replace('/' + locale, '')`, an unanchored substring replace; the
 * third used `/^\/[a-z]{2}(?=\/|$)/`, which matches exactly two lowercase
 * letters and so silently did nothing on `pt-BR`, `zh-Hans`, `ckb` or `fil`.
 * `locales.supported` is documented as free-form BCP-47, so that regex turned
 * the garden's language switcher into a no-op on any site that took the
 * documentation at its word.
 *
 * The prefix is matched against the configured locales rather than parsed out
 * of the path, so the shape of a locale code is never guessed at. Longest
 * match first, because a site supporting both `pt` and `pt-BR` would otherwise
 * strip `pt` from `/pt-BR/notes` and leave `-BR/notes` behind.
 */
function stripLocalePrefix(pathname: string): string {
  const candidates = [...routing.locales].sort((a, b) => b.length - a.length)
  for (const locale of candidates) {
    const prefix = `/${locale}`
    if (pathname === prefix) return '/'
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length)
  }
  // No prefix to strip. An unprefixed path is a route outside `[locale]`, and
  // the caller still wants it under the target locale.
  return pathname || '/'
}

/**
 * The current path, viewed in another language.
 *
 * Takes only the target: which locale the path is currently in is a fact about
 * the path, not something a caller should have to supply and can therefore get
 * wrong.
 */
export function switchLocalePath(pathname: string, target: Locale): string {
  const rest = stripLocalePrefix(pathname)
  return rest === '/' ? `/${target}` : `/${target}${rest}`
}
