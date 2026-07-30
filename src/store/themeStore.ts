'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config as siteConfig } from '~/site.config'
import { applyTheme, THEMES, THEME_OPTIONS } from '@lib/theme'
import type { Theme } from '@lib/theme'

// The theme list and the DOM write live in `@lib/theme` so the blocking
// `<head>` script can share them without pulling in zustand. Re-exported
// here because every consumer already imports them from the store.
export { THEMES, THEME_OPTIONS }
export type { Theme }

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
  cycleTheme: () => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: siteConfig.defaultTheme,
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      cycleTheme: () => {
        const current = get().theme
        const idx = THEMES.indexOf(current)
        const cyclables = THEMES.filter((t) => t !== 'system')
        const fallbackIdx = cyclables.indexOf(current)
        const next =
          fallbackIdx === -1
            ? cyclables[0] ?? THEMES[(idx + 1) % THEMES.length]
            : cyclables[(fallbackIdx + 1) % cyclables.length]
        set({ theme: next })
        applyTheme(next)
      },
    }),
    { name: 'theme' },
  ),
)
