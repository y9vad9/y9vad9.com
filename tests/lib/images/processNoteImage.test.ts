import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'

let tmpRoot: string
let originalCwd: string

beforeEach(async () => {
  originalCwd = process.cwd()
  // See processNoteVideo.test.ts for the realpath rationale.
  tmpRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'onvu-img-')))
  await fs.mkdir(path.join(tmpRoot, 'content', 'notes', 'en'), { recursive: true })
  process.chdir(tmpRoot)
  vi.resetModules()
})

afterAll(async () => {
  process.chdir(originalCwd)
})

const GIF_SIZE = 16
const FRAMES = 3

/**
 * Build a genuinely multi-frame GIF. sharp only emits animation when the
 * input is a raw filmstrip carrying an explicit `pageHeight` — a `create:`
 * buffer yields a single page, which is what made the previous fixture here
 * unable to distinguish animated output from still output at all.
 */
async function makeAnimatedGif(frames: number): Promise<Buffer> {
  const raw = Buffer.alloc(GIF_SIZE * GIF_SIZE * frames * 3)
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < GIF_SIZE * GIF_SIZE; i++) {
      const o = (f * GIF_SIZE * GIF_SIZE + i) * 3
      raw[o] = f * 80 // frames differ, so a flattened encode is detectable
      raw[o + 1] = 200
      raw[o + 2] = 40
    }
  }
  return sharp(raw, {
    raw: { width: GIF_SIZE, height: GIF_SIZE * frames, channels: 3, pageHeight: GIF_SIZE },
  })
    .gif({ loop: 0, delay: new Array(frames).fill(100) })
    .toBuffer()
}

async function makePng(target: string, width = 1000, height = 800): Promise<void> {
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 100, b: 0, alpha: 1 },
    },
  })
    .png()
    .toFile(target)
}

