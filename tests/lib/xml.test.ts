import { describe, it, expect } from 'vitest'
import { escapeXml } from '@lib/xml'

/**
 * The RSS feed is assembled by string concatenation. Its channel `<title>` and
 * `<description>` interpolated `owner.name` and `owner.bio` raw, so one `&` in
 * a bio — "design & architecture" — produced a malformed document that every
 * reader drops without saying why. The feed had no test of any kind.
 */
describe('escapeXml', () => {
  it('escapes the character that actually breaks feeds', () => {
    expect(escapeXml('design & architecture')).toBe('design &amp; architecture')
  })

  it('escapes angle brackets in either direction', () => {
    expect(escapeXml('a <b> c')).toBe('a &lt;b&gt; c')
  })

  it('makes a CDATA terminator unrepresentable', () => {
    // The item elements used `<![CDATA[…]]>`, which a title containing `]]>`
    // closes early — the reason everything is escaped uniformly instead.
    expect(escapeXml(']]>')).not.toContain(']]>')
  })

  it('is safe inside an attribute', () => {
    // Cover-image URLs land in `media:content url="…"`, and this codebase's own
    // image convention puts a query string on them (`?dark-invert`).
    expect(escapeXml('/img/logo.webp?a=1&b=2')).toBe('/img/logo.webp?a=1&amp;b=2')
    expect(escapeXml('say "hi"')).toBe('say &quot;hi&quot;')
  })

  it('escapes the ampersand once, not twice', () => {
    // `&` must be replaced before the entities it introduces, or `<` becomes
    // `&amp;lt;` and the reader shows the markup as text.
    expect(escapeXml('&<')).toBe('&amp;&lt;')
  })

  it('leaves ordinary text alone', () => {
    expect(escapeXml('Вадим Ярощук — нотатки')).toBe('Вадим Ярощук — нотатки')
  })
})
