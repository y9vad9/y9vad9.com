import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme } from '@lib/theme'

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.className = 'geist-sans geist-mono'
    document.documentElement.style.colorScheme = ''
  })

  it('adds the theme class and the matching colour scheme', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('swaps rather than accumulates when the theme changes', () => {
    applyTheme('dark')
    applyTheme('light')
    expect(document.documentElement.className.match(/\btheme-\S+/g)).toEqual(['theme-light'])
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('hands `system` back to the OS', () => {
    applyTheme('dark')
    applyTheme('system')
    expect(document.documentElement.style.colorScheme).toBe('light dark')
  })

  it('leaves unrelated classes alone', () => {
    applyTheme('forest')
    expect(document.documentElement.className).toContain('geist-sans')
    expect(document.documentElement.className).toContain('geist-mono')
  })
})
