import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useBodyScrollLock } from '@hooks/useBodyScrollLock'

let scrollTo: ReturnType<typeof vi.fn>

beforeEach(() => {
  document.body.removeAttribute('style')
  scrollTo = vi.fn()
  vi.stubGlobal('scrollTo', scrollTo)
  vi.stubGlobal('scrollY', 0)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.removeAttribute('style')
})

describe('useBodyScrollLock', () => {
  it('leaves the body alone when unlocked', () => {
    renderHook(() => useBodyScrollLock(false))
    expect(document.body.style.position).toBe('')
    expect(document.body.style.overflow).toBe('')
  })

  it('pins the body when locked', () => {
    vi.stubGlobal('scrollY', 420)
    renderHook(() => useBodyScrollLock(true))
    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.overflow).toBe('hidden')
    // Negative offset keeps the same content under the drawer.
    expect(document.body.style.top).toBe('-420px')
  })

  it('pins the width so a fixed body does not collapse and reflow the page', () => {
    renderHook(() => useBodyScrollLock(true))
    expect(document.body.style.width).toBe('100%')
  })

  it('restores the styles and the scroll offset on release', () => {
    vi.stubGlobal('scrollY', 420)
    const { rerender } = renderHook((locked: boolean) => useBodyScrollLock(locked), {
      initialProps: true,
    })
    rerender(false)
    expect(document.body.style.position).toBe('')
    expect(document.body.style.top).toBe('')
    expect(document.body.style.width).toBe('')
    expect(document.body.style.overflow).toBe('')
    // A fixed body reports scrollY 0, so the offset has to be put back by hand.
    expect(scrollTo).toHaveBeenCalledWith(0, 420)
  })

  it('restores on unmount too', () => {
    vi.stubGlobal('scrollY', 100)
    const { unmount } = renderHook(() => useBodyScrollLock(true))
    unmount()
    expect(document.body.style.position).toBe('')
    expect(scrollTo).toHaveBeenCalledWith(0, 100)
  })

  it('hands back whatever inline styles the body already had', () => {
    document.body.style.overflow = 'scroll'
    const { unmount } = renderHook(() => useBodyScrollLock(true))
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('scroll')
  })
})
