import fs from 'node:fs/promises'
import { publicPath } from '@lib/publicPath'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
// sharp 0.35 stopped shipping its types as a namespace beside the default
// export, so `sharp.Metadata` no longer resolves — they are named exports now.
import type { Metadata } from 'sharp'

/**
 * Shared responsive WebP encoder. Both `processNoteImage` (relative refs
 * inside a note's markdown body and frontmatter) and `processStaticImage`
 * (absolute site paths used for portfolio chrome and frontmatter
 * coverImage) funnel into this single function so:
 *
 *   - The output directory is one place (`public/notes-assets/`) — a note
 *     attachment and a portfolio asset that happen to share the same
 *     underlying bytes hash to the same filename and never duplicate on
 *     disk.
 *   - The in-process cache is one Map — encoding only runs the first time
 *     the source file is touched in a build. Subsequent calls from any
 *     entry point reuse the result.
 *   - GIF passthrough, srcset widths, quality, and content-hash naming
 *     rules live in one place and can't drift.
 */

const ASSETS_DIR_NAME = 'notes-assets'
// Written straight into `<img src>` by the rehype pipeline, so Next never
// sees it and never prefixes it — the one class of asset URL that breaks
// under a subpath deployment.
const URL_PREFIX = publicPath(`/${ASSETS_DIR_NAME}`)

function assetsRoot(): string {
  return path.join(process.cwd(), 'public', ASSETS_DIR_NAME)
}

/**
 * Widths we generate for the srcset.
 *
 * The old ladder — 480/800/1280/1920 — was coarse enough that the rung above
 * a slot's real need was routinely 1.5–3× too big. A carousel thumbnail needs
 * ~495px on a DPR-3 phone and got 800; a body image needs ~1038px and got
 * 1280. Rungs here are spaced ~1.25–1.35× apart across the range real slots
 * land in (phone bodies at 560–1050 CSS px, carousel thumbs at 330–880,
 * desktop bodies at 720–1440), which bounds the worst-case overshoot to about
 * a third instead of triple.
 *
 * The extra rungs cost build time and disk — both cheap and paid once — plus
 * a longer `srcset` string per image. That last one is the only runtime cost,
 * and it lands in the render-blocking document, but the URLs share a long
 * common prefix so Brotli reduces the additional entries to very little.
 */
const RESPONSIVE_WIDTHS = [
  256, 384, 512, 640, 768, 896, 1024, 1280, 1536, 1920, 2560,
]
/**
 * Ceiling for the generated ladder.
 *
 * Sources here run to 5257px, and the old code always appended the full
 * source width, so the build emitted (and `src` pointed at) single files of
 * 3.2 MB. Worse, that rung sat in `srcset`: a DPR-3 desktop asking for a
 * 720px slot needs ~2160px and would have jumped to the 4284px monster.
 *
 * 2560 covers a full-bleed prose column on any display worth targeting. The
 * visible trade-off is the lightbox, which opens the `src` — the largest
 * rung — so full-screen viewing on a 4K panel now shows 2560px scaled up
 * rather than native. For photographs at that size it isn't a perceptible
 * loss, and it avoids putting multi-megabyte files one click away.
 */
const MAX_LADDER_WIDTH = 2560
/** WebP quality — visually indistinguishable from JPEG at q ≈ 80. */
const QUALITY = 78
/**
 * Animated frames multiply every byte by the frame count, so animation is
 * encoded well below the still quality. Measured on the two reaction GIFs
 * this site actually ships (53 and 102 frames): q=60 lands ~70% and ~61%
 * under the source GIF, and at the size these render — 220px and 26px — the
 * drop from q=78 is not visible. q=78 would only reach 52% / 51%.
 */
const ANIMATED_QUALITY = 60
/**
 * libwebp search effort. Default is 4; 6 buys ~5% on stills for ~1.6× the
 * encode time, and ~21% on animation (168 KB → 133 KB on the 53-frame GIF)
 * for a much steeper ~40× — several seconds per animated source.
 *
 * That trade is worth taking here because it is paid once per unique file at
 * build time, never by a reader: variants are content-hashed, so the same GIF
 * duplicated across the en/de/uk trees encodes a single time, and unchanged
 * sources are skipped entirely on rebuild. If a large animated source ever
 * makes builds painful, this is the first dial to turn back down.
 */
