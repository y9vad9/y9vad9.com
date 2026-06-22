'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseListKeyboardNavOptions {
  /** Number of items in the list. */
  count: number
  /** Called when Enter / Space is pressed on the highlighted item. */
  onSelect: (idx: number, e: React.KeyboardEvent) => void
  /** Initial highlight (defaults to 0). */
  initialIdx?: number
  /** Reset highlight when this changes (e.g. mode swap). */
  resetKey?: unknown
  /** Wrap around at the edges (default true). */
  wrap?: boolean
}

/**
 * Roving keyboard navigation for a list of focusable items, optimised for the
 * garden side panels: ArrowUp / ArrowDown move the highlight, Home / End jump
 * to ends, Enter / Space activate. The hook owns the highlight index and
 * exposes the props the list container needs.
 */
export function useListKeyboardNav({
  count,
  onSelect,
  initialIdx = 0,
  resetKey,
  wrap = true,
}: UseListKeyboardNavOptions) {
  const [idx, setIdx] = useState(initialIdx)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLElement | null>>([])

  useEffect(() => {
    setIdx(initialIdx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // Clamp when count shrinks below current idx.
  useEffect(() => {
    if (idx >= count) setIdx(Math.max(0, count - 1))
  }, [count, idx])

  // Scroll the highlighted item into view when the index changes.
  useEffect(() => {
    itemRefs.current[idx]?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (count === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIdx((i) => {
          const next = i + 1
          if (next >= count) return wrap ? 0 : i
          return next
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIdx((i) => {
          const prev = i - 1
          if (prev < 0) return wrap ? count - 1 : i
          return prev
        })
      } else if (e.key === 'Home') {
        e.preventDefault()
        setIdx(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setIdx(Math.max(0, count - 1))
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect(idx, e)
      }
    },
    [count, idx, onSelect, wrap],
  )

  const focus = useCallback(() => {
    containerRef.current?.focus()
  }, [])

  const setItemRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      itemRefs.current[index] = el
    },
    [],
  )

  return {
    idx,
    setIdx,
    onKeyDown,
    containerRef,
    setItemRef,
    focus,
    /**
     * Spread these onto the scrollable list container.
     *
     * Intentionally no `role="listbox"`. The ARIA listbox pattern requires
     * each child to carry `role="option"` and the container to expose an
     * accessible name + `aria-activedescendant` — wiring that across
     * heterogeneous panel items (links, headings, separators) is more
     * intrusive than the role buys us. Lighthouse flagged both omissions
     * as accessibility failures. The container stays focusable so the
     * `onKeyDown` shortcut handlers still work; screen readers fall back
     * to announcing each `<a>` / `<button>` child individually, which is
     * what we want for navigation lists anyway.
     */
    containerProps: {
      ref: containerRef,
      tabIndex: 0,
      onKeyDown,
    },
  }
}
