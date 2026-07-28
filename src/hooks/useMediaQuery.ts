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