const ENCODE_EFFORT = 6

export interface ResponsiveImage {
  /** Default `src` — the largest variant. */
  src: string
  /** Comma-separated `<width>w` entries, or `''` for GIFs / single-frame
   *  outputs where there's no responsive ladder. */
  srcset: string
  width: number
  height: number
}

/** Cache key: `<absPath>::<mtimeMs>`. mtime invalidates on edit. */
const cache = new Map<string, ResponsiveImage>()

/**
 * Test helper — clear the in-process cache so tests with different fixture
 * sets don't see each other's results. Production code never calls this.
 */
export function __clearEncodeResponsiveCache(): void {
  cache.clear()
}

/**
 * Encode an image at `sourcePath` into responsive WebP variants under
 * `/public/notes-assets/`, returning the largest variant's URL plus a
 * full srcset. Returns `null` when the file can't be read, has no
 * intrinsic dimensions (SVGs and other vector / unsupported formats),
 * or fails to decode. GIFs short-circuit the WebP pipeline and are
 * copied verbatim so animation survives.
 */
export async function encodeResponsive(
  sourcePath: string,
): Promise<ResponsiveImage | null> {
  let stat
  try {
    stat = await fs.stat(sourcePath)
  } catch {
    return null
  }
  const cacheKey = `${sourcePath}::${stat.mtimeMs}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const buffer = await fs.readFile(sourcePath)
  const ext = path.extname(sourcePath).toLowerCase()
  // Only GIF and WebP carry animation. Reading them with `animated: true` is
  // what makes `pages` reflect the real frame count — without it sharp
  // reports a single page and silently discards every frame but the first.
  const mayAnimate = ext === '.gif' || ext === '.webp'
  let meta: Metadata
  try {
    meta = await sharp(buffer, mayAnimate ? { animated: true } : {}).metadata()
  } catch {
    return null
  }
  if (!meta.width || !meta.height) return null

  const animated = (meta.pages ?? 1) > 1
  // For an animated source `height` is the whole filmstrip (frames stacked
  // vertically); `pageHeight` is one frame. Using `height` here would emit a
  // 53×-too-tall intrinsic size and wreck the reserved aspect ratio.
  const sourceHeight = animated ? (meta.pageHeight ?? meta.height) : meta.height
  if (!sourceHeight) return null

  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10)
  const base = path.basename(sourcePath, path.extname(sourcePath))
  const slug = `${base}-${hash}`

  const root = assetsRoot()
  await fs.mkdir(root, { recursive: true })

  // Animation is a flag on the normal path rather than a branch around it, so
  // the ladder, hashing and caching stay single-sourced. GIFs used to be
  // copied verbatim on the assumption they were "typically tiny" — the two on
  // this site were 440 KB and 67 KB, together 38% of the heaviest note's
  // weight. Animated WebP is supported everywhere that matters (Safari 14+).
  const quality = animated ? ANIMATED_QUALITY : QUALITY

  // Generate widths ≤ source width. Always include the source width so
  // we don't upscale; smaller widths get dropped from the ladder when
  // the source is narrower than them.
  const sourceWidth = meta.width
  const cap = Math.min(sourceWidth, MAX_LADDER_WIDTH)
  const targetWidths = Array.from(
    new Set(RESPONSIVE_WIDTHS.filter((w) => w < cap).concat(cap)),
  ).sort((a, b) => a - b)

  const variants: Array<{ width: number; url: string }> = []
  for (const w of targetWidths) {
    const outName = `${slug}-${w}.webp`
    const outPath = path.join(root, outName)
    try {
      await fs.access(outPath)
    } catch {
      const out = await sharp(buffer, animated ? { animated: true } : {})
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality, effort: ENCODE_EFFORT })
        .toBuffer()
      await fs.writeFile(outPath, out)
    }
    variants.push({ width: w, url: `${URL_PREFIX}/${outName}` })
  }

  const largest = variants[variants.length - 1]
  const srcset = variants.map((v) => `${v.url} ${v.width}w`).join(', ')
  const aspect = sourceHeight / sourceWidth
  const renderedHeight = Math.round(largest.width * aspect)

  const result: ResponsiveImage = {
    src: largest.url,
    srcset,
    width: largest.width,
    height: renderedHeight,
  }
  cache.set(cacheKey, result)
  return result
}
