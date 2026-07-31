'use client'

import { useEffect, useRef } from 'react'
import { usePanelStore } from '@store/panelStore'
import { usePanelResize } from '@hooks/usePanelResize'
import { useIsMobile } from '@hooks/useMediaQuery'
import { useHydrated } from '@hooks/useHydrated'
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
// dvh, not vh: on iOS `100vh` is the toolbar-hidden height, so a vh-sized
// shell inside `overflow-hidden` puts its own bottom out of reach.
const STICKY_FRAME = 'sticky top-11 self-start h-[calc(100dvh-2.75rem-0.5rem)]'

// The center body reads as a card: bordered + rounded on all sides, set
// against the panel/header background. It owns ALL borders in the layout —
// the header and side panels themselves are border-less. Scroll happens
// inside it so the rounded corners stay visible.
const BODY_FRAME_BASE =
  `bg-bg border border-border rounded-2xl overflow-x-hidden ${STICKY_FRAME}`
const BODY_FRAME = `${BODY_FRAME_BASE} overflow-y-auto`

// The garden scrolls inside `#notes-scroll`, not on the document, so the
// body-pinning trick the landing page uses does nothing here — a mobile
// drawer overlaid the article and the article kept scrolling underneath it.
// Taking the overflow away is enough to stop that, and unlike a fixed body it
// preserves `scrollTop`, so the reader's position is exactly where they left
// it when the drawer closes.
const BODY_FRAME_LOCKED = `${BODY_FRAME_BASE} overflow-y-hidden`

// Drawers hang below the h-11 header. `bottom-0` would resolve against the
// large viewport and tuck the last entries behind mobile Chrome's retractable
// toolbar, so the height is expressed in `dvh` instead.
const MOBILE_DRAWER = 'fixed top-11 z-40 w-72 h-[calc(100dvh-2.75rem)] bg-shell flex flex-col overflow-hidden'

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
  const mounted = useHydrated()

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

  // `leftOpen`/`rightOpen` are persisted so a desktop reader keeps the layout
  // they arranged. On mobile the same panels are modal drawers, and restoring
  // a modal open is a bug rather than a preference: opening a note from the
  // landing page dropped the reader straight into the file explorer, because
  // some earlier visit had left `leftOpen: true` in localStorage.
  //
  // Closing whenever the mobile layout takes over — on mount, or on a resize
  // across the breakpoint — costs nothing, since a drawer the reader opened
  // during this visit doesn't re-run this effect.
  useEffect(() => {
    if (!mounted || !isMobile) return
    usePanelStore.setState({ leftOpen: false, rightOpen: false })
  }, [mounted, isMobile])

  const anyPanelOpen = leftOpen || rightOpen

  if (!mounted) {
    return (
      <div className="flex flex-1 items-stretch gap-2 px-2 pb-2">
        <main id="notes-scroll" className={`flex-1 min-w-0 ${BODY_FRAME}`}>
          {children}
        </main>
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
            <aside className={`${MOBILE_DRAWER} left-0`}>
              <ExplorerPanel notes={noteList} />
            </aside>
          </>
        )}
        <main
          id="notes-scroll"
          className={`flex-1 min-w-0 ${anyPanelOpen ? BODY_FRAME_LOCKED : BODY_FRAME}`}
        >
          {children}
        </main>
        {rightOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-fg/30 backdrop-blur-sm"
              onClick={toggleRight}
              aria-hidden="true"
            />
            <aside className={`${MOBILE_DRAWER} right-0`}>
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

      <main id="notes-scroll" className={`flex-1 min-w-0 ${BODY_FRAME}`}>
        {children}
      </main>

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
