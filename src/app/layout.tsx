import type { Metadata, Viewport } from 'next'
// Mono is self-hosted rather than handled by `next/font` so its preload can be
// decided per page — see `ensureMonoFont` for the measurements behind that.
import { ensureMonoFont } from '@lib/fonts/monoFont'
import { emitHostRedirects } from '@adapters/static/HostRedirectsEmitter'
import { META_COLOR_SCHEME } from '@lib/theme'
import './globals.css'
import '../../content/theme.css'

export const metadata: Metadata = {
  title: { template: '%s | Onvu', default: 'Onvu' },
  description: 'Personal portfolio and digital garden.',
}

/**
 * The plain responsive viewport, with zoom left alone.
 *
 * This did pin the scale (`maximum-scale=1, user-scalable=no`), on the
 * reasoning that the garden is an app shell and pinching knocks its panels
 * out of alignment. That trade isn't worth making: magnification is how
 * someone with low vision reads the page at all, and taking it away to tidy
 * up a layout puts a cosmetic concern above their ability to read.
 *
 * It was also only half-working. Safari has ignored `user-scalable=no` and
 * clamped `maximum-scale` since iOS 10, so the restriction only ever bound
 * Android and desktop — inconsistent as well as harmful.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Colours the canvas the browser paints before the stylesheet loads.
  // See META_COLOR_SCHEME for why a meta tag and not the bootstrap script.
  colorScheme: META_COLOR_SCHEME,
}

/**
 * A passthrough, deliberately.
 *
 * `<html>` lives in `@components/shell/Document`, rendered by
 * `[locale]/layout.tsx` and by the two routes that sit outside the locale
 * segment. It has to: this layout is above `[locale]` and cannot know which
 * language it is wrapping, so the `lang` attribute it used to hardcode was
 * `"en"` on every German and Ukrainian page on the site.
 *
 * What stays here is what genuinely is global — the metadata defaults, the
 * viewport, the stylesheets, and the font emit below.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Emits public/fonts/geist-mono.woff2 before the export step copies
  // `public/`. Awaited here, in the one layout every route renders through,
  // so no page can reference the file before it exists.
  await ensureMonoFont()
  // `public/_redirects`, so the static export answers at `/` rather than
  // serving its 404 page there. Same reason it lives here: this layout is the
  // only one guaranteed to run, and the site root is not any locale's concern.
  // Static builds only — a server build has `src/proxy.ts` for this.
  if (
    process.env.NEXT_PUBLIC_ONVU_MODE === 'static' &&
    process.env.NODE_ENV === 'production'
  ) {
    await emitHostRedirects()
  }
  return children
}
