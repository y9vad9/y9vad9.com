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
  | 'globalGraph'

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
export type ShortcutScope = 'explorer' | 'tools' | 'tabs' | 'garden'

/** What a shortcut can do. Supplied by whoever holds the stores. */
export interface ShortcutActions {
  toggleLeft: () => void
  toggleRight: () => void
  closeActiveTab: () => void
  focusExplorer: (mode: ExplorerMode) => void
  focusTools: (mode: ToolsMode) => void
  openGlobalGraph: () => void
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
   *
   * `null` for a command with no chord. Those still belong in this list: the
   * palette is a menu of what the garden can do, not a keyboard reference,
   * and keeping a second list for the keyless ones is how the two would
   * drift. Every letter worth binding is already spoken for anyway.
   */
  trigger: string | null
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
  // The whole-garden graph, as opposed to the neighbourhood of the open note
  // that `graph` above shows in the tools panel. Reachable from the header
  // and the index's action row, but nowhere in the palette until now — and
  // the palette is where a reader goes when they don't know where a thing
  // lives.
  { id: 'globalGraph', scope: 'garden', mod: false, trigger: null, run: (a) => a.openGlobalGraph() },
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
 * or a bare `E` for the single-letter shortcuts. `null` when the command
 * binds no key and there is nothing to advertise.
 */
export function shortcutHint(shortcut: GardenShortcut, isMac: boolean): string | null {
  if (shortcut.trigger === null) return null
  if (shortcut.mod) return `${isMac ? '⌘' : 'Ctrl'} ${shortcut.trigger}`
  return shortcut.trigger.replace(/^Key/, '')
}

/**
 * Does this command answer what the reader typed?
 *
 * Every word has to appear somewhere in the label, in any order. A plain
 * `includes` on the whole string looked equivalent and wasn't: it demands the
 * words be adjacent and in the author's order, so "search notes" found
 * nothing at all against `Explorer: Search in notes` — the reader concluded
 * the command didn't exist. Nobody recalls a label to the preposition, and
 * the scope prefix put a word in front of every action besides.
 *
 * Deliberately not fuzzy, unlike note search: a typo'd command that silently
 * runs the wrong action is worse than one that doesn't come up.
 */
export function matchesCommandQuery(label: string, query: string): boolean {
  const haystack = label.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term))
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
  // Palette-only command. Without this an unbound entry would match every
  // event whose `key`/`code` is undefined.
  if (shortcut.trigger === null) return false
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
