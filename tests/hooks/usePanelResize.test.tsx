import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePanelResize } from '@hooks/usePanelResize'
import { usePanelStore } from '@store/panelStore'

beforeEach(() => {
  usePanelStore.setState({ leftWidth: 240, rightWidth: 240 })
})

function pointerDown(clientX: number): React.PointerEvent {
  return {
    clientX,
    preventDefault: () => {},
  } as unknown as React.PointerEvent
}

describe('usePanelResize', () => {
  it('left side widens when the pointer moves right', () => {
    const { result } = renderHook(() => usePanelResize('left'))
    act(() => result.current.onPointerDown(pointerDown(100)))
    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 150 } as PointerEventInit),
      )
    })
    expect(usePanelStore.getState().leftWidth).toBe(290) // 240 + 50
    act(() => document.dispatchEvent(new PointerEvent('pointerup')))
  })

  it('right side inverts the delta sign', () => {
    const { result } = renderHook(() => usePanelResize('right'))
    act(() => result.current.onPointerDown(pointerDown(500)))
    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 450 } as PointerEventInit),
      )
    })
    // right panel: pointer moved -50px → width increases by 50.
    expect(usePanelStore.getState().rightWidth).toBe(290)
    act(() => document.dispatchEvent(new PointerEvent('pointerup')))
  })

  it('clamps to the min width on a large drag inward', () => {
    const { result } = renderHook(() => usePanelResize('left'))
    act(() => result.current.onPointerDown(pointerDown(100)))
    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointermove', { clientX: -1000 } as PointerEventInit),
      )
    })
    expect(usePanelStore.getState().leftWidth).toBe(180) // PANEL_MIN_WIDTH
    act(() => document.dispatchEvent(new PointerEvent('pointerup')))
  })

  it('clears body cursor on pointerup', () => {
    const { result } = renderHook(() => usePanelResize('left'))
    act(() => result.current.onPointerDown(pointerDown(0)))
    expect(document.body.style.cursor).toBe('col-resize')
    act(() => document.dispatchEvent(new PointerEvent('pointerup')))
    expect(document.body.style.cursor).toBe('')
  })
})

/**
 * Pointer movement is physical; panel sides are logical. Under `dir="rtl"` the
 * "left" panel renders on the right of the viewport, so dragging its handle
 * away from the content is a *decreasing* clientX — the same gesture grew the
 * panel in LTR and shrank it in RTL.
 */
describe('usePanelResize — direction awareness', () => {
  afterEach(() => document.documentElement.removeAttribute('dir'))

  it('widens the left panel when dragged outward in RTL', () => {
    document.documentElement.setAttribute('dir', 'rtl')
    const { result } = renderHook(() => usePanelResize('left'))
    act(() => result.current.onPointerDown(pointerDown(100)))
    act(() => {
      // Outward in RTL is toward the right edge, i.e. decreasing clientX.
      document.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 50 } as PointerEventInit),
      )
    })
    expect(usePanelStore.getState().leftWidth).toBe(290)
    act(() => document.dispatchEvent(new PointerEvent('pointerup')))
  })

  it('leaves LTR behaviour exactly as it was', () => {
    const { result } = renderHook(() => usePanelResize('left'))
    act(() => result.current.onPointerDown(pointerDown(100)))
    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 150 } as PointerEventInit),
      )
    })
    expect(usePanelStore.getState().leftWidth).toBe(290)
    act(() => document.dispatchEvent(new PointerEvent('pointerup')))
  })
})
