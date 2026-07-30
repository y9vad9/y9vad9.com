'use client'

import { useEffect } from 'react'

/**
 * Freeze the document behind a modal drawer.
 *
 * `overflow: hidden` on `<body>` alone is not enough on iOS Safari — it keeps
 * handing the touch to the document and the page scrolls underneath the
 * overlay anyway. Pinning the body with `position: fixed` at a negative offset
 * is the technique that actually holds, at the cost of having to restore the
 * scroll position by hand on release (a fixed body reports scrollY 0).
 *
 * The width pin matters too: a fixed body collapses to its content width and
 * the page visibly reflows as the drawer opens.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const { body } = document
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    const scrollY = window.scrollY

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'

    return () => {
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.left = previous.left
      body.style.right = previous.right
      body.style.width = previous.width
      body.style.overflow = previous.overflow
      // `scrollTo` rather than assigning scrollY: the browser only restores
      // the offset once the body is back in flow, which is right now.
      window.scrollTo(0, scrollY)
    }
  }, [locked])
}
