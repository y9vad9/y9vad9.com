'use client'

import { useSiteConfig } from '@lib/config/SiteConfigProvider'
import { useShortcutsStore } from '@store/shortcutsStore'

/**
 * Are keyboard shortcuts live right now?
 *
 * The reader's persisted choice wins; with none recorded this falls back to
 * `shortcuts.enabled` in site config, which itself defaults to on. Every
 * surface that binds a key or advertises one reads through here, so the
 * bindings, the palette's chord hints, and the `/` badge in the header can't
 * disagree about whether shortcuts are active.
 */
export function useShortcutsEnabled(): boolean {
  const preference = useShortcutsStore((s) => s.preference)
  const siteConfig = useSiteConfig()
  return preference ?? siteConfig.shortcuts?.enabled !== false
}
