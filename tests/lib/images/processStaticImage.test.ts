import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'

let tmpRoot: string
let originalCwd: string

beforeEach(async () => {
  originalCwd = process.cwd()
  // realpath: macOS /var → /private/var symlink resolution. Without it,
  // path.join(notesRoot(), ...) and process.cwd() compute different
  // absolute strings and the path traversal guards reject the test
  // fixtures as "outside the content tree".
  tmpRoot = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'onvu-static-')),
  )
  await fs.mkdir(path.join(tmpRoot, 'public', 'images'), { recursive: true })
  await fs.mkdir(path.join(tmpRoot, 'public', 'notes-assets'), { recursive: true })
  await fs.mkdir(path.join(tmpRoot, 'content', 'notes', 'en', 'attachments'), {
    recursive: true,
  })
  process.chdir(tmpRoot)
  // encodeResponsive computes ASSETS_ROOT lazily via process.cwd(),
  // but the module-scope cache still survives across tests by default —
  // reset it so each scenario starts from a clean slate.
  vi.resetModules()
})

afterAll(() => {
  process.chdir(originalCwd)
})

async function makePng(target: string, w = 1000, h = 800): Promise<void> {
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 60, g: 100, b: 180, alpha: 1 },
    },
  })
    .png()
    .toFile(target)
}

describe('processStaticImage — bucket resolution', () => {
  it('optimises an image under /images/', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    await makePng(path.join(tmpRoot, 'public', 'images', 'hero.png'), 1200, 800)

    const result = await processStaticImage('/images/hero.png')
    expect(result).not.toBeNull()
    expect(result!.src).toMatch(/^\/notes-assets\/hero-[a-f0-9]{10}-\d+\.webp$/)
    expect(result!.srcset).toMatch(/512w/)
    expect(result!.width).toBe(1200)
    expect(result!.height).toBe(800)
  }, 15000)

  it('optimises a file already under /notes-assets/', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    await makePng(
      path.join(tmpRoot, 'public', 'notes-assets', 'preencoded.png'),
      640,
      480,
    )

    const result = await processStaticImage('/notes-assets/preencoded.png')
    expect(result).not.toBeNull()
    expect(result!.src).toMatch(/^\/notes-assets\/preencoded-[a-f0-9]{10}-\d+\.webp$/)
  }, 15000)

  it('optimises /notes/<locale>/attachments/<rest>', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    await makePng(
      path.join(tmpRoot, 'content', 'notes', 'en', 'attachments', 'cover.png'),
      800,
      450,
    )

    const result = await processStaticImage('/notes/en/attachments/cover.png')
    expect(result).not.toBeNull()
    expect(result!.src).toMatch(/^\/notes-assets\/cover-[a-f0-9]{10}-\d+\.webp$/)
  }, 15000)
})

describe('processStaticImage — guards', () => {
  it('returns null for external URLs', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    expect(await processStaticImage('https://cdn.example.com/x.png')).toBeNull()
    expect(await processStaticImage('//cdn.example.com/x.png')).toBeNull()
    expect(await processStaticImage('data:image/png;base64,iVBOR…')).toBeNull()
  })

  it('returns null for SVGs (vector — no responsive ladder)', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    await fs.writeFile(
      path.join(tmpRoot, 'public', 'images', 'logo.svg'),
      '<svg/>',
    )
    expect(await processStaticImage('/images/logo.svg')).toBeNull()
    expect(await processStaticImage('/images/logo.svg?dark-invert')).toBeNull()
  })

  it('returns null for missing files', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    expect(await processStaticImage('/images/missing.png')).toBeNull()
  })

  it('returns null for paths outside any known bucket', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    expect(await processStaticImage('/some/random/path.png')).toBeNull()
    expect(await processStaticImage('/etc/passwd.png')).toBeNull()
  })

  it('returns null for relative paths (use processNoteImage)', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    expect(await processStaticImage('./relative.png')).toBeNull()
    expect(await processStaticImage('bare.png')).toBeNull()
  })
})

