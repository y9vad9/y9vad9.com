'use client'

import { useEffect } from 'react'
import { useThemeStore } from '@store/themeStore'
import { applyTheme } from '@lib/theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme)

  // The bootstrap script in `<head>` has already applied this exact theme on
  // a cold load, so this is normally a redundant write. It earns its keep on
  // rehydration from a persisted store and on client-side theme changes.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return <>{children}</>
}
