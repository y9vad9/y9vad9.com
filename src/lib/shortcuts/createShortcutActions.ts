import { usePanelStore } from '@store/panelStore'
import { useTabStore } from '@store/tabStore'
import type { ShortcutActions } from '@lib/shortcuts/gardenShortcuts'

/**
 * What a garden shortcut actually does, wired to the stores.
 *
 * Built once here rather than inline in each caller: the command palette and
 * the index's action row both dispatch the same shortcut ids, and two copies
 * of this would let one of them keep a stale idea of what "close tab" means.
 *
 * Reads through `getState()` instead of subscribing — a component dispatching
 * a command has no reason to re-render when a panel toggles behind it.
 */
export function createShortcutActions(): ShortcutActions {
  return {
    toggleLeft: () => usePanelStore.getState().toggleLeft(),
    toggleRight: () => usePanelStore.getState().toggleRight(),
    closeActiveTab: () => {
      const { activeSlug, closeTab } = useTabStore.getState()
      if (activeSlug) closeTab(activeSlug)
    },
    focusExplorer: (mode) => usePanelStore.getState().focusExplorer(mode),
    focusTools: (mode) => usePanelStore.getState().focusTools(mode),
  }
}
