import { defineRouting } from 'next-intl/routing'
import { config as siteConfig } from '~/site.config'
import type { Locale } from '@config/site'

export const LOCALES: Locale[] = siteConfig.locales.supported
export const DEFAULT_LOCALE: Locale = siteConfig.locales.primary

/**
 * Whether there is anything to switch *between*.
 *
 * Language controls are hidden when false: on a single-locale site the globe
 * button opens a menu containing only the language already in use, and the
 * drawer grows a "Language" section with one inert pill. Derived here rather
 * than checked at each call site so the three surfaces can't disagree.
 */
export const MULTILINGUAL: boolean = LOCALES.length > 1

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
})
