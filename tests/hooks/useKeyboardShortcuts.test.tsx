import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKeyboardShortcuts } from '@hooks/useKeyboardShortcuts'
import { usePanelStore } from '@store/panelStore'
import { useTabStore } from '@store/tabStore'

beforeEach(() => {
  usePanelStore.setState({
    leftOpen: true,
    rightOpen: true,
    explorerMode: 'files',
    toolsMode: 'toc',
    explorerFocusNonce: 0,
    toolsFocusNonce: 0,
    leftWidth: 240,
    rightWidth: 240,
  })
  useTabStore.setState({ tabs: [], activeSlug: null })
})

function press(opts: Partial<KeyboardEventInit> & { key?: string; code?: string }) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...opts,
  })
  document.dispatchEvent(event)
}

describe('useKeyboardShortcuts', () => {
  describe('disabled via site config', () => {
    it('binds nothing when disabled', () => {
      // `shortcuts.enabled: false` exists for readers whose assistive tech
      // sends bare letters to the document — those must reach the page
      // untouched, not merely be ignored after preventDefault.
      renderHook(() => useKeyboardShortcuts(false))
      act(() => press({ key: '[', ctrlKey: true }))
      expect(usePanelStore.getState().leftOpen).toBe(true)
      act(() => press({ key: 'g', code: 'KeyG' }))
      expect(usePanelStore.getState().toolsMode).toBe('toc')
    })

    it('does not consume the event when disabled', () => {
      renderHook(() => useKeyboardShortcuts(false))
      const event = new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', bubbles: true, cancelable: true })
      act(() => { document.dispatchEvent(event) })
      expect(event.defaultPrevented).toBe(false)
    })

    it('binds again when re-enabled', () => {
      const { rerender } = renderHook(({ on }) => useKeyboardShortcuts(on), {
        initialProps: { on: false },
      })
      act(() => press({ key: '[', ctrlKey: true }))
      expect(usePanelStore.getState().leftOpen).toBe(true)
      rerender({ on: true })
      act(() => press({ key: '[', ctrlKey: true }))
      expect(usePanelStore.getState().leftOpen).toBe(false)
    })
  })

  it('toggles the left panel on Ctrl/Cmd+[', () => {
    renderHook(() => useKeyboardShortcuts())
    act(() => press({ key: '[', ctrlKey: true }))
    expect(usePanelStore.getState().leftOpen).toBe(false)
  })

  it('toggles the right panel on Ctrl/Cmd+]', () => {
    renderHook(() => useKeyboardShortcuts())
    act(() => press({ key: ']', ctrlKey: true }))
    expect(usePanelStore.getState().rightOpen).toBe(false)
  })

  it('closes the active tab on Ctrl/Cmd+\\', () => {
    useTabStore.setState({
      tabs: [
        { slug: 'a', title: 'A', scrollY: 0, kind: 'note' },
        { slug: 'b', title: 'B', scrollY: 0, kind: 'note' },
      ],
      activeSlug: 'b',
    })
    renderHook(() => useKeyboardShortcuts())
    act(() => press({ key: '\\', ctrlKey: true }))
    expect(useTabStore.getState().tabs.map((t) => t.slug)).toEqual(['a'])
  })

  it('jumps to tab N on Alt+N', () => {
    useTabStore.setState({
      tabs: [
        { slug: 'a', title: 'A', scrollY: 0, kind: 'note' },
        { slug: 'b', title: 'B', scrollY: 0, kind: 'note' },
      ],
      activeSlug: 'a',
    })
    renderHook(() => useKeyboardShortcuts())
    act(() => press({ key: '2', altKey: true }))
    expect(useTabStore.getState().activeSlug).toBe('b')
  })

  it('letter shortcuts open the relevant panel mode', () => {
    renderHook(() => useKeyboardShortcuts())
    act(() => press({ code: 'KeyF' }))
    expect(usePanelStore.getState().explorerMode).toBe('search')
    act(() => press({ code: 'KeyL' }))
    expect(usePanelStore.getState().toolsMode).toBe('links')
  })

  it('letter shortcuts do nothing while typing in an input', () => {
    document.body.innerHTML = '<input id="i">'
    const input = document.getElementById('i') as HTMLInputElement
    input.focus()
    renderHook(() => useKeyboardShortcuts())
    const before = usePanelStore.getState().explorerMode
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true }),
      )
    })
    expect(usePanelStore.getState().explorerMode).toBe(before)
  })
})
