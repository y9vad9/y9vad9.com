import { ImageResponse } from 'next/og'
import { ogFonts } from '@lib/seo/ogFont'
import { config as siteConfig } from '~/site.config'

/**
 * The site favicon, generated from `site.config.ts` the same way the Open
 * Graph image is.
 *
 * A template cannot ship a meaningful icon — onvu's mark would end up in the
 * tab of every fork — but shipping none is worse than it looks: with no
 * `<link rel="icon">` in the document, browsers fall back to probing
 * `/favicon.ico`, which a static export does not have. That 404 is a real
 * request on every cold visit and shows up as a console error.
 *
 * Deriving a monogram from the owner's handle means every fork gets its own
 * icon with no work. Replace this file with a static `icon.png` / `icon.svg`
 * (same directory, same name) to use real artwork instead — the metadata
 * convention picks either up.
 *
 * One wrinkle if you deploy `ONVU_MODE=static`: Next writes this route to
 * `out/icon` with **no file extension**, and a static host types files by
 * extension — so it is served as `application/octet-stream` rather than
 * `image/png`. Browsers generally sniff a favicon and render it anyway, but
 * the header is wrong and audits notice. Declare it in whatever your host
 * uses; for Netlify / Cloudflare Pages `_headers` that is:
 *
 *     /icon
 *       Content-Type: image/png
 *
 * Server mode is unaffected — Next sets the header itself there. A static
 * `icon.svg` or `icon.png` also sidesteps it, since the name carries the
 * extension the host needs.
 */
export const dynamic = 'force-static'
export const runtime = 'nodejs'
export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default async function Icon() {
  const initial = (siteConfig.owner.handle || siteConfig.owner.name || '?')
    .trim()
    .charAt(0)
    .toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0e0e10',
          color: '#f5f5f5',
          fontSize: 40,
          fontWeight: 700,
          fontFamily: 'sans-serif',
          borderRadius: 12,
        }}
      >
        {initial}
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  )
}
