import type { ExplorerMode, ToolsMode } from '@store/panelStore'

/**
 * The garden's keyboard shortcuts, defined once.
 *
 * Two consumers read this list: `useKeyboardShortcuts`, which binds the keys,
 * and the command palette, which lists the same actions and shows the chord
 * beside each one. Declaring the binding and the advertisement separately
 * would let them drift — the palette promising a key that no longer fires is
 * worse than not advertising it at all.
 *
 * Discoverability is the point of the palette entries: these were previously
 * undocumented in the UI, so a reader had no way to learn that `g` opens the
 * graph short of reading the source.
 */
export type ShortcutId =
  | 'toggleLeft'
  | 'toggleRight'
  | 'closeTab'
  | 'explorer'
  | 'search'
  | 'toc'
  | 'series'
  | 'links'
  | 'graph'

/**
 * The part of the garden a command acts on.
 *
 * The palette prints this ahead of the action as `Scope: Action`, the
 * convention Obsidian uses. It matters for finding things: a reader who knows
 * *where* they want to act — the explorer, the tools panel — can type that and
 * see every command for it, without having to guess the verb someone chose.
 * Typing the verb still works, since the scope is only a prefix on the same
 * searchable string.
 */
export type ShortcutScope = 'explorer' | 'tools' | 'tabs'

/** What a shortcut can do. Supplied by whoever holds the stores. */
export interface ShortcutActions {
  toggleLeft: () => void
  toggleRight: () => void
  closeActiveTab: () => void
  focusExplorer: (mode: ExplorerMode) => void
  focusTools: (mode: ToolsMode) => void
}

export interface GardenShortcut {
  id: ShortcutId
  /** Groups the command in the palette — see `ShortcutScope`. */
  scope: ShortcutScope
  /** Requires the platform modifier — ⌘ on macOS, Ctrl elsewhere. */
  mod: boolean
  /**
   * With `mod`, a `KeyboardEvent.key` (punctuation, unaffected by layout).
   * Without, a `KeyboardEvent.code` — matching physical keys keeps the
   * bare-letter shortcuts working where a modifier or layout would otherwise
   * substitute the character.
   */
  trigger: string
  run: (actions: ShortcutActions) => void
}

export const GARDEN_SHORTCUTS: readonly GardenShortcut[] = [
  { id: 'toggleLeft', scope: 'explorer', mod: true, trigger: '[', run: (a) => a.toggleLeft() },
  { id: 'toggleRight', scope: 'tools', mod: true, trigger: ']', run: (a) => a.toggleRight() },
  { id: 'closeTab', scope: 'tabs', mod: true, trigger: '\\', run: (a) => a.closeActiveTab() },
  { id: 'explorer', scope: 'explorer', mod: false, trigger: 'KeyE', run: (a) => a.focusExplorer('files') },
  { id: 'search', scope: 'explorer', mod: false, trigger: 'KeyF', run: (a) => a.focusExplorer('search') },
  { id: 'toc', scope: 'tools', mod: false, trigger: 'KeyT', run: (a) => a.focusTools('toc') },
  { id: 'series', scope: 'tools', mod: false, trigger: 'KeyS', run: (a) => a.focusTools('series') },
  { id: 'links', scope: 'tools', mod: false, trigger: 'KeyL', run: (a) => a.focusTools('links') },
  { id: 'graph', scope: 'tools', mod: false, trigger: 'KeyG', run: (a) => a.focusTools('graph') },
]

/**
 * `Scope: Action`, as the palette lists it.
 *
 * Kept here rather than inlined at the call site so the shortcuts toggle —
 * which is not a `GardenShortcut`, since it binds no key — is built the same
 * way and cannot drift into a different separator or order.
 */
export function scopedCommandLabel(scope: string, action: string): string {
  return `${scope}: ${action}`
}

/**
 * The chord as a reader should see it — `⌘ [` on macOS, `Ctrl [` elsewhere,
 * or a bare `E` for the single-letter shortcuts.
 */
export function shortcutHint(shortcut: GardenShortcut, isMac: boolean): string {
  if (shortcut.mod) return `${isMac ? '⌘' : 'Ctrl'} ${shortcut.trigger}`
  return shortcut.trigger.replace(/^Key/, '')
}

/**
 * Does this event fire the shortcut?
 *
 * `mod` shortcuts are allowed while typing — ⌘[ is not something a text field
 * wants. Bare letters are not: they would eat every `e` and `f` the reader
 * types into the search box, so the caller filters those out first.
 */
export function matchesShortcut(
  shortcut: GardenShortcut,
  event: Pick<KeyboardEvent, 'key' | 'code'>,
  modPressed: boolean,
): boolean {
  if (shortcut.mod) return modPressed && event.key === shortcut.trigger
  return !modPressed && event.code === shortcut.trigger
}

/** macOS uses ⌘ where every other platform uses Ctrl. */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  // `userAgentData` is the non-deprecated source; `platform` remains the
  // only option in Safari and Firefox.
  const modern = (navigator as { userAgentData?: { platform?: string } }).userAgentData
  const platform = modern?.platform ?? navigator.platform ?? ''
  return platform.toLowerCase().includes('mac')
}
