import { describe, it, expect, vi } from 'vitest'
import {
  GARDEN_SHORTCUTS,
  matchesCommandQuery,
  matchesShortcut,
  shortcutHint,
  type ShortcutActions,
} from '@lib/shortcuts/gardenShortcuts'

/**
 * This list is the single source for both the key bindings and the command
 * palette's entries. The point of sharing it is that the palette cannot
 * advertise a chord the handler doesn't fire, so the tests here are mostly
 * about that contract holding.
 */
function actionsSpy() {
  const calls: string[] = []
  const actions: ShortcutActions = {
    toggleLeft: () => calls.push('toggleLeft'),
    toggleRight: () => calls.push('toggleRight'),
    closeActiveTab: () => calls.push('closeActiveTab'),
    focusExplorer: (mode) => calls.push(`explorer:${mode}`),
    focusTools: (mode) => calls.push(`tools:${mode}`),
    openGlobalGraph: () => calls.push('openGlobalGraph'),
  }
  return { actions, calls }
}

/** The entries that bind a key. The rest are palette-only. */
const BOUND = GARDEN_SHORTCUTS.filter((s) => s.trigger !== null)

describe('GARDEN_SHORTCUTS', () => {
  it('has no duplicate ids or triggers', () => {
    const ids = GARDEN_SHORTCUTS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Two shortcuts on the same chord would make one unreachable, and the
    // palette would list both as if they worked. Keyless commands are exempt
    // — sharing "no chord" costs nothing.
    const chords = BOUND.map((s) => `${s.mod}:${s.trigger}`)
    expect(new Set(chords).size).toBe(chords.length)
  })

  it('runs a distinct action for every entry', () => {
    const { actions, calls } = actionsSpy()
    for (const s of GARDEN_SHORTCUTS) s.run(actions)
    expect(calls).toHaveLength(GARDEN_SHORTCUTS.length)
    // Distinct actions: an entry that duplicated another would be a palette
    // row that looks meaningful and isn't.
    expect(new Set(calls).size).toBe(calls.length)
  })
})

describe('shortcutHint', () => {
  it('uses the platform modifier symbol', () => {
    const toggleLeft = GARDEN_SHORTCUTS.find((s) => s.id === 'toggleLeft')!
    expect(shortcutHint(toggleLeft, true)).toBe('⌘ [')
    expect(shortcutHint(toggleLeft, false)).toBe('Ctrl [')
  })

  it('strips the Key prefix from bare-letter shortcuts', () => {
    const graph = GARDEN_SHORTCUTS.find((s) => s.id === 'graph')!
    // The trigger is a `KeyboardEvent.code`; showing "KeyG" would be nonsense.
    expect(shortcutHint(graph, true)).toBe('G')
    expect(shortcutHint(graph, false)).toBe('G')
  })

  it('advertises no chord for a palette-only command', () => {
    const globalGraph = GARDEN_SHORTCUTS.find((s) => s.id === 'globalGraph')!
    // The palette prints whatever comes back beside the row. Anything but
    // null here is a key that doesn't fire, presented as one that does.
    expect(shortcutHint(globalGraph, true)).toBeNull()
    expect(shortcutHint(globalGraph, false)).toBeNull()
  })
})

