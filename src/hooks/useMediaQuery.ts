'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  const mql = useMemo(
    () => (typeof window === 'undefined' ? null : window.matchMedia(query)),
    [query],
  )

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!mql) return () => {}
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [mql],
  )

  return useSyncExternalStore(
    subscribe,
    () => mql?.matches ?? false,
    () => false,
  )
}

export const useIsMobile = () => useMediaQuery('(max-width: 639px)')

/**
 * Is a physical keyboard plausibly attached?
 *
 * There is no media query for "has a keyboard", so this stands in on the
 * strong correlation with a fine pointer: laptops and desktops report one,
 * phones and tablets do not. Used to decide whether keyboard affordances are
 * worth showing at all — chord hints beside palette commands, and the
 * shortcuts on/off switch, are noise on a device that cannot type them.
 *
 * `any-pointer`, not `pointer`, so a tablet with a trackpad counts. The
 * remaining miss is a phone paired with a bluetooth keyboard and no mouse:
 * it reads as touch-only and loses the switch. That direction is harmless —
 * shortcuts are on by default, which is what such a reader would want.
 */
export const useHasKeyboard = () => useMediaQuery('(any-pointer: fine)')
