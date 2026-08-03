'use client'

import { useEffect } from 'react'
import { useThemeStore } from '@store/themeStore'
import { applyTheme, readPersistedTheme, THEME_STORAGE_KEY } from '@lib/theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme)

  // The bootstrap script in `<head>` has already applied this exact theme on
  // a cold load, so this is normally a redundant write. It earns its keep on
  // rehydration from a persisted store and on client-side theme changes.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Follow the reader's choice across their other tabs.
  //
  // `persist` writes to `localStorage` but never listens to it, so two open
  // tabs share one stored value and disagree about it: each keeps whatever it
  // had in memory. Nothing looks wrong until one of them does a *full* load —
  // a new tab, a middle-click, a hard reload — because only then is the stored
  // value read again, and the tab silently adopts the other one's theme. That
  // is why it reads as random: client-side navigation is unaffected, so the
  // same click reproduces it only sometimes.
  //
  // A theme is a preference about the site, not about a tab, so the fix is to
  // honour the newest choice everywhere rather than to stop reading storage.
  // `storage` fires only in the tabs that did *not* make the change, which is
  // exactly the set that needs telling.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY || !event.newValue) return
      const next = readPersistedTheme(event.newValue)
      // Guard the write: `setState` with an unchanged value still notifies
      // every subscriber, and this runs in every open tab.
      if (next && next !== useThemeStore.getState().theme) {
        useThemeStore.setState({ theme: next })
        applyTheme(next)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return <>{children}</>
}
