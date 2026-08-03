import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Document } from '@components/shell/Document'

// `next/font` is a build-time transform; the real `geist` package resolves a
// directory import node cannot follow. Only the class name matters here.
vi.mock('geist/font/sans', () => ({ GeistSans: { variable: 'geist-sans' } }))

/**
 * `<html lang>` was hardcoded to `en` in the root layout, which sits above the
 * `[locale]` segment and so cannot know the language. Every `/de` and `/uk`
 * page declared English to screen readers and search engines — on a template
 * whose headline feature is being multi-locale.
 */
describe('Document', () => {
  it('declares the locale it was handed', () => {
    const html = renderToStaticMarkup(
      <Document locale="uk">
        <p>x</p>
      </Document>,
    )
    expect(html).toContain('lang="uk"')
    expect(html).not.toContain('lang="en"')
  })

  it('carries a direction derived from the locale', () => {
    // The attribute RTL support is gated on. Nothing in the codebase had one.
    const rtl = renderToStaticMarkup(
      <Document locale="ar">
        <p>x</p>
      </Document>,
    )
    const ltr = renderToStaticMarkup(
      <Document locale="de">
        <p>x</p>
      </Document>,
    )
    expect(rtl).toContain('dir="rtl"')
    expect(ltr).toContain('dir="ltr"')
  })

  it('ships the theme bootstrap on every document, not just localised ones', () => {
    // The root 404 and the unprefixed redirect render this directly. If the
    // bootstrap only lived in the locale layout, those pages would flash the
    // wrong theme — and nobody checks a 404 for that.
    const html = renderToStaticMarkup(
      <Document locale="en">
        <p>x</p>
      </Document>,
    )
    expect(html).toContain('data-polarity')
    expect(html).toContain('trustedTypes')
  })
})