describe('processNoteImage', () => {
  it('returns null for external refs (http, data:, protocol-relative)', async () => {
    const { processNoteImage } = await import('@lib/images/processNoteImage')
    const noteDir = path.join(tmpRoot, 'content', 'notes', 'en')
    expect(await processNoteImage('https://example.com/a.png', noteDir)).toBeNull()
    expect(await processNoteImage('//cdn.example.com/a.png', noteDir)).toBeNull()
    expect(await processNoteImage('data:image/png;base64,xxx', noteDir)).toBeNull()
  })

  it('returns null for already-absolute site paths', async () => {
    const { processNoteImage } = await import('@lib/images/processNoteImage')
    const noteDir = path.join(tmpRoot, 'content', 'notes', 'en')
    expect(await processNoteImage('/img/a.png', noteDir)).toBeNull()
  })

  it('blocks path traversal outside content/', async () => {
    const { processNoteImage } = await import('@lib/images/processNoteImage')
    const noteDir = path.join(tmpRoot, 'content', 'notes', 'en')
    expect(await processNoteImage('../../../etc/hosts.png', noteDir)).toBeNull()
  })

  it('returns null when the file is missing', async () => {
    const { processNoteImage } = await import('@lib/images/processNoteImage')
    const noteDir = path.join(tmpRoot, 'content', 'notes', 'en')
    expect(await processNoteImage('./missing.png', noteDir)).toBeNull()
  })

  it('emits a webp with srcset and metadata for a local png', async () => {
    const { processNoteImage } = await import('@lib/images/processNoteImage')
    const noteDir = path.join(tmpRoot, 'content', 'notes', 'en')
    const srcPath = path.join(noteDir, 'diagram.png')
    await makePng(srcPath, 1280, 720)

    const result = await processNoteImage('./diagram.png', noteDir)
    expect(result).not.toBeNull()
    expect(result!.src).toMatch(/^\/notes-assets\/.+\.webp$/)
    expect(result!.srcset).toMatch(/512w/)
    expect(result!.width).toBe(1280)
    expect(result!.height).toBe(720)
  }, 15000)

  it('does not upscale — srcset only includes widths ≤ source width', async () => {
    const { processNoteImage } = await import('@lib/images/processNoteImage')
    const noteDir = path.join(tmpRoot, 'content', 'notes', 'en')
    const srcPath = path.join(noteDir, 'small.png')
    await makePng(srcPath, 600, 400)

    const result = await processNoteImage('./small.png', noteDir)
    // 600px source: rungs below it stay, anything above must not appear.
    expect(result!.srcset).toMatch(/512w/)
    expect(result!.srcset).toMatch(/600w/)
    expect(result!.srcset).not.toMatch(/640w/)
    expect(result!.srcset).not.toMatch(/1280w/)
  }, 15000)

  it('caps the ladder so oversized sources never emit multi-megabyte rungs', async () => {
    const { processNoteImage } = await import('@lib/images/processNoteImage')
    const noteDir = path.join(tmpRoot, 'content', 'notes', 'en')
    const srcPath = path.join(noteDir, 'huge.png')
    // Mirrors the real 5257px phone photos in this site's content.
    await makePng(srcPath, 5257, 2990)

    const result = await processNoteImage('./huge.png', noteDir)
    // The source width must NOT become a rung — that is what produced a
    // 3.2 MB variant sitting in srcset, reachable by a high-DPR desktop.
    expect(result!.srcset).not.toMatch(/5257w/)
    expect(result!.srcset).toMatch(/2560w/)
    expect(result!.width).toBe(2560)
    // Height follows the capped width, keeping the source aspect ratio.
    expect(result!.height).toBe(Math.round(2560 * (2990 / 5257)))
  }, 30000)

  it('re-encodes animated GIFs to animated WebP, preserving every frame', async () => {
    const { processNoteImage } = await import('@lib/images/processNoteImage')
    const noteDir = path.join(tmpRoot, 'content', 'notes', 'en')
    const srcPath = path.join(noteDir, 'react.gif')
    await fs.writeFile(srcPath, await makeAnimatedGif(FRAMES))

    const result = await processNoteImage('./react.gif', noteDir)
    expect(result).not.toBeNull()
    expect(result!.src).toMatch(/\.webp$/)

    // The whole point of the GIF passthrough was keeping animation alive, so
    // the replacement has to prove the frames survived the re-encode.
    const publicPath = path.join(tmpRoot, 'public', result!.src)
    const out = await sharp(await fs.readFile(publicPath), { animated: true }).metadata()
    expect(out.pages).toBe(FRAMES)
  }, 20000)

  it('reports the frame height for animated sources, not the filmstrip height', async () => {
    const { processNoteImage } = await import('@lib/images/processNoteImage')
    const noteDir = path.join(tmpRoot, 'content', 'notes', 'en')
    const srcPath = path.join(noteDir, 'loop.gif')
    await fs.writeFile(srcPath, await makeAnimatedGif(FRAMES))

    const result = await processNoteImage('./loop.gif', noteDir)
    // sharp reports an animated image's `height` as every frame stacked
    // vertically. Using it would emit an intrinsic height FRAMES× too tall
    // and reserve a wildly wrong aspect-ratio box on the page.
    expect(result!.height).toBe(GIF_SIZE)
    expect(result!.height).not.toBe(GIF_SIZE * FRAMES)
  }, 20000)

  it('re-encodes still GIFs too, rather than shipping them verbatim', async () => {
    const { processNoteImage } = await import('@lib/images/processNoteImage')
    const noteDir = path.join(tmpRoot, 'content', 'notes', 'en')
    const srcPath = path.join(noteDir, 'still.gif')
    await fs.writeFile(
      srcPath,
      await sharp({
        create: { width: 300, height: 200, channels: 4, background: '#3a7' },
      })
        .gif()
        .toBuffer(),
    )

    const result = await processNoteImage('./still.gif', noteDir)
    expect(result!.src).toMatch(/\.webp$/)
    expect(result!.width).toBe(300)
    expect(result!.height).toBe(200)
  }, 20000)
})
