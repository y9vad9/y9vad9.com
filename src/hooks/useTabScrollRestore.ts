'use client'

import { useLayoutEffect, useRef } from 'react'
import { useTabStore } from '@store/tabStore'

/**
 * Persists the user's scroll position in the shared `#notes-scroll`
 * container against the given tab slug, and restores it on mount.
 *
 * The hook is shared by every page that lives inside the notes layout —
 * individual note pages (via ArticleEnhancer) as well as the garden index
 * and global graph routes — so flipping between tabs returns the user to
 * exactly where they were on each one.
 *
 * Implementation notes are worth keeping in mind if you change this:
 *  - useLayoutEffect (not useEffect): when the slug changes, React commits
 *    the new page's DOM, then the browser eventually dispatches a "clamp"
 *    scroll event because the shared scroller's scrollTop no longer fits
 *    the (often shorter) new content. With a passive effect, that scroll
 *    event sometimes fires before cleanup and pollutes the saved value
 *    with the clamped 0. Layout effects run synchronously inside the
 *    commit, before any browser-dispatched scroll events.
 *  - lastScrollRef: cleanup persists this ref rather than reading
 *    scroller.scrollTop, for the same reason — by the time cleanup runs
 *    the DOM value has already been clamped.
 *  - restoringRef + ResizeObserver: the article body streams in after
 *    mount, so the saved offset is initially unreachable. Reapply the
 *    scroll on every content growth until either the target is reachable,
 *    the deadline elapses, or the user takes over.
 */
/**
 * Which note this hook last ran for, per page load. Module scope on purpose:
 * the page component remounts on every slug change, so a ref would reset with
 * it and every mount would look like the first one.
 */
let previousSlug: string | null = null

export function useTabScrollRestore(slug: string) {
  const lastScrollRef = useRef(0)
  const restoringRef = useRef(false)

  useLayoutEffect(() => {
    const scroller = document.getElementById('notes-scroll')
    if (!scroller) return
    let hashInterval: number | null = null
    let restoreRO: ResizeObserver | null = null
    let restoreDeadline: number | null = null
    const stopRestore = () => {
      if (restoreRO) { restoreRO.disconnect(); restoreRO = null }
      if (restoreDeadline !== null) {
        window.clearTimeout(restoreDeadline)
        restoreDeadline = null
      }
      restoringRef.current = false
    }

    /**
     * Try to scroll the `#notes-scroll` container to a hash-targeted
     * element. Polls because the article body may stream in after mount
     * (server components, MDX with async resolvers). We deliberately
     * compute the offset and set `scrollTop` directly instead of using
     * `scrollIntoView` — the latter chooses the "nearest scrollable
     * ancestor", and on some viewports that turns out to be the window
     * (which doesn't scroll), making the call a silent no-op. Direct
     * `scrollTop` always targets our container.
     */
    function scrollToHash(rawHash: string) {
      if (!rawHash) return
      const id = decodeURIComponent(rawHash.replace(/^#/, ''))
      const tryScroll = () => {
        const el = document.getElementById(id)
        if (!el) return false
        // Compute element offset within the scroll container.
        const offset = el.getBoundingClientRect().top
          - scroller!.getBoundingClientRect().top
          + scroller!.scrollTop
        scroller!.scrollTop = Math.max(0, offset)
        return true
      }
      // Immediate attempt covers the common case where the body is
      // already in the DOM. Failing that, poll for up to 1s while the
      // streaming finishes.
      if (tryScroll()) return
      if (hashInterval !== null) window.clearInterval(hashInterval)
      let attempts = 0
      hashInterval = window.setInterval(() => {
        if (tryScroll() || ++attempts > 20) {
          window.clearInterval(hashInterval!)
          hashInterval = null
        }
      }, 50)
    }

    function onHashChange() {
      scrollToHash(window.location.hash)
    }
    window.addEventListener('hashchange', onHashChange)

    const arrivedFrom = previousSlug
    previousSlug = slug

    const hash = window.location.hash ? window.location.hash.slice(1) : ''
    if (hash) {
      scrollToHash(hash)
    } else {
      const stored = useTabStore.getState().getScrollPosition(slug)
      lastScrollRef.current = stored
      // Only rewind when arriving from a *different* note, where the shared
      // scroller still holds the previous article's offset. On the first mount
      // of a page load there is nothing to rewind: the tab store is in-memory
      // so `stored` is always 0, while the server-rendered article is already
      // scrollable from first paint. Resetting there would throw away whatever
      // the reader scrolled during the seconds before hydration — which on a
      // phone reads as "the page ignores me for the first few seconds".
      // Comparing slugs (rather than a boolean) also keeps StrictMode's
      // double-invoked effect from counting as a navigation.
      if (arrivedFrom !== null && arrivedFrom !== slug) scroller.scrollTop = 0
      if (stored > 0) {
        restoringRef.current = true
        const apply = () => {
          if (!restoreRO) return
          const maxScroll = scroller.scrollHeight - scroller.clientHeight
          scroller.scrollTop = Math.min(stored, Math.max(0, maxScroll))
          if (maxScroll >= stored) stopRestore()
        }
        restoreRO = new ResizeObserver(apply)
        restoreRO.observe(scroller)
        if (scroller.firstElementChild) restoreRO.observe(scroller.firstElementChild)
        restoreDeadline = window.setTimeout(stopRestore, 1500)
        requestAnimationFrame(apply)
      }
    }

    function onScroll() {
      if (restoringRef.current) return
      lastScrollRef.current = scroller!.scrollTop
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('wheel', stopRestore, { passive: true })
    scroller.addEventListener('touchstart', stopRestore, { passive: true })
    scroller.addEventListener('keydown', stopRestore)

    return () => {
      if (hashInterval !== null) window.clearInterval(hashInterval)
      stopRestore()
      window.removeEventListener('hashchange', onHashChange)
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('wheel', stopRestore)
      scroller.removeEventListener('touchstart', stopRestore)
      scroller.removeEventListener('keydown', stopRestore)
      useTabStore.getState().saveScrollPosition(slug, lastScrollRef.current)
    }
  }, [slug])
}
