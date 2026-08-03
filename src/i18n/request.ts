import { getRequestConfig } from 'next-intl/server'
import type { AbstractIntlMessages } from 'next-intl'
import { routing } from './routing'
import type { Locale } from '@config/site'
import { deepMerge } from '@lib/deepMerge'

/** Load a JSON message file, or `null` when there isn't one. */
async function load(path: 'messages' | 'content/i18n', locale: string) {
  try {
    const mod =
      path === 'messages'
        ? await import(`../../messages/${locale}.json`)
        : await import(`../../content/i18n/${locale}.json`)
    return mod.default as AbstractIntlMessages
  } catch {
    return null
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) as Locale
  if (!locale || !routing.locales.includes(locale)) {
    locale = routing.defaultLocale
  }

  // Four layers, each overriding the one before:
  //
  //   1. `messages/<primary>.json`      framework strings, the safety net
  //   2. `messages/<locale>.json`       framework strings for this locale
  //   3. `content/i18n/<primary>.json`  the site's own strings, safety net
  //   4. `content/i18n/<locale>.json`   the site's own strings for this locale
  //
  // Layer 1 is what was missing. Previously a locale's own file *replaced* the
  // primary's, so a key upstream added and this locale hadn't translated yet
  // rendered as the literal path — `garden.actions` shown to a reader — with
  // no build failure and no test catching it. Upstream touches `messages/`
  // constantly, so every sync put that in front of somebody. Falling back to
  // the primary language means an untranslated string is merely untranslated.
  //
  // Layer 3 does the same for the site's own keys: a downstream that invents
  // `home.chips.*` in `content/i18n/en.json` should not have those vanish on
  // `/uk` before it gets round to translating them.
  //
  // The old code also had a hole its own comment denied: the catch loaded
  // `messages/<defaultLocale>.json`, which is the *same missing file* when the
  // primary locale is the one without messages — so a `ja`-primary site threw
  // out of `getRequestConfig` rather than degrading. Nothing here is required
  // to exist now.
  const primary = routing.defaultLocale
  const layers = await Promise.all([
    load('messages', primary),
    locale === primary ? null : load('messages', locale),
    load('content/i18n', primary),
    locale === primary ? null : load('content/i18n', locale),
  ])

  const messages = layers
    .filter((m): m is AbstractIntlMessages => m !== null)
    .reduce<AbstractIntlMessages>((acc, layer) => deepMerge(acc, layer), {})

  return { locale, messages }
})
