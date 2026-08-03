import { usePanelStore } from '@store/panelStore'
import { useTabStore } from '@store/tabStore'
import type { ShortcutActions } from '@lib/shortcuts/gardenShortcuts'

export interface ShortcutActionDeps {
  /**
   * Sends the reader to a path. Passed in rather than reached for, because
   * the router lives in the component tree and this is not a hook.
   */
  navigate: (path: string) => void
  locale: string
}

/**
 * What a garden shortcut actually does, wired to the stores.
 *
 * Built once here rather than inline in each caller: the keyboard bindings,
 * the command palette and the index's action row all dispatch the same
 * shortcut ids, and three copies of this would let one of them keep a stale
 * idea of what "close tab" means — or, as happened, miss a new action
 * entirely until the compiler pointed at it.
 *
 * Reads through `getState()` instead of subscribing — a component dispatching
 * a command has no reason to re-render when a panel toggles behind it.
 */
export function createShortcutActions({ navigate, locale }: ShortcutActionDeps): ShortcutActions {
  return {
    toggleLeft: () => usePanelStore.getState().toggleLeft(),
    toggleRight: () => usePanelStore.getState().toggleRight(),
    closeActiveTab: () => {
      const { activeSlug, closeTab } = useTabStore.getState()
      if (activeSlug) closeTab(activeSlug)
    },
    focusExplorer: (mode) => usePanelStore.getState().focusExplorer(mode),
    focusTools: (mode) => usePanelStore.getState().focusTools(mode),
    // No tab bookkeeping here: the graph page mounts `RouteTabSync`, which
    // claims the tab on arrival. Doing it from both ends is how the URL and
    // the tab bar end up disagreeing about which one is active.
    openGlobalGraph: () => navigate(`/${locale}/notes/graph`),
  }
}
