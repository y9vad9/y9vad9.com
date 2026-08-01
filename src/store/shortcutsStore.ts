'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * The reader's own choice about keyboard shortcuts, persisted per browser.
 *
 * `shortcuts.enabled` in site config sets the default; this overrides it, the
 * same relationship `defaultTheme` has with the theme the reader picks. So
 * `null` genuinely means "not chosen" rather than "on" — collapsing the two
 * would make the site default unreachable once anyone touched the toggle.
 */
interface ShortcutsStore {
  /** `null` follows the site default. */
  preference: boolean | null
  setPreference: (value: boolean | null) => void
}

export const useShortcutsStore = create<ShortcutsStore>()(
  persist(
    (set) => ({
      preference: null,
      setPreference: (preference) => set({ preference }),
    }),
    { name: 'shortcuts' },
  ),
)
