'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { LOCALES, DEFAULT_LOCALE } from '@i18n/routing'
import { readLocalePreference } from '@lib/i18n/localePreference'
import type { Locale } from '@config/site'

export default function LocaleFreeRedirect() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()

  useEffect(() => {
    // A language the reader chose beats one their browser was configured with.
    // `rememberLocale` is what writes this, from every language switcher on the
    // site; before that existed this branch was unreachable and someone reading
    // in German kept being sent back to their browser's language.
    const preferred = readLocalePreference()
    let locale: Locale = preferred ?? DEFAULT_LOCALE
    // Only consult the browser when the reader has expressed nothing. Testing
    // `locale === DEFAULT_LOCALE` instead would discard a deliberate choice of
    // the primary language, which is the one choice most readers make.
    if (!preferred) {
      try {
        const browserLang = navigator.language.split('-')[0] as Locale
        if (LOCALES.includes(browserLang)) locale = browserLang
      } catch {
        // No `navigator.language` to consult; the default stands.
      }
    }
    // Preserve any `#hash` and `?query` from the incoming URL when
    // bouncing through to the localised note page. Without this, a link
    // like `notes/education#section` written on a page like `/en` (which
    // resolves relatively to `/notes/education#section`) loses the hash
    // here and the destination loads at the top instead of scrolling to
    // the anchor.
    // Standard order: search first, then hash.
    const tail = window.location.search + window.location.hash
    router.replace(`/${locale}/notes/${params.slug}${tail}`)
  }, [router, params.slug])

  // The visible "Redirecting…" label is rendered by the server layout, which
  // can translate it — this component exists only to choose a locale and
  // navigate.
  return null
}
