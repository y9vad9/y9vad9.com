import { describe, it, expect, vi } from 'vitest'
import {
  GARDEN_SHORTCUTS,
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
  }
  return { actions, calls }
}

describe('GARDEN_SHORTCUTS', () => {
  it('has no duplicate ids or triggers', () => {
    const ids = GARDEN_SHORTCUTS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Two shortcuts on the same chord would make one unreachable, and the
    // palette would list both as if they worked.
    const chords = GARDEN_SHORTCUTS.map((s) => `${s.mod}:${s.trigger}`)
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

  it('every shortcut is reachable by exactly one synthetic event', () => {
    // Guards the whole table at once: build the event each chord describes and
    // assert no other entry also claims it.
    for (const s of GARDEN_SHORTCUTS) {
      const event = s.mod
        ? { key: s.trigger, code: 'Irrelevant' }
        : { key: 'x', code: s.trigger }
      const matched = GARDEN_SHORTCUTS.filter((o) => matchesShortcut(o, event, s.mod))
      expect(matched.map((m) => m.id)).toEqual([s.id])
    }
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
