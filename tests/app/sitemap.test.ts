import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { routing } from '@i18n/routing'

let tmpRoot: string
let originalCwd: string

beforeEach(async () => {
  originalCwd = process.cwd()
  tmpRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'onvu-sitemap-')))
  for (const l of routing.locales) {
    await fs.mkdir(path.join(tmpRoot, 'content', 'notes', l), { recursive: true })
  }
  process.chdir(tmpRoot)
  vi.resetModules()
})

afterAll(() => process.chdir(originalCwd))

async function write(locale: string, file: string, body: string) {
  await fs.writeFile(
    path.join(tmpRoot, 'content', 'notes', locale, file),
    body,
    'utf-8',
  )
}

describe('sitemap', () => {
  it('emits a home + /notes entry per locale plus per-note entries', async () => {
    await write('en', 'kotlin.md', `---\ntitle: Kotlin\n---\n`)
    const sitemap = (await import('../../src/app/sitemap')).default
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    for (const l of routing.locales) {
      // home + /notes per locale, at minimum.
      expect(urls.some((u) => u.endsWith(`/${l}`))).toBe(true)
      expect(urls.some((u) => u.endsWith(`/${l}/notes`))).toBe(true)
    }
    expect(urls.some((u) => u.endsWith('/kotlin'))).toBe(true)
  })

  it('advertises only the locales a note is actually written in', async () => {
    // This asserted the opposite — every configured locale on every note — and
    // so locked in a real SEO defect: an untranslated note declared alternates
    // that 404. hreflang has to be reciprocal, so a dead entry makes Google
    // discard the whole cluster, taking the genuine translations with it.
    await write('en', 'only-english.md', `---\ntitle: EN only\n---\n`)
    await write('en', 'both.md', `---\ntitle: Both\n---\n`)
    await write('uk', 'both.md', `---\ntitle: Обидві\n---\n`)

    const sitemap = (await import('../../src/app/sitemap')).default
    const entries = await sitemap()

    const solo = entries.find((e) => e.url.endsWith('/only-english'))!
    expect(Object.keys(solo.alternates?.languages ?? {})).toEqual(['en'])

    const both = entries.find((e) => e.url.endsWith('/en/notes/both'))!
    expect(Object.keys(both.alternates?.languages ?? {}).sort()).toEqual(['en', 'uk'])
  })

  it('keeps every locale for routes that exist everywhere', async () => {
    await write('en', 'k.md', `---\ntitle: K\n---\n`)
    const sitemap = (await import('../../src/app/sitemap')).default
    const entries = await sitemap()
    // The garden index is not a note; it resolves in all locales.
    const index = entries.find((e) => e.url.endsWith('/en/notes'))!
    expect(Object.keys(index.alternates?.languages ?? {})).toEqual(
      expect.arrayContaining([...routing.locales]),
    )
  })

  it('filters notes with noindex: true from frontmatter', async () => {
    await write('en', 'public.md', `---\ntitle: Public\n---\n`)
    await write('en', 'secret.md', `---\ntitle: Secret\nnoindex: true\n---\n`)
    const sitemap = (await import('../../src/app/sitemap')).default
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls.some((u) => u.endsWith('/secret'))).toBe(false)
    expect(urls.some((u) => u.endsWith('/public'))).toBe(true)
  })

  it('uses note.updated when set, falling back to date, then now', async () => {
    await write(
      'en',
      'dated.md',
      `---\ntitle: Dated\ndate: 2024-01-01\nupdated: 2025-12-31\n---\n`,
    )
    const sitemap = (await import('../../src/app/sitemap')).default
    const entries = await sitemap()
    const dated = entries.find((e) => e.url.endsWith('/dated'))!
    const stamp =
      dated.lastModified instanceof Date
        ? dated.lastModified.toISOString()
        : new Date(dated.lastModified as string).toISOString()
    expect(stamp.startsWith('2025-12-31')).toBe(true)
  })
})