describe('processStaticImage — markers', () => {
  it('preserves trailing ?dark-invert on the returned src', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    await makePng(path.join(tmpRoot, 'public', 'images', 'icon.png'), 256, 256)

    const result = await processStaticImage('/images/icon.png?dark-invert')
    expect(result).not.toBeNull()
    expect(result!.src.endsWith('?dark-invert')).toBe(true)
  }, 15000)

  it('preserves trailing #hash on the returned src', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    await makePng(path.join(tmpRoot, 'public', 'images', 'piece.png'), 320, 240)

    const result = await processStaticImage('/images/piece.png#frag')
    expect(result!.src.endsWith('#frag')).toBe(true)
  }, 15000)
})

describe('processStaticImage — cache + determinism', () => {
  it('emits identical filenames for identical contents (content-hash)', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    const { encodeResponsive } = await import('@lib/images/encodeResponsive')

    await makePng(path.join(tmpRoot, 'public', 'images', 'a.png'), 600, 400)
    // Same bytes, different name.
    const buf = await fs.readFile(path.join(tmpRoot, 'public', 'images', 'a.png'))
    await fs.writeFile(path.join(tmpRoot, 'public', 'images', 'b.png'), buf)

    const a = await processStaticImage('/images/a.png')
    const b = await processStaticImage('/images/b.png')
    const aHash = a!.src.match(/[a-f0-9]{10}/)![0]
    const bHash = b!.src.match(/[a-f0-9]{10}/)![0]
    expect(aHash).toBe(bHash)
    expect(typeof encodeResponsive).toBe('function')
  }, 20000)

  it('shares its cache with processNoteImage', async () => {
    // A file under content/notes/<locale>/attachments/ reachable from
    // BOTH entry points — via a relative path from the note's dir AND
    // via the absolute /notes/<locale>/attachments/ form. The encoded
    // output must be the same on both calls (cache hit).
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    const { processNoteImage } = await import('@lib/images/processNoteImage')

    const noteDir = path.join(tmpRoot, 'content', 'notes', 'en')
    await makePng(
      path.join(noteDir, 'attachments', 'shared.png'),
      800,
      600,
    )

    const viaRel = await processNoteImage('./attachments/shared.png', noteDir)
    const viaAbs = await processStaticImage('/notes/en/attachments/shared.png')

    expect(viaRel).not.toBeNull()
    expect(viaAbs).not.toBeNull()
    expect(viaRel!.src).toBe(viaAbs!.src)
    expect(viaRel!.srcset).toBe(viaAbs!.srcset)
  }, 20000)

  it('mtime invalidates the cache', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    const file = path.join(tmpRoot, 'public', 'images', 'mut.png')
    await makePng(file, 400, 300)
    const first = await processStaticImage('/images/mut.png')

    // Rewrite the file with different dimensions + bump mtime.
    await makePng(file, 500, 400)
    await fs.utimes(file, new Date(), new Date(Date.now() + 1000))

    const second = await processStaticImage('/images/mut.png')
    expect(second!.width).toBe(500)
    // Filenames are content-hashed, so different bytes → different hash.
    expect(second!.src).not.toBe(first!.src)
  }, 20000)
})

describe('processStaticImage — formats', () => {
  it('GIFs go through the WebP encoder like any other still', async () => {
    const { processStaticImage } = await import('@lib/images/processStaticImage')
    const gif = await sharp({
      create: { width: 32, height: 32, channels: 4, background: '#fff' },
    })
      .gif({ loop: 0 })
      .toBuffer()
    await fs.writeFile(path.join(tmpRoot, 'public', 'images', 'tiny.gif'), gif)

    const result = await processStaticImage('/images/tiny.gif')
    expect(result).not.toBeNull()
    // GIFs used to be copied byte-for-byte to protect animation. That spared
    // still GIFs the encoder for no reason, and let a 440 KB animated one
    // ship untouched; animation is now preserved by encoding to animated
    // WebP instead of by opting out of encoding.
    expect(result!.src).toMatch(/\.webp$/)
    expect(result!.width).toBe(32)
    expect(result!.height).toBe(32)
  }, 15000)
})
