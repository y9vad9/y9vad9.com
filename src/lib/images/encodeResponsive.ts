import fs from 'node:fs/promises'
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
const URL_PREFIX = `/${ASSETS_DIR_NAME}`

function assetsRoot(): string {
  return path.join(process.cwd(), 'public', ASSETS_DIR_NAME)
}

/** Widths we generate for the srcset. Sized for typical article bodies
 *  and the portfolio's largest renderable slot (the hero avatar). */
const RESPONSIVE_WIDTHS = [480, 800, 1280, 1920]
/** WebP quality — visually indistinguishable from JPEG at q ≈ 80. */
const QUALITY = 78

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
  let meta: Metadata
  try {
    meta = await sharp(buffer).metadata()
  } catch {
    return null
  }
  if (!meta.width || !meta.height) return null

  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10)
  const ext = path.extname(sourcePath).toLowerCase()
  const base = path.basename(sourcePath, path.extname(sourcePath))
  const slug = `${base}-${hash}`

  const root = assetsRoot()
  await fs.mkdir(root, { recursive: true })

  // GIFs: copy verbatim to keep animation. No srcset — GIF files are
  // typically tiny and have a single intrinsic resolution; the WebP
  // ladder would discard the animation anyway.
  if (ext === '.gif') {
    const outName = `${slug}.gif`
    const outPath = path.join(root, outName)
    try {
      await fs.access(outPath)
    } catch {
      await fs.writeFile(outPath, buffer)
    }
    const result: ResponsiveImage = {
      src: `${URL_PREFIX}/${outName}`,
      srcset: '',
      width: meta.width,
      height: meta.height,
    }
    cache.set(cacheKey, result)
    return result
  }

  // Generate widths ≤ source width. Always include the source width so
  // we don't upscale; smaller widths get dropped from the ladder when
  // the source is narrower than them.
  const sourceWidth = meta.width
  const targetWidths = Array.from(
    new Set(RESPONSIVE_WIDTHS.filter((w) => w < sourceWidth).concat(sourceWidth)),
  ).sort((a, b) => a - b)

  const variants: Array<{ width: number; url: string }> = []
  for (const w of targetWidths) {
    const outName = `${slug}-${w}.webp`
    const outPath = path.join(root, outName)
    try {
      await fs.access(outPath)
    } catch {
      const out = await sharp(buffer)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer()
      await fs.writeFile(outPath, out)
    }
    variants.push({ width: w, url: `${URL_PREFIX}/${outName}` })
  }

  const largest = variants[variants.length - 1]
  const srcset = variants.map((v) => `${v.url} ${v.width}w`).join(', ')
  const aspect = meta.height / sourceWidth
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
