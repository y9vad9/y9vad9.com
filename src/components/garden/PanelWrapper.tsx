'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { usePanelStore } from '@store/panelStore'
import { usePanelResize } from '@hooks/usePanelResize'
import { useIsMobile } from '@hooks/useMediaQuery'
import { useHydrated } from '@hooks/useHydrated'
import { useBodyScrollLock } from '@hooks/useBodyScrollLock'
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
// `overscroll-contain`: without it, scrolling past either end of the article
// chains to the document, which has no overflow constraint of its own — the
// page rubber-bands and carries the header off with it, since `NotesHeader`
// is sticky against the non-scrolling shell rather than against the document.
const BODY_FRAME_BASE =
  `bg-bg border border-border rounded-2xl overflow-x-hidden overscroll-contain ${STICKY_FRAME}`
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
//
// `z-30`, below the header's `z-40`. It used to match the header at `z-40`,
// and since this renders *after* `NotesHeader` in the layout — they are
// siblings under the shell — the tie broke in the drawer's favour and it
// painted over the bar. That was invisible while the header held only icons,
// but the language menu drops *out* of the header into the drawer's band, so
// it opened behind the drawer. Raising the menu could not help: the header is
// `sticky`, which opens a stacking context, so nothing inside it can outrank
// a sibling of the header itself. The drawer belongs under the bar anyway —
// it starts at `top-11`, deliberately below it, and the bar carries the
// toggle that closes it.
const MOBILE_DRAWER = 'fixed top-11 z-30 w-72 h-[calc(100dvh-2.75rem)] bg-shell flex flex-col overflow-hidden'

export function PanelWrapper({
  noteList,
  children,
}: {
  noteList: NoteListItem[]
  children: React.ReactNode
}) {
  const tA11y = useTranslations('a11y')
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

  // Locking `#notes-scroll` stops the article moving, but it does not stop the
  // *document* moving, and `html`/`body` carry no overflow constraint — so a
  // swipe that no longer scrolls the article reaches the document instead and
  // rubber-bands it, taking mobile Chrome's toolbar with it.
  //
  // `NotesHeader` cannot ride that out: it is `sticky top-0`, but its nearest
  // scroll container is the shell's `overflow-hidden` div, which never
  // scrolls — so sticky is inert here and the header travels with the page.
  // That is why the bar still slid away after the article stopped scrolling.
  //
  // Pinning the body is the same fix the landing drawer already uses; here
  // the page is never scrolled to begin with, so the offset it restores is 0.
  useBodyScrollLock(isMobile && anyPanelOpen)

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
            {/* `z-20`: under the drawer (z-30) it dims, and under the header
                (z-40) so the bar stays lit and usable while a drawer is open. */}
            <div
              className="fixed inset-0 z-20 bg-fg/30 backdrop-blur-sm"
              onClick={toggleLeft}
              aria-hidden="true"
            />
            <aside className={`${MOBILE_DRAWER} start-0`}>
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
              className="fixed inset-0 z-20 bg-fg/30 backdrop-blur-sm"
              onClick={toggleRight}
              aria-hidden="true"
            />
            <aside className={`${MOBILE_DRAWER} end-0`}>
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
            aria-label={tA11y('resizeLeftPanel')}
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
            aria-label={tA11y('resizeRightPanel')}
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
