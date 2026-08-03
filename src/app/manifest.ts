import type { MetadataRoute } from 'next'
import { config as siteConfig } from '~/site.config'
import { size as iconSize, contentType as iconType } from './icon'

export const dynamic = 'force-static'

/**
 * The web app manifest, generated from `site.config.ts`.
 *
 * `pwa` was a **required** config block that nothing read. Alongside it sat a
 * hand-written `public/manifest.webmanifest` duplicating the same three
 * strings — still saying "Alex Rivers" in the template — which was never
 * linked from any `<head>` and pointed at `/icon-192.png` and `/icon-512.png`,
 * neither of which exists. Four breakages in one feature: a dead config key,
 * a stale duplicate, no link, and 404 icons.
 *
 * Using Next's `app/manifest.ts` convention fixes all four at once: the file
 * is emitted at `/manifest.webmanifest`, `<link rel="manifest">` is injected
 * automatically, and the values come from the config an adopter already fills
 * in. It also stops being a `public/` file — which the `merge=ours` contract
 * does not cover, so every adopter's edit to it conflicted forever.
 */
export default function manifest(): MetadataRoute.Manifest {
  const { pwa } = siteConfig
  return {
    name: pwa.name,
    short_name: pwa.shortName,
    description: pwa.description,
    // `/` redirects to the primary locale rather than 404ing, so this stays
    // locale-agnostic — a manifest pinned to one locale would launch the
    // installed app in a language the reader may not have chosen.
    start_url: '/',
    display: 'standalone',
    icons: [
      {
        // The generated favicon route, which every fork gets for free.
        // Pointing at PNG files the template does not ship was the previous
        // arrangement.
        src: '/icon',
        sizes: `${iconSize.width}x${iconSize.height}`,
        type: iconType,
      },
    ],
    ...(pwa.themeColor ? { theme_color: pwa.themeColor } : {}),
    ...(pwa.backgroundColor ? { background_color: pwa.backgroundColor } : {}),
  }
}
