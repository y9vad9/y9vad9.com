import fs from 'node:fs/promises'
import { publicPath } from '@lib/publicPath'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * Where co-located note media gets materialised. Sits alongside processed
 * images so it's served as a static asset under the same prefix.
 */
const ASSETS_ROOT = path.join(process.cwd(), 'public', 'notes-assets')
const URL_PREFIX = publicPath('/notes-assets')

export const VIDEO_EXTS = new Set([
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.ogg',
  '.ogv',
])

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
}

export interface ProcessedVideo {
  src: string
  mimeType: string
}

export function isVideoRef(ref: string): boolean {
  if (!ref) return false
  const noQuery = ref.split(/[?#]/)[0]
  const ext = path.extname(noQuery).toLowerCase()
  return VIDEO_EXTS.has(ext)
}

const cache = new Map<string, ProcessedVideo>()

/**
 * Materialise a co-located video referenced from a note into `/public`.
 * Returns the public URL + mime type. Returns `null` when the file is
 * absent (so the pipeline can leave the original `<img>` alone for the
 * author to fix).
 */
export async function processNoteVideo(
  ref: string,
  noteDir: string,
): Promise<ProcessedVideo | null> {
  const cleanRef = ref.split(/[?#]/)[0]
  const sourcePath = path.resolve(noteDir, cleanRef)
  const contentRoot = path.join(process.cwd(), 'content')
  if (!sourcePath.startsWith(contentRoot)) return null

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
  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10)
  const base = path.basename(sourcePath, ext)
  const outName = `${base}-${hash}${ext}`
  const outPath = path.join(ASSETS_ROOT, outName)

  await fs.mkdir(ASSETS_ROOT, { recursive: true })
  try {
    await fs.access(outPath)
  } catch {
    await fs.writeFile(outPath, buffer)
  }

  const result: ProcessedVideo = {
    src: `${URL_PREFIX}/${outName}`,
    mimeType: MIME_BY_EXT[ext] ?? 'video/mp4',
  }
  cache.set(cacheKey, result)
  return result
}
