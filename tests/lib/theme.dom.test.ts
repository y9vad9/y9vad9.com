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

  it('stamps the polarity the stylesheet keys on', () => {
    // `globals.css` used to enumerate `.theme-dark, .theme-warm, .theme-forest`
    // for the two behaviours that depend on a palette being dark — Shiki token
    // colours and `?dark-invert` logos. That list is one a custom theme can
    // never join, so following `content/theme.css`'s own worked example (a dark
    // `.theme-ocean`) produced light syntax highlighting on a near-black
    // background. `ThemeOption.dark` always held the answer; it just never
    // reached CSS.
    applyTheme('dark')
    expect(document.documentElement.dataset.polarity).toBe('dark')

    applyTheme('light')
    expect(document.documentElement.dataset.polarity).toBe('light')
  })

  it('leaves `system` for the OS to resolve rather than picking a side', () => {
    applyTheme('system')
    // Not 'light' — the media query in globals.css decides, exactly as
    // `color-scheme: light dark` does for the canvas.
    expect(document.documentElement.dataset.polarity).toBe('system')
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
