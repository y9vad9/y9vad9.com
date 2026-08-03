'use client'

import { useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { switchLocalePath } from '@lib/i18n/localePath'
import { rememberLocale } from '@lib/i18n/localePreference'
import type { Locale } from '@config/site'

/**
 * Go to the current page in another language, and remember the choice.
 *
 * Every surface that offers a language switch calls this: the landing header's
 * dropdown, the same header's mobile drawer, the garden header, and the command
 * palette. They previously each rebuilt the path themselves and none of them
 * recorded anything, so the stored preference the unprefixed `/notes/<slug>`
 * route reads was never written by anybody.
 *
 * Persisting inside the hook rather than at the four call sites is the point.
 * A fifth switcher added later gets both behaviours by construction, and there
 * is no arrangement in which the path is swapped without the choice being
 * remembered.
 */
export function useLocaleSwitch(): (target: Locale) => void {
  const router = useRouter()
  const pathname = usePathname()
  const current = useLocale() as Locale

  return useCallback(
    (target: Locale) => {
      if (target === current) return
      rememberLocale(target)
      router.push(switchLocalePath(pathname, target))
    },
    [router, pathname, current],
  )
}
