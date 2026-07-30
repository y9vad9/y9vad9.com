import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTabScrollRestore } from '@hooks/useTabScrollRestore'
import { useTabStore } from '@store/tabStore'

interface FakeRO {
  trigger: () => void
}

function getRO(): FakeRO {
  const all = (globalThis as { __resizeObservers?: FakeRO[] }).__resizeObservers
  return all![all!.length - 1]
}

beforeEach(() => {
  ;(globalThis as { __resizeObservers?: FakeRO[] }).__resizeObservers = []
  useTabStore.setState({ tabs: [], activeSlug: null })
  document.body.innerHTML = `<div id="notes-scroll"><div id="body"></div></div>`
  const scroller = document.getElementById('notes-scroll')!
  // jsdom never computes real sizes; pin them so the restore loop has
  // something to clamp against.
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 600 })
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 200, writable: true })
  Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 0, writable: true })
})

describe('useTabScrollRestore', () => {
  it('starts the scroller at 0 when nothing is saved', () => {
    const { unmount } = renderHook(() => useTabScrollRestore('a'))
    const scroller = document.getElementById('notes-scroll')!
    expect(scroller.scrollTop).toBe(0)
    unmount()
  })

  it('restores the saved offset once content grows tall enough', () => {
    useTabStore.setState({
      tabs: [{ slug: 'a', title: 'A', scrollY: 800, kind: 'note' }],
      activeSlug: 'a',
    })
    renderHook(() => useTabScrollRestore('a'))
    const scroller = document.getElementById('notes-scroll')!

    // Initially scrollHeight is 200, clientHeight 600 → maxScroll = 0,
    // so scrollTop clamps to 0.
    expect(scroller.scrollTop).toBe(0)

    // Simulate content growing past the saved offset and a resize firing.
    act(() => {
      Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 })
      getRO().trigger()
    })
    expect(scroller.scrollTop).toBe(800)
  })

  it('persists the live scroll position on unmount', () => {
    // The tab must exist in the store, otherwise saveScrollPosition's
    // map(...t.slug === slug) finds nothing and silently no-ops.
    useTabStore.setState({
      tabs: [{ slug: 'a', title: 'A', scrollY: 0, kind: 'note' }],
      activeSlug: 'a',
    })
    const scroller = document.getElementById('notes-scroll')!
    let backing = 0
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => backing,
      set: (v: number) => { backing = v },
    })
    const { unmount } = renderHook(() => useTabScrollRestore('a'))
    act(() => {
      scroller.scrollTop = 500
      scroller.dispatchEvent(new Event('scroll'))
    })
    unmount()
    expect(useTabStore.getState().getScrollPosition('a')).toBe(500)
  })

  it('saves zero (no clobber) when unmounting without any user scroll', () => {
    useTabStore.setState({
      tabs: [{ slug: 'a', title: 'A', scrollY: 0, kind: 'note' }],
      activeSlug: 'a',
    })
    const { unmount } = renderHook(() => useTabScrollRestore('a'))
    unmount()
    expect(useTabStore.getState().getScrollPosition('a')).toBe(0)
  })
})

describe('useTabScrollRestore — rewind only on navigation', () => {
  // The hook tracks the previous slug in module scope, so each case needs a
  // freshly-imported copy to look like a first page load.
  async function freshHook() {
    vi.resetModules()
    const mod = await import('@hooks/useTabScrollRestore')
    return mod.useTabScrollRestore
  }

  it('leaves a pre-hydration scroll position alone on the first mount', async () => {
    const hook = await freshHook()
    const scroller = document.getElementById('notes-scroll')!
    // The server-rendered article is scrollable before any JS runs, so the
    // reader may already be part-way down when hydration finally lands.
    scroller.scrollTop = 420
    renderHook(() => hook('a'))
    expect(scroller.scrollTop).toBe(420)
  })

  it('rewinds to the top when arriving from a different note', async () => {
    const hook = await freshHook()
    const scroller = document.getElementById('notes-scroll')!
    renderHook(() => hook('a')).unmount()
    scroller.scrollTop = 420 // offset left behind by the previous article
    renderHook(() => hook('b'))
    expect(scroller.scrollTop).toBe(0)
  })

  it('does not rewind when the same note mounts again', async () => {
    const hook = await freshHook()
    const scroller = document.getElementById('notes-scroll')!
    renderHook(() => hook('a')).unmount()
    scroller.scrollTop = 420
    renderHook(() => hook('a'))
    expect(scroller.scrollTop).toBe(420)
  })
})
