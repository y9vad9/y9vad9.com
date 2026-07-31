import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'

let tmpRoot: string
let originalCwd: string

beforeEach(async () => {
  originalCwd = process.cwd()
  tmpRoot = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'onvu-cover-')),
  )
  await fs.mkdir(path.join(tmpRoot, 'public', 'images'), { recursive: true })
  await fs.mkdir(path.join(tmpRoot, 'public', 'notes-assets'), { recursive: true })
  await fs.mkdir(path.join(tmpRoot, 'content', 'notes', 'en', 'attachments'), {
    recursive: true,
  })
  process.chdir(tmpRoot)
  vi.resetModules()
})

afterAll(() => {
  process.chdir(originalCwd)
})

async function makePng(target: string, w = 800, h = 450): Promise<void> {
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 200, g: 80, b: 30, alpha: 1 },
    },
  })
    .png()
    .toFile(target)
}

async function writeNote(
  slug: string,
  frontmatter: string,
  body = 'Body',
): Promise<void> {
  await fs.writeFile(
    path.join(tmpRoot, 'content', 'notes', 'en', `${slug}.md`),
    `---\n${frontmatter}\n---\n\n${body}\n`,
    'utf-8',
  )
}

/**
 * Regression test for the absolute-coverImage gap in
 * FileSystemNoteRepository. Before the fix the repo only optimised
 * relative coverImage refs — absolute paths fell straight through and
 * were shipped at original resolution with no srcset.
 */
describe('FileSystemNoteRepository — cover image optimisation', () => {
  it('optimises an absolute /images/ coverImage', async () => {
    await makePng(path.join(tmpRoot, 'public', 'images', 'banner.png'), 1200, 675)
    await writeNote('a', 'title: A\ncoverImage: /images/banner.png')
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    const repo = new FileSystemNoteRepository('en')
    const note = await repo.getBySlug('a')
    expect(note).not.toBeNull()
    expect(note!.coverImage).toMatch(/^\/notes-assets\/banner-[a-f0-9]{10}-\d+\.webp$/)
    expect(note!.coverImageSrcSet).toMatch(/512w/)
    expect(note!.coverImageWidth).toBe(1200)
    expect(note!.coverImageHeight).toBe(675)
  }, 20000)

  it('optimises an absolute /notes/<locale>/attachments/ coverImage', async () => {
    await makePng(
      path.join(tmpRoot, 'content', 'notes', 'en', 'attachments', 'cover.png'),
      900,
      500,
    )
    await writeNote(
      'b',
      'title: B\ncoverImage: /notes/en/attachments/cover.png',
    )
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    const repo = new FileSystemNoteRepository('en')
    const note = await repo.getBySlug('b')
    expect(note!.coverImage).toMatch(/^\/notes-assets\/cover-[a-f0-9]{10}-\d+\.webp$/)
    expect(note!.coverImageSrcSet).toMatch(/512w/)
  }, 20000)

  it('keeps relative coverImage refs working (no regression)', async () => {
    await fs.mkdir(path.join(tmpRoot, 'content', 'notes', 'en'), {
      recursive: true,
    })
    await makePng(
      path.join(tmpRoot, 'content', 'notes', 'en', 'relative.png'),
      640,
      480,
    )
    await writeNote('c', 'title: C\ncoverImage: ./relative.png')
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    const repo = new FileSystemNoteRepository('en')
    const note = await repo.getBySlug('c')
    expect(note!.coverImage).toMatch(/^\/notes-assets\/relative-[a-f0-9]{10}-\d+\.webp$/)
    expect(note!.coverImageWidth).toBe(640)
  }, 20000)

  it('leaves external coverImage URLs untouched', async () => {
    await writeNote('d', 'title: D\ncoverImage: https://cdn.example.com/cover.jpg')
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    const repo = new FileSystemNoteRepository('en')
    const note = await repo.getBySlug('d')
    expect(note!.coverImage).toBe('https://cdn.example.com/cover.jpg')
    expect(note!.coverImageSrcSet).toBeNull()
    expect(note!.coverImageWidth).toBeNull()
    expect(note!.coverImageHeight).toBeNull()
  }, 20000)

  it('falls back to the original ref when the file is missing', async () => {
    await writeNote('e', 'title: E\ncoverImage: /images/does-not-exist.png')
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    const repo = new FileSystemNoteRepository('en')
    const note = await repo.getBySlug('e')
    expect(note!.coverImage).toBe('/images/does-not-exist.png')
    expect(note!.coverImageSrcSet).toBeNull()
  }, 20000)
})
