import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

let tmpRoot: string
let originalCwd: string

beforeEach(async () => {
  originalCwd = process.cwd()
  tmpRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'onvu-fs-')))
  await fs.mkdir(path.join(tmpRoot, 'content', 'notes', 'en'), { recursive: true })
  process.chdir(tmpRoot)
  vi.resetModules()
})

afterAll(async () => {
  process.chdir(originalCwd)
})

async function write(file: string, body: string): Promise<void> {
  await fs.writeFile(
    path.join(tmpRoot, 'content', 'notes', 'en', file),
    body,
    'utf-8',
  )
}

describe('FileSystemNoteRepository', () => {
  it('returns an empty list when the locale folder is missing', async () => {
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    const repo = new FileSystemNoteRepository('uk')
    expect(await repo.listAll()).toEqual([])
  })

  it('reads frontmatter and renders the body', async () => {
    await write(
      'kotlin.md',
      `---\ntitle: Kotlin\npreview: A language\n---\n\n# Heading\n\nBody text.`,
    )
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    const repo = new FileSystemNoteRepository('en')
    const all = await repo.listAll()
    expect(all).toHaveLength(1)
    expect(all[0].slug).toBe('kotlin')
    expect(all[0].title).toBe('Kotlin')
    expect(all[0].body).toContain('Heading')
    expect(all[0].headings.map((h) => h.text)).toEqual(['Heading'])
  })

  it('resolves wiki links case-insensitively', async () => {
    await write(
      'a.md',
      `---\ntitle: Alpha\n---\nSee [[Beta]] and [[BETA]].`,
    )
    await write('b.md', `---\ntitle: Beta\n---\nbody`)
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    const repo = new FileSystemNoteRepository('en')
    const a = await repo.getBySlug('a')
    expect(a?.body).toMatch(/data-note-slug="b"/)
  })

  it('marks unresolved wiki links as broken', async () => {
    await write('a.md', `---\ntitle: A\n---\nSee [[Ghost]].`)
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    const repo = new FileSystemNoteRepository('en')
    const a = await repo.getBySlug('a')
    expect(a?.body).toMatch(/wikilink-broken/)
  })

  it('listByParent filters case-insensitively', async () => {
    await write('a.md', `---\ntitle: A\nparents:\n  - Engineering\n---\n`)
    await write('b.md', `---\ntitle: B\nparents:\n  - Other\n---\n`)
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    const repo = new FileSystemNoteRepository('en')
    const result = await repo.listByParent('engineering')
    expect(result.map((n) => n.slug)).toEqual(['a'])
  })

  it('caches the result list — second listAll does not re-read', async () => {
    await write('a.md', `---\ntitle: A\n---\n`)
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    const repo = new FileSystemNoteRepository('en')
    const first = await repo.listAll()
    await fs.unlink(path.join(tmpRoot, 'content', 'notes', 'en', 'a.md'))
    const second = await repo.listAll()
    expect(second).toEqual(first)
  })
})

/**
 * `draft: true` keeps a note in the repository and off the site.
 *
 * Neither existing flag said that: `archived` is a badge on a page that still
 * exists, and `noindex` still builds and lists the page. A vault of 400 notes
 * has 250 nobody should see, and the only way to say so was to move the file
 * out of the tree.
 */
describe('drafts', () => {
  async function repo() {
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    return new FileSystemNoteRepository('en')
  }

  it('excludes a draft from the list', async () => {
    await write('ready.md', `---\ntitle: Ready\n---\nbody`)
    await write('wip.md', `---\ntitle: WIP\ndraft: true\n---\nbody`)
    expect((await (await repo()).listAll()).map((n) => n.slug)).toEqual(['ready'])
  })

  it('makes a draft unreachable by slug too', async () => {
    await write('wip.md', `---\ntitle: WIP\ndraft: true\n---\nbody`)
    // Filtering only the list would leave the page buildable and linkable —
    // which is what `noindex` already provides, and not what a draft is.
    expect(await (await repo()).getBySlug('wip')).toBeNull()
  })

  it('treats an absent flag as published', async () => {
    await write('plain.md', `---\ntitle: Plain\n---\nbody`)
    expect((await (await repo()).listAll())[0].isDraft).toBe(false)
  })

  it('shows drafts when ONVU_DRAFTS=1, for the author', async () => {
    await write('wip.md', `---\ntitle: WIP\ndraft: true\n---\nbody`)
    vi.stubEnv('ONVU_DRAFTS', '1')
    expect((await (await repo()).listAll()).map((n) => n.slug)).toEqual(['wip'])
    vi.unstubAllEnvs()
  })
})

/**
 * A vault is a tree. `fs.readdir` without `recursive` saw only its root, so
 * every note in a subfolder was silently invisible — no warning, no error,
 * just an empty garden. Slugs stay flat, so folders organise the source
 * without moving any URL.
 */
describe('nested folders', () => {
  async function repo() {
    const { FileSystemNoteRepository } = await import(
      '@adapters/fs/FileSystemNoteRepository'
    )
    return new FileSystemNoteRepository('en')
  }
  async function mkdir(rel: string) {
    await fs.mkdir(path.join(tmpRoot, 'content', 'notes', 'en', rel), {
      recursive: true,
    })
  }

  it('finds notes in subfolders', async () => {
    await mkdir('permanent')
    await write('root.md', `---\ntitle: Root\n---\nbody`)
    await write('permanent/deep.md', `---\ntitle: Deep\n---\nbody`)
    const slugs = (await (await repo()).listAll()).map((n) => n.slug).sort()
    expect(slugs).toEqual(['deep', 'root'])
  })

  it('keeps the slug flat so existing URLs do not move', async () => {
    await mkdir('a/b/c')
    await write('a/b/c/buried.md', `---\ntitle: Buried\n---\nbody`)
    expect((await (await repo()).listAll())[0].slug).toBe('buried')
  })

  it('skips folders and files marked with a leading underscore', async () => {
    await mkdir('_scratch')
    await write('_scratch/wip.md', `---\ntitle: WIP\n---\nbody`)
    await write('real.md', `---\ntitle: Real\n---\nbody`)
    // The convention every static generator uses for partials, and the one an
    // author reaches for to park work in progress.
    expect((await (await repo()).listAll()).map((n) => n.slug)).toEqual(['real'])
  })

  it('names both files when two folders collide on a slug', async () => {
    await mkdir('literature')
    await mkdir('permanent')
    await write('literature/kotlin.md', `---\ntitle: Lit\n---\nbody`)
    await write('permanent/kotlin.md', `---\ntitle: Perm\n---\nbody`)
    // Silently picking one would publish the wrong note and lose the other.
    await expect((await repo()).listAll()).rejects.toThrow(/share the slug "kotlin"/)
  })

  it('resolves a co-located image beside the note, not the locale root', async () => {
    await mkdir('permanent')
    await write('permanent/withimg.md', `---\ntitle: Img\n---\n![a](./pic.png)`)
    const notes = await (await repo()).listAll()
    // The point of tracking each note's own directory: `./pic.png` in
    // `permanent/` means the copy in `permanent/`.
    expect(notes[0].body).toContain('pic.png')
  })
})
