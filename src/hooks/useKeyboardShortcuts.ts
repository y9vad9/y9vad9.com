'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useTabStore } from '@store/tabStore'
import { createShortcutActions } from '@lib/shortcuts/createShortcutActions'
import {
  GARDEN_SHORTCUTS,
  isMacPlatform,
  matchesShortcut,
} from '@lib/shortcuts/gardenShortcuts'

/**
 * Binds the garden's keyboard shortcuts.
 *
 * The chords themselves live in `@lib/shortcuts/gardenShortcuts`, shared with
 * the command palette so the keys that fire and the keys that are advertised
 * cannot disagree.
 *
 * Single-letter shortcuts only fire when the reader isn't typing in a field —
 * that avoids hijacking Cmd+F (browser find-in-page) and works around macOS's
 * Option-letter character substitution, which made the original Alt+letter
 * bindings produce special characters instead of the expected keys.
 *
 * `enabled` comes from `shortcuts.enabled` in site config. When false the
 * listener is never attached at all, rather than attached and ignoring
 * everything.
 */
export function useKeyboardShortcuts(enabled = true) {
  // Only Alt+1–9 needs the tab list; everything else goes through
  // `createShortcutActions`, which reads the stores at dispatch time.
  const tabs = useTabStore((s) => s.tabs)
  const router = useRouter()
  const locale = useLocale()

  useEffect(() => {
    if (!enabled) return

    // Shared with the palette and the index's action row, so a command added
    // in one place cannot quietly do nothing in another.
    const actions = createShortcutActions({
      navigate: (path) => router.push(path),
      locale,
    })

    function isTyping(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true
      if (el.isContentEditable) return true
      return false
    }

    function handleKeyDown(e: KeyboardEvent) {
      const mod = isMacPlatform() ? e.metaKey : e.ctrlKey

      // Alt+1–9 — jump to tab N. Not in the shared list: nine positional
      // bindings would bury the nine real commands in the palette, and
      // "switch to tab 7" isn't an action worth listing. Digits aren't
      // subject to macOS Option substitution, so this stays on Alt.
      if (e.altKey && !mod) {
        const num = parseInt(e.key, 10)
        if (num >= 1 && num <= 9) {
          e.preventDefault()
          const tab = tabs[num - 1]
          if (tab) useTabStore.getState().setActiveTab(tab.slug)
        }
        return
      }

      const typing = isTyping(e.target)
      if (!mod && (typing || e.altKey || e.repeat)) return

      for (const shortcut of GARDEN_SHORTCUTS) {
        if (!matchesShortcut(shortcut, e, mod)) continue
        e.preventDefault()
        shortcut.run(actions)
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, tabs, router, locale])
}
