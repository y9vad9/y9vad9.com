'use client'

import { useEffect } from 'react'

/** Surfaces that own their zoom and must keep receiving pinch gestures. */
const ZOOM_EXEMPT = '.graph-canvas-zoom'

/**
 * Stops pinch-zoom on iOS Safari, which the viewport meta cannot.
 *
 * Safari has ignored `user-scalable=no` and clamped `maximum-scale` since
 * iOS 10, so `<meta name="viewport">` only gets us Android and desktop. The
 * remaining lever is Safari's proprietary `gesture*` events: cancelling
 * `gesturestart` prevents the pinch from ever becoming a page zoom.
 *
 * The graph is deliberately exempt — it runs its own d3-zoom on the canvas,
 * and that is the one place pinching should scale the content.
 *
 * Note this only governs *gesture* zoom. Desktop keyboard zoom (⌘/Ctrl +/-)
 * and the OS accessibility zoom stay available, which is as it should be:
 * they're how someone with low vision reads the page at all.
 */
export function ZoomLock() {
  useEffect(() => {
    function onGesture(e: Event) {
      const target = e.target as Element | null
      if (target?.closest?.(ZOOM_EXEMPT)) return
      e.preventDefault()
    }

    // Non-passive: a passive listener cannot cancel the gesture, and Safari
    // treats these as passive by default on the document.
    const opts: AddEventListenerOptions = { passive: false }
    const events = ['gesturestart', 'gesturechange', 'gestureend']
    for (const name of events) document.addEventListener(name, onGesture, opts)
    return () => {
      for (const name of events) document.removeEventListener(name, onGesture, opts)
    }
  }, [])

  return null
}
