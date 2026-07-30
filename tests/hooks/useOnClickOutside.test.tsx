import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useOnClickOutside } from '@hooks/useOnClickOutside'

afterEach(cleanup)

function Menu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useOnClickOutside<HTMLDivElement>(open, onClose)
  return (
    <div>
      <div ref={ref} data-testid="menu">
        <button data-testid="trigger">Toggle</button>
        {open && <button data-testid="item">English</button>}
      </div>
      <button data-testid="elsewhere">Elsewhere</button>
    </div>
  )
}

/** `pointerdown` is what the hook listens for; jsdom has no PointerEvent. */
function pointerDown(el: Element) {
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
}

describe('useOnClickOutside', () => {
  it('fires when the press lands outside the ref', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Menu open onClose={onClose} />)
    pointerDown(getByTestId('elsewhere'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays quiet for a press on the trigger, so it does not fight the toggle', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Menu open onClose={onClose} />)
    pointerDown(getByTestId('trigger'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stays quiet for a press on the menu contents', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Menu open onClose={onClose} />)
    pointerDown(getByTestId('item'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does nothing while inactive', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Menu open={false} onClose={onClose} />)
    pointerDown(getByTestId('elsewhere'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<Menu open onClose={() => onClose()} />)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('detaches its listeners on unmount', () => {
    const onClose = vi.fn()
    const { unmount } = render(<Menu open onClose={onClose} />)
    unmount()
    pointerDown(document.body)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls the latest handler, not the one captured on mount', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender, getByTestId } = render(<Menu open onClose={first} />)
    rerender(<Menu open onClose={second} />)
    pointerDown(getByTestId('elsewhere'))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
