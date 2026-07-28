'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ExplorerMode = 'files' | 'search'
export type ToolsMode = 'toc' | 'series' | 'links' | 'graph'

export const PANEL_MIN_WIDTH = 180
export const PANEL_MAX_WIDTH = 400

interface PanelStore {
  leftOpen: boolean
  rightOpen: boolean
  leftWidth: number
  rightWidth: number
  explorerMode: ExplorerMode
  toolsMode: ToolsMode
  /** Incremented to request that the explorer panel grab keyboard focus. */
  explorerFocusNonce: number
  /** Incremented to request that the tools panel grab keyboard focus. */
  toolsFocusNonce: number
  toggleLeft: () => void
  toggleRight: () => void
  /** Close the left panel. No-op when it's already closed. */
  closeLeft: () => void
  /** Close the right panel. No-op when it's already closed. */
  closeRight: () => void
  setLeftWidth: (px: number) => void
  setRightWidth: (px: number) => void
  setExplorerMode: (mode: ExplorerMode) => void
  setToolsMode: (mode: ToolsMode) => void
  /** Open the left panel (if closed) and request keyboard focus. */
  focusExplorer: (mode?: ExplorerMode) => void
  /** Open the right panel (if closed) and request keyboard focus. */
  focusTools: (mode?: ToolsMode) => void
}

function clamp(px: number): number {
  return Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, px))
}

export const usePanelStore = create<PanelStore>()(
  persist(
    (set) => ({
      // Both panels closed by default. Mobile never gets a "panels
      // open" flash, even briefly, because the only way panels open
      // here is via an opt-in path after mount. `PanelWrapper` opens
      // them on desktop on first visit (no localStorage preference
      // yet) — see the comment over `useDefaultPanelsOnDesktop`
      // there.
      leftOpen: false,
      rightOpen: false,
      leftWidth: 240,
      rightWidth: 240,
      explorerMode: 'files',
      toolsMode: 'toc',
      explorerFocusNonce: 0,
      toolsFocusNonce: 0,
      toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
      toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
      closeLeft: () => set({ leftOpen: false }),
      closeRight: () => set({ rightOpen: false }),
      setLeftWidth: (px) => set({ leftWidth: clamp(px) }),
      setRightWidth: (px) => set({ rightWidth: clamp(px) }),
      setExplorerMode: (explorerMode) => set({ explorerMode }),
      setToolsMode: (toolsMode) => set({ toolsMode }),
      focusExplorer: (mode) =>
        set((s) => ({
          leftOpen: true,
          explorerMode: mode ?? s.explorerMode,
          explorerFocusNonce: s.explorerFocusNonce + 1,
        })),
      focusTools: (mode) =>
        set((s) => ({
          rightOpen: true,
          toolsMode: mode ?? s.toolsMode,
          toolsFocusNonce: s.toolsFocusNonce + 1,
        })),
    }),
    {
      name: 'panels',
      partialize: (s) => ({
        leftOpen: s.leftOpen,
        rightOpen: s.rightOpen,
        leftWidth: s.leftWidth,
        rightWidth: s.rightWidth,
        explorerMode: s.explorerMode,
        toolsMode: s.toolsMode,
      }),
    },
  ),
)
