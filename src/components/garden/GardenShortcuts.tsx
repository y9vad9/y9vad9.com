'use client'

import { useKeyboardShortcuts } from '@hooks/useKeyboardShortcuts'
import { useShortcutsEnabled } from '@hooks/useShortcutsEnabled'

export function GardenShortcuts() {
  // Site config sets the default; the reader's palette toggle overrides it.
  useKeyboardShortcuts(useShortcutsEnabled())
  return null
}
