import { routing } from '@i18n/routing'
import type { Locale } from '@config/site'

/**
 * Where a reader's chosen language is kept.
 *
 * A plain string rather than a zustand `persist` store, unlike `theme` and
 * `panels`. Those back React state that many components subscribe to; this has
 * exactly one reader — the unprefixed `/notes/<slug>` redirect, which runs once
 * in an effect and navigates away — so a store would add a subscription nobody
 * uses and wrap the value in `{"state":{…}}` for a consumer that wants the
 * value.
 *
 * The reason it is a module rather than two inline `localStorage` calls is that
 * the key had a reader and no writer: the redirect consulted `locale` first,
 * nothing ever set it, and so a reader who explicitly chose German kept being
 * bounced by `navigator.language` instead. One module owning both sides is what
 * stops that recurring.
 */
const STORAGE_KEY = 'locale'

/**
 * The reader's stored language, or null.
 *
 * Validated against the configured locales on the way out, so a site that drops
 * a language does not keep redirecting to routes it no longer builds.
 */
export function readLocalePreference(): Locale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
    return stored && routing.locales.includes(stored) ? stored : null
  } catch {
    // Private browsing, a blocked origin, or no `localStorage` at all.
    return null
  }
}

/** Record a language the reader chose deliberately. */
export function rememberLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Storage being unavailable costs the preference, not the navigation.
  }
}
