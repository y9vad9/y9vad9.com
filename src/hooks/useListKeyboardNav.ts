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
  /**
   * Keep the roving highlight hidden until the user actually navigates with
   * the keyboard (default false — the highlight is always live).
   *
   * Lists you reach by *clicking* an input want this on. The explorer's
   * filter and search boxes sit inside the same `.kbd-section` as their
   * list, so merely focusing the box made row 0 light up — which reads as
   * "this row is selected" to someone driving with a mouse, who never asked
   * for a selection and is about to click a different row. With this on the
   * highlight appears on the first arrow/Home/End press and disappears again
   * as soon as a pointer is used.
   */
  revealOnKeyboard?: boolean
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
  revealOnKeyboard = false,
}: UseListKeyboardNavOptions) {
  const [idx, setIdx] = useState(initialIdx)
  // When the caller didn't opt in, the highlight is live from the start —
  // every existing consumer keeps its current behaviour.
  const [kbdActive, setKbdActive] = useState(!revealOnKeyboard)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLElement | null>>([])

  // Deliberately an effect, not a render-phase adjustment. Callers may pass a
  // freshly-built array as `resetKey` (`series?.notes ?? []`), so the "compare
  // against previous value" patterns that would satisfy this rule see a new
  // identity every render and spin until React's re-render limit. Resetting
  // from an effect degrades to a redundant `setIdx` instead, which React drops.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => setIdx(initialIdx), [resetKey])

  // Only assign when it actually differs — a render-phase setState that keeps
  // the same value would re-enter this branch forever (count === 0, idx === 0).
  const clampedIdx = count > 0 ? Math.min(idx, count - 1) : 0
  if (clampedIdx !== idx) setIdx(clampedIdx)

  // Scroll the highlighted item into view when the index changes.
  useEffect(() => {
    itemRefs.current[idx]?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (count === 0) return
      // First keyboard press while the highlight is hidden only reveals the
      // cursor where it already sits. Moving as well would make ArrowDown
      // silently skip row 0 — the row the user is most likely reaching for
      // after typing a query.
      if (!kbdActive) {
        const isMove =
          e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End'
        const isActivate = e.key === 'Enter' || e.key === ' '
        if (!isMove && !isActivate) return
        setKbdActive(true)
        if (isMove) {
          e.preventDefault()
          return
        }
        // Enter / Space still activate straight away, so "type a query, hit
        // Enter" opens the top hit without an extra keypress.
      }
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
    [count, idx, onSelect, wrap, kbdActive],
  )

  const focus = useCallback(() => {
    containerRef.current?.focus()
  }, [])

  /**
   * Move the cursor from a pointer interaction (row hover). Also retires the
   * keyboard highlight: the mouse is driving now, and `:hover` already shows
   * where the pointer is — two highlights at once just looks like two
   * selections.
   */
  const pointTo = useCallback(
    (index: number) => {
      setIdx(index)
      if (revealOnKeyboard) setKbdActive(false)
    },
    [revealOnKeyboard],
  )

  /** Retire the keyboard highlight without moving the cursor (pointer down
   *  on the search/filter input that feeds this list). */
  const hideHighlight = useCallback(() => {
    if (revealOnKeyboard) setKbdActive(false)
  }, [revealOnKeyboard])

  const setItemRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      itemRefs.current[index] = el
    },
    [],
  )

  return {
    idx,
    setIdx,
    /**
     * Whether the roving highlight should be painted. Always true unless the
     * caller passed `revealOnKeyboard`. Gate the highlight class on this —
     * `idx` alone is always a valid index and says nothing about whether the
     * user wants to see a cursor.
     */
    kbdActive,
    pointTo,
    hideHighlight,
    onKeyDown,
    containerRef,
    setItemRef,
    focus,
    /**
     * Spread these onto the scrollable list container.
     *
     * Intentionally no `role="listbox"`, and correspondingly no
     * `role="option"` on the children. The listbox pattern needs the whole
     * set — an accessible name, `aria-activedescendant`, and options that are
     * genuinely selectable — and these panels hold heterogeneous navigation
     * items (links, headings, separators) where that is both intrusive and
     * inaccurate.
     *
     * The children previously carried `role="option"` without it, which is a
     * malformed tree: an option must live inside a listbox, so assistive tech
     * (and Lighthouse) saw orphaned options. Those roles are gone; the items
     * are plain `<a>`/`<button>` elements, announced individually, which is
     * what a navigation list wants. Where "this is the page you're on"
     * matters, items use `aria-current="page"` — the semantic that actually
     * fits, rather than `aria-selected`, which was being used to expose the
     * keyboard cursor and is not a selection at all.
     *
     * The container stays focusable so the `onKeyDown` handlers still work;
     * the cursor itself remains purely visual (`is-kbd`).
     */
    containerProps: {
      ref: containerRef,
      tabIndex: 0,
      onKeyDown,
    },
  }
}
