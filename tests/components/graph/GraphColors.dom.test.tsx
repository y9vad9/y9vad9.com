import { describe, it, expect, beforeEach } from 'vitest'
import { readGraphColors } from '@components/graph/ForceGraph'

/**
 * Canvas cannot read CSS variables, so the graph resolves the palette out of
 * the DOM. Deriving that during render, keyed on the theme in the store, meant
 * reading `<html>` before `ThemeProvider`'s effect had written the class to it:
 * the store said `warm` while the element still said `theme-system`, and the
 * graph drew the default violet and grey on a warm page. It then stayed wrong,
 * because the store's value never changed again.
 */
function paint(css: string, cls: string) {
  document.getElementById('probe-style')?.remove()
  const style = document.createElement('style')
  style.id = 'probe-style'
  style.textContent = css
  document.head.appendChild(style)
  document.documentElement.className = cls
}

beforeEach(() => {
  document.documentElement.className = ''
  document.getElementById('probe-style')?.remove()
})

describe('readGraphColors', () => {
  it('reports whatever palette the element currently carries', () => {
    paint('.theme-warm{--primary:#f59e0b;--muted:#a8956a}', 'theme-warm')
    expect(readGraphColors().primary).toBe('#f59e0b')
    expect(readGraphColors().muted).toBe('#a8956a')
  })

  it('follows a class change without anything re-rendering', () => {
    // The property the fix rests on: the reader is a function of the DOM, not
    // of React state, so it cannot disagree with what is on screen.
    paint(
      '.theme-warm{--primary:#f59e0b}.theme-system{--primary:#a78bfa}',
      'theme-system',
    )
    expect(readGraphColors().primary).toBe('#a78bfa')
    document.documentElement.className = 'theme-warm'
    expect(readGraphColors().primary).toBe('#f59e0b')
  })

  it('falls back rather than drawing nothing when a variable is missing', () => {
    document.documentElement.className = 'theme-unstyled'
    const c = readGraphColors()
    expect(c.primary).toBe('#6366f1')
    expect(c.muted).toBe('#9ca3af')
  })

  it('resolves the label chip background through card then bg', () => {
    paint('.t{--bg:#2a221a}', 't')
    expect(readGraphColors().bg).toBe('#2a221a')
    paint('.t{--bg:#2a221a;--card:#3a2e24}', 't')
    expect(readGraphColors().bg).toBe('#3a2e24')
  })
})
