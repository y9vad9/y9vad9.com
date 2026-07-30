'use client'

import { useEffect, useRef } from 'react'

/**
 * Close-on-outside-press for popovers and dropdowns.
 *
 * Listens for `pointerdown` rather than `mousedown` so a tap dismisses the
 * menu on touch devices too — with `mousedown` the synthetic mouse event only
 * arrives after the tap completes, and on iOS it may not arrive at all until
 * something else is tapped, which leaves the menu stuck open.
 *
 * `pointerdown` also fires before `click`, so a press on the trigger itself
 * is seen here first. Keep the trigger *inside* the returned ref's element or
 * it will read as an outside press and the menu will close and immediately
 * reopen.
 */
export function useOnClickOutside<T extends HTMLElement>(
  active: boolean,
  onOutside: () => void,
) {
  const ref = useRef<T>(null)
  const handlerRef = useRef(onOutside)

  useEffect(() => {
    handlerRef.current = onOutside
  }, [onOutside])

  useEffect(() => {
    if (!active) return
    function onPointerDown(e: PointerEvent) {
      const el = ref.current
      if (el && !el.contains(e.target as Node)) handlerRef.current()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handlerRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [active])

  return ref
}
