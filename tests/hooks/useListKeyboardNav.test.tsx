import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useListKeyboardNav } from '@hooks/useListKeyboardNav'

function key(name: string): React.KeyboardEvent<HTMLDivElement> {
  return {
    key: name,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLDivElement>
}

describe('useListKeyboardNav', () => {
  it('starts at initialIdx', () => {
    const { result } = renderHook(() =>
      useListKeyboardNav({ count: 5, onSelect: () => {}, initialIdx: 2 }),
    )
    expect(result.current.idx).toBe(2)
  })

  it('arrow keys move and wrap by default', () => {
    const { result } = renderHook(() =>
      useListKeyboardNav({ count: 3, onSelect: () => {} }),
    )
    act(() => result.current.onKeyDown(key('ArrowDown')))
    expect(result.current.idx).toBe(1)
    act(() => result.current.onKeyDown(key('ArrowDown')))
    act(() => result.current.onKeyDown(key('ArrowDown')))
    expect(result.current.idx).toBe(0) // wrapped
    act(() => result.current.onKeyDown(key('ArrowUp')))
    expect(result.current.idx).toBe(2) // wrapped backwards
  })

  it('respects wrap=false at the edges', () => {
    const { result } = renderHook(() =>
      useListKeyboardNav({ count: 3, onSelect: () => {}, wrap: false }),
    )
    act(() => result.current.onKeyDown(key('ArrowUp')))
    expect(result.current.idx).toBe(0)
    act(() => {
      result.current.onKeyDown(key('ArrowDown'))
      result.current.onKeyDown(key('ArrowDown'))
      result.current.onKeyDown(key('ArrowDown'))
    })
    expect(result.current.idx).toBe(2)
  })

  it('Home / End jump to ends', () => {
    const { result } = renderHook(() =>
      useListKeyboardNav({ count: 10, onSelect: () => {}, initialIdx: 4 }),
    )
    act(() => result.current.onKeyDown(key('End')))
    expect(result.current.idx).toBe(9)
    act(() => result.current.onKeyDown(key('Home')))
    expect(result.current.idx).toBe(0)
  })

  it('Enter calls onSelect with the current idx', () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useListKeyboardNav({ count: 4, onSelect, initialIdx: 2 }),
    )
    act(() => result.current.onKeyDown(key('Enter')))
    expect(onSelect).toHaveBeenCalledWith(2, expect.anything())
  })

  it('clamps idx when count shrinks below it', () => {
    const { result, rerender } = renderHook(
      ({ count }) =>
        useListKeyboardNav({ count, onSelect: () => {}, initialIdx: 3 }),
      { initialProps: { count: 5 } },
    )
    expect(result.current.idx).toBe(3)
    rerender({ count: 2 })
    expect(result.current.idx).toBe(1)
  })

  it('no-ops keydown handlers when count is 0', () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useListKeyboardNav({ count: 0, onSelect }),
    )
    act(() => result.current.onKeyDown(key('Enter')))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('highlight is live from the start by default', () => {
    const { result } = renderHook(() =>
      useListKeyboardNav({ count: 3, onSelect: () => {} }),
    )
    expect(result.current.kbdActive).toBe(true)
    // Default consumers must keep moving on the very first press.
    act(() => result.current.onKeyDown(key('ArrowDown')))
    expect(result.current.idx).toBe(1)
  })

  describe('revealOnKeyboard', () => {
    const opts = { count: 3, onSelect: () => {}, revealOnKeyboard: true }

    it('hides the highlight until a key is pressed', () => {
      const { result } = renderHook(() => useListKeyboardNav(opts))
      expect(result.current.kbdActive).toBe(false)
    })

    it('first arrow reveals the cursor without moving it', () => {
      const { result } = renderHook(() => useListKeyboardNav(opts))
      act(() => result.current.onKeyDown(key('ArrowDown')))
      expect(result.current.kbdActive).toBe(true)
      expect(result.current.idx).toBe(0) // revealed in place, row 0 not skipped
      act(() => result.current.onKeyDown(key('ArrowDown')))
      expect(result.current.idx).toBe(1) // subsequent presses move
    })

    it('Enter selects immediately without needing a reveal press', () => {
      const onSelect = vi.fn()
      const { result } = renderHook(() =>
        useListKeyboardNav({ ...opts, onSelect }),
      )
      act(() => result.current.onKeyDown(key('Enter')))
      expect(onSelect).toHaveBeenCalledWith(0, expect.anything())
    })

    it('pointTo moves the cursor and retires the highlight', () => {
      const { result } = renderHook(() => useListKeyboardNav(opts))
      act(() => result.current.onKeyDown(key('ArrowDown')))
      expect(result.current.kbdActive).toBe(true)
      act(() => result.current.pointTo(2))
      expect(result.current.idx).toBe(2)
      expect(result.current.kbdActive).toBe(false)
    })

    it('hideHighlight retires the highlight without moving the cursor', () => {
      const { result } = renderHook(() => useListKeyboardNav(opts))
      act(() => result.current.onKeyDown(key('ArrowDown')))
      act(() => result.current.onKeyDown(key('ArrowDown')))
      expect(result.current.idx).toBe(1)
      act(() => result.current.hideHighlight())
      expect(result.current.kbdActive).toBe(false)
      expect(result.current.idx).toBe(1)
    })

    it('pointTo does not retire the highlight when not opted in', () => {
      const { result } = renderHook(() =>
        useListKeyboardNav({ count: 3, onSelect: () => {} }),
      )
      act(() => result.current.pointTo(2))
      expect(result.current.idx).toBe(2)
      expect(result.current.kbdActive).toBe(true)
    })
  })
})
