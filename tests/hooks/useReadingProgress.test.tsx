import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReadingProgress } from '@hooks/useReadingProgress'

beforeEach(() => {
  document.body.innerHTML = '<div id="reading-progress" style="width:0%"></div>'
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: 2000,
    configurable: true,
  })
  Object.defineProperty(window, 'innerHeight', {
    value: 1000,
    configurable: true,
  })
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useReadingProgress', () => {
  it('initialises the bar to 0% width', () => {
    renderHook(() => useReadingProgress())
    expect((document.getElementById('reading-progress') as HTMLElement).style.transform).toBe('scaleX(0)')
  })

  it('updates the bar scale on scroll', () => {
    renderHook(() => useReadingProgress())
    act(() => {
      ;(window as unknown as { scrollY: number }).scrollY = 500
      window.dispatchEvent(new Event('scroll'))
    })
    // 500 / (2000 - 1000) = 0.5
    expect((document.getElementById('reading-progress') as HTMLElement).style.transform).toBe('scaleX(0.5)')
  })

  it('caps at full scale when scrolled past the bottom', () => {
    renderHook(() => useReadingProgress())
    act(() => {
      ;(window as unknown as { scrollY: number }).scrollY = 9000
      window.dispatchEvent(new Event('scroll'))
    })
    expect((document.getElementById('reading-progress') as HTMLElement).style.transform).toBe('scaleX(1)')
  })

  it('stays at zero scale when there is no scrollable content (docHeight = 0)', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 800,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      value: 1000,
      configurable: true,
    })
    renderHook(() => useReadingProgress())
    expect((document.getElementById('reading-progress') as HTMLElement).style.transform).toBe('scaleX(0)')
  })

  it('is a no-op when #reading-progress is absent', () => {
    document.body.innerHTML = ''
    expect(() => {
      renderHook(() => useReadingProgress())
      window.dispatchEvent(new Event('scroll'))
    }).not.toThrow()
  })
})
