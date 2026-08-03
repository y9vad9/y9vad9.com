'use client'

import { useCallback, useRef } from 'react'
import { usePanelStore } from '@store/panelStore'

/**
 * Returns a pointer-event handler to attach to a vertical drag handle.
 * `side` indicates which panel is being resized.
 */
export function usePanelResize(side: 'left' | 'right') {
  const setLeftWidth = usePanelStore((s) => s.setLeftWidth)
  const setRightWidth = usePanelStore((s) => s.setRightWidth)
  const startState = useRef<{ x: number; width: number } | null>(null)

  const onMove = useCallback(
    (e: PointerEvent) => {
      const start = startState.current
      if (!start) return
      // Pointer movement is physical; panel sides are logical. Under
      // `dir="rtl"` the "left" panel renders on the right, so dragging outward
      // (toward the viewport edge) is a *decreasing* clientX there — without
      // this, grabbing the handle and pulling away from the content shrank the
      // panel instead of growing it.
      const rtl =
        typeof document !== 'undefined' &&
        document.documentElement.getAttribute('dir') === 'rtl'
      const delta = (e.clientX - start.x) * (rtl ? -1 : 1)
      const next = side === 'left' ? start.width + delta : start.width - delta
      if (side === 'left') setLeftWidth(next)
      else setRightWidth(next)
    },
    [side, setLeftWidth, setRightWidth],
  )

  // Registered with `{ once: true }` below, so it unregisters itself rather
  // than referencing its own binding.
  const onUp = useCallback(() => {
    startState.current = null
    document.removeEventListener('pointermove', onMove)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [onMove])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const { leftWidth, rightWidth } = usePanelStore.getState()
      startState.current = {
        x: e.clientX,
        width: side === 'left' ? leftWidth : rightWidth,
      }
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp, { once: true })
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      e.preventDefault()
    },
    [side, onMove, onUp],
  )

  return { onPointerDown }
}
