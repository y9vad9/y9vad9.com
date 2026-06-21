'use client'

import { useEffect, useRef, useState } from 'react'
import { usePanelStore } from '@store/panelStore'
import { usePanelResize } from '@hooks/usePanelResize'
import { useIsMobile } from '@hooks/useMediaQuery'
import { ExplorerPanel } from './ExplorerPanel'
import { ToolsPanel } from './ToolsPanel'

interface NoteListItem {
  slug: string
  title: string
  series: string | null
  order: number | null
}

// Header is h-11 (2.75rem). Both side panels AND the center body are sticky
// so the user always sees the rounded body frame in full — content scrolls
// INSIDE the body, not the page.
const STICKY_FRAME = 'sticky top-11 self-start h-[calc(100vh-2.75rem-0.5rem)]'

// The center body reads as a card: bordered + rounded on all sides, set
// against the panel/header background. It owns ALL borders in the layout —
// the header and side panels themselves are border-less. Scroll happens
// inside it so the rounded corners stay visible.
const BODY_FRAME =
  `bg-bg border border-border rounded-2xl overflow-y-auto overflow-x-hidden ${STICKY_FRAME}`

export function PanelWrapper({
  noteList,
  children,
}: {
  noteList: NoteListItem[]
  children: React.ReactNode
}) {
  const { leftOpen, rightOpen, leftWidth, rightWidth, toggleLeft, toggleRight } = usePanelStore()
  const isMobile = useIsMobile()
  const resizeLeft = usePanelResize('left')
  const resizeRight = usePanelResize('right')

  // Until the client mounts, `useIsMobile()` returns false and the persisted
  // panel state hasn't loaded yet — so SSR would render the desktop layout
  // with both panels open. On a phone that briefly flashes both panels at
  // full width before the mobile branch swaps in. Render a body-only layout
  // until mount so neither path leaks SSR defaults.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Per-viewport first-visit default. The store ships with both panels
  // closed so mobile never sees them open — even momentarily — before
  // the layout settles. On desktop we still want the open-by-default
  // affordance though, so once we've mounted AND we know the viewport
  // is desktop AND there's no persisted preference (`panels` key in
  // localStorage), flip both to open. After this runs once, zustand's
  // persist takes over: the user's toggles win for every future visit.
  const flippedRef = useRef(false)
  useEffect(() => {
    if (!mounted || flippedRef.current) return
    if (isMobile) return
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem('panels')) return // user already has a preference
    flippedRef.current = true
    usePanelStore.setState({ leftOpen: true, rightOpen: true })
  }, [mounted, isMobile])

  if (!mounted) {
    return (
      <div className="flex flex-1 items-stretch gap-2 px-2 pb-2">
        <div id="notes-scroll" className={`flex-1 min-w-0 ${BODY_FRAME}`}>
          {children}
        </div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="flex flex-1 relative px-2 pb-2">
        {leftOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-fg/30 backdrop-blur-sm"
              onClick={toggleLeft}
              aria-hidden="true"
            />
            <aside className="fixed top-11 bottom-0 left-0 z-40 w-72 bg-shell flex flex-col overflow-hidden">
              <ExplorerPanel notes={noteList} />
            </aside>
          </>
        )}
        <div id="notes-scroll" className={`flex-1 min-w-0 ${BODY_FRAME}`}>
          {children}
        </div>
        {rightOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-fg/30 backdrop-blur-sm"
              onClick={toggleRight}
              aria-hidden="true"
            />
            <aside className="fixed top-11 bottom-0 right-0 z-40 w-72 bg-shell flex flex-col overflow-hidden">
              <ToolsPanel />
            </aside>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-stretch gap-2 px-2 pb-2">
      {leftOpen && (
        <>
          <aside
            style={{ width: leftWidth }}
            className={`flex-shrink-0 flex flex-col overflow-hidden bg-shell ${STICKY_FRAME}`}
          >
            <ExplorerPanel notes={noteList} />
          </aside>
          <div
            onPointerDown={resizeLeft.onPointerDown}
            className={`w-1 -mx-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10 ${STICKY_FRAME}`}
            aria-label="Resize left panel"
            role="separator"
          />
        </>
      )}

      <div id="notes-scroll" className={`flex-1 min-w-0 ${BODY_FRAME}`}>
        {children}
      </div>

      {rightOpen && (
        <>
          <div
            onPointerDown={resizeRight.onPointerDown}
            className={`w-1 -mx-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10 ${STICKY_FRAME}`}
            aria-label="Resize right panel"
            role="separator"
          />
          <aside
            style={{ width: rightWidth }}
            className={`flex-shrink-0 flex flex-col overflow-hidden bg-shell ${STICKY_FRAME}`}
          >
            <ToolsPanel />
          </aside>
        </>
      )}
    </div>
  )
}