describe('matchesShortcut', () => {
  const toggleLeft = GARDEN_SHORTCUTS.find((s) => s.id === 'toggleLeft')!
  const graph = GARDEN_SHORTCUTS.find((s) => s.id === 'graph')!

  it('matches a modifier chord only with the modifier held', () => {
    expect(matchesShortcut(toggleLeft, { key: '[', code: 'BracketLeft' }, true)).toBe(true)
    expect(matchesShortcut(toggleLeft, { key: '[', code: 'BracketLeft' }, false)).toBe(false)
  })

  it('matches a bare letter only without the modifier', () => {
    expect(matchesShortcut(graph, { key: 'g', code: 'KeyG' }, false)).toBe(true)
    // ⌘G is find-again in the browser; the garden must not steal it.
    expect(matchesShortcut(graph, { key: 'g', code: 'KeyG' }, true)).toBe(false)
  })

  it('matches bare letters by physical key, not the character produced', () => {
    // On a layout where the G key yields a different character, `key` differs
    // but `code` does not — matching on `key` would silently break there.
    expect(matchesShortcut(graph, { key: 'п', code: 'KeyG' }, false)).toBe(true)
    expect(matchesShortcut(graph, { key: 'g', code: 'KeyP' }, false)).toBe(false)
  })

  it('every bound shortcut is reachable by exactly one synthetic event', () => {
    // Guards the whole table at once: build the event each chord describes and
    // assert no other entry also claims it.
    for (const s of BOUND) {
      const event = s.mod
        ? { key: s.trigger!, code: 'Irrelevant' }
        : { key: 'x', code: s.trigger! }
      const matched = GARDEN_SHORTCUTS.filter((o) => matchesShortcut(o, event, s.mod))
      expect(matched.map((m) => m.id)).toEqual([s.id])
    }
  })

  it('never fires a keyless command', () => {
    const globalGraph = GARDEN_SHORTCUTS.find((s) => s.id === 'globalGraph')!
    // Stated rather than merely true: today the comparison happens to fail
    // because no `code` equals `null`, but the moment `trigger` becomes
    // optional instead, `undefined === undefined` on an event without a
    // `code` makes an unbound command answer to a key it never claimed.
    expect(matchesShortcut(globalGraph, { key: 'g', code: 'KeyG' }, false)).toBe(false)
    expect(matchesShortcut(globalGraph, { key: '[', code: 'BracketLeft' }, true)).toBe(false)
    expect(
      matchesShortcut(globalGraph, {} as unknown as Pick<KeyboardEvent, 'key' | 'code'>, false),
    ).toBe(false)
  })
})

describe('matchesCommandQuery', () => {
  const LABEL = 'Explorer: Search in notes'

  it('matches the words a reader would actually type', () => {
    // The bug this replaces: a whole-string `includes` demanded the words be
    // adjacent and in the author's order, so this exact query returned
    // nothing and the command read as missing.
    expect(matchesCommandQuery(LABEL, 'search notes')).toBe(true)
  })

  it('ignores the order the words come in', () => {
    expect(matchesCommandQuery(LABEL, 'notes search')).toBe(true)
    expect(matchesCommandQuery(LABEL, 'explorer search')).toBe(true)
  })

  it('still requires every word', () => {
    // Not fuzzy, on purpose: a mistyped command that runs the wrong action is
    // worse than one that doesn't come up.
    expect(matchesCommandQuery(LABEL, 'search graph')).toBe(false)
    expect(matchesCommandQuery(LABEL, 'serch')).toBe(false)
  })

  it('shows everything for an empty or blank query', () => {
    expect(matchesCommandQuery(LABEL, '')).toBe(true)
    expect(matchesCommandQuery(LABEL, '   ')).toBe(true)
  })

  it('keeps prefix typing alive', () => {
    // The list has to narrow as the reader types, not only once a word is
    // finished.
    expect(matchesCommandQuery(LABEL, 'sea')).toBe(true)
    expect(matchesCommandQuery(LABEL, 'search no')).toBe(true)
  })

  it('separates the two graph commands by the word between them', () => {
    const local = 'Tools: Open local graph'
    const global = 'Garden: Open knowledge graph'
    expect(matchesCommandQuery(global, 'knowledge graph')).toBe(true)
    expect(matchesCommandQuery(local, 'knowledge graph')).toBe(false)
    expect(matchesCommandQuery(local, 'local graph')).toBe(true)
    // "graph" alone is ambiguous and should surface both — that's the point
    // of naming them rather than disambiguating by scope alone.
    expect(matchesCommandQuery(local, 'graph')).toBe(true)
    expect(matchesCommandQuery(global, 'graph')).toBe(true)
  })
})

describe('isMacPlatform', () => {
  it('reads userAgentData when present', async () => {
    vi.stubGlobal('navigator', { userAgentData: { platform: 'macOS' }, platform: 'Linux x86_64' })
    const { isMacPlatform } = await import('@lib/shortcuts/gardenShortcuts')
    expect(isMacPlatform()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('falls back to navigator.platform where userAgentData is absent', async () => {
    // Safari and Firefox ship no `userAgentData`.
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    const { isMacPlatform } = await import('@lib/shortcuts/gardenShortcuts')
    expect(isMacPlatform()).toBe(true)
    vi.stubGlobal('navigator', { platform: 'Win32' })
    expect(isMacPlatform()).toBe(false)
    vi.unstubAllGlobals()
  })
})
