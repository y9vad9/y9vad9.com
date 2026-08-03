import fs from 'node:fs/promises'
import path from 'node:path'
import { config as siteConfig } from '~/site.config'

/**
 * Font data for the generated Open Graph cards and favicon.
 *
 * `next/og` ships a Latin-subset Noto Sans and nothing else, so a Japanese,
 * Chinese, Korean, Arabic or Hebrew title renders as a row of tofu boxes on
 * every social card the site produces — silently, since the image builds fine.
 *
 * This is a config hook rather than a derivation on purpose. Covering CJK
 * means shipping something like Noto Sans CJK, which is tens of megabytes; no
 * template should put that in every fork's repository to serve the sites that
 * do not need it. Downloading one at build time would be worse still — it is
 * exactly the non-hermetic build that `links.fetchExternalTitles` was turned
 * off for. So a site that needs glyphs points at a font file it owns.
 *
 * Returns `undefined` when nothing is configured, which is the signal
 * `ImageResponse` wants for "use your default".
 */
export interface OgFont {
  name: string
  data: ArrayBuffer
  style: 'normal'
  weight: 400
}

let cache: Promise<OgFont[] | undefined> | null = null

export function ogFonts(): Promise<OgFont[] | undefined> {
  cache ??= (async () => {
    const configured = siteConfig.seo?.ogFont
    if (!configured) return undefined
    try {
      // Resolved against the project root and confined to it, since this reads
      // an arbitrary configured path off disk at build time.
      const root = process.cwd()
      const file = path.resolve(root, configured.path)
      if (!file.startsWith(root + path.sep)) return undefined
      const data = await fs.readFile(file)
      return [
        {
          name: configured.name ?? 'OgFont',
          data: data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
          ) as ArrayBuffer,
          style: 'normal' as const,
          weight: 400 as const,
        },
      ]
    } catch {
      // A missing font should not fail the build — the card still renders,
      // just in the default face.
      return undefined
    }
  })()
  return cache
}

/** Test seam: forget the memoised font. */
export function resetOgFonts(): void {
  cache = null
}
