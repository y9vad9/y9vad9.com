import { describe, it, expect } from 'vitest'
import { needsMonoFont, MONO_FONT_URL } from '@lib/fonts/monoFont'

/**
 * `needsMonoFont` decides whether a note pays 70 KB for GeistMono. A false
 * negative silently degrades every code block on the page to the fallback
 * face; a false positive puts the cost back on notes that measured 300ms of
 * LCP without it. Both directions are worth pinning down.
 */
describe('needsMonoFont', () => {
  it('detects fenced code blocks', () => {
    expect(needsMonoFont('<pre><code>const x = 1</code></pre>')).toBe(true)
  })

  it('detects a <pre> carrying attributes', () => {
    // rehype-pretty-code emits `<pre data-language="ts" ...>`, never a bare tag.
    expect(needsMonoFont('<pre data-language="ts" tabindex="0">x</pre>')).toBe(true)
  })

  it('detects inline code', () => {
    // `.prose code:not(pre code)` is a mono selector too, so a note with only
    // inline code still renders the face.
    expect(needsMonoFont('<p>Call <code>foo()</code> first.</p>')).toBe(true)
  })

  it('detects the pre-render mermaid placeholder', () => {
    expect(needsMonoFont('<div class="mermaid">graph TD;</div>')).toBe(true)
  })

  it('is false for prose with no monospaced content', () => {
    const html =
      '<h2>Dresden</h2><p>A <a href="/x">link</a> and ' +
      '<img src="/notes-assets/a-800.webp" alt="a"> and <em>emphasis</em>.</p>'
    expect(needsMonoFont(html)).toBe(false)
  })

  it('does not fire on tags that merely start with the tag names', () => {
    // The reason the pattern requires `[\s>]` after the tag name. A substring
    // match on `<pre` / `<code` would call both of these true — this is the
    // case that distinguishes the two, so it has to use real tags rather than
    // prose that happens to contain the words.
    expect(needsMonoFont('<precise>x</precise>')).toBe(false)
    expect(needsMonoFont('<codex>x</codex>')).toBe(false)
  })

  it('does not fire on a class that merely contains "mermaid"', () => {
    expect(needsMonoFont('<div class="not-mermaidish">x</div>')).toBe(false)
  })

  it('points at a stable path the note page can preload', () => {
    // The whole reason mono left `next/font` is that its URL was unknowable.
    expect(MONO_FONT_URL).toBe('/fonts/geist-mono.woff2')
  })
})
