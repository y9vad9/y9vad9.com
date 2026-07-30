'use client'

import { Files, Search, List, BookOpen, Link2, Network } from 'lucide-react'
import type { ExplorerMode, ToolsMode } from '@store/panelStore'

export interface PanelModeDef<M extends string> {
  mode: M
  icon: React.ReactNode
  /** Key under the panel's own i18n namespace. */
  titleKey: string
  /** Single-key shortcut, shown in the desktop tooltip. */
  hint: string
}

// Shared by the desktop header strip and the in-drawer mobile tabs so the two
// can't drift apart. Icons are elements, not components — defining them here
// keeps them out of any render body.
export const EXPLORER_MODES: PanelModeDef<ExplorerMode>[] = [
  { mode: 'files', icon: <Files size={14} />, titleKey: 'files', hint: 'E' },
  { mode: 'search', icon: <Search size={14} />, titleKey: 'search', hint: 'F' },
]

export const TOOLS_MODES: PanelModeDef<ToolsMode>[] = [
  { mode: 'toc', icon: <List size={14} />, titleKey: 'toc', hint: 'T' },
  { mode: 'series', icon: <BookOpen size={14} />, titleKey: 'series', hint: 'S' },
  { mode: 'links', icon: <Link2 size={14} />, titleKey: 'links', hint: 'L' },
  { mode: 'graph', icon: <Network size={14} />, titleKey: 'graph', hint: 'G' },
]

/**
 * Mode switcher rendered *inside* a panel, for mobile.
 *
 * On a phone the panels are drawers, so hanging their section buttons off the
 * top navbar put controls for a hidden surface in a bar that has no room for
 * them — it pushed the tab bar and search trigger around and left the header
 * crowded. Inside the drawer the tabs sit with the thing they control and the
 * navbar keeps a stable shape at every width.
 */
export function PanelModeTabs<M extends string>({
  modes,
  active,
  onSelect,
  label,
  labelFor,
}: {
  modes: PanelModeDef<M>[]
  active: M
  onSelect: (mode: M) => void
  /** Accessible name for the tablist itself. */
  label: string
  labelFor: (titleKey: string) => string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      // `flex-shrink-0` so the row never gets squeezed by the list below it.
      className="flex items-stretch gap-1.5 px-2 pt-2 pb-1 flex-shrink-0"
    >
      {modes.map(({ mode, icon, titleKey }) => {
        const isActive = mode === active
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(mode)}
            // `flex-1 min-w-0` splits the drawer evenly between the tabs —
            // content-width pills left a ragged gap on the right and gave the
            // four tools tabs a different rhythm from the two explorer ones.
            //
            // Icon above label rather than beside it: the tools panel shows
            // four tabs at ~64px each, and side-by-side left barely 28px for
            // the text — enough to truncate "Series", and hopeless for
            // Ukrainian "Посилання". Stacking hands the label the full tab
            // width instead.
            //
            // 10px, not 11: the widest label in the shipped locales is
            // "Посилання", which needs 59px at 11px against the ~58px a
            // four-tab row can give it. 10px brings it to ~54px and leaves
            // real headroom for devices whose font metrics differ. It's the
            // size iOS uses for tab-bar labels, so it doesn't read as small.
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 rounded-xl border text-[10px] leading-tight transition-colors ${
              isActive
                ? 'bg-primary-muted text-primary border-primary/40 font-medium'
                : 'text-muted border-border hover:text-fg hover:bg-card-hover'
            }`}
          >
            <span className="flex-shrink-0">{icon}</span>
            <span className="truncate max-w-full">{labelFor(titleKey)}</span>
          </button>
        )
      })}
    </div>
  )
}
