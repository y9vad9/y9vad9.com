import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { loadGardenIntro, GARDEN_INTRO_DIR } from '@lib/content/gardenIntro'

/**
 * The intro is read from the filesystem relative to `process.cwd()`, so each
 * case runs in its own temp directory rather than against the repo's real
 * `content/garden/en.md`.
 */
let dir: string
const originalCwd = process.cwd()

async function writeIntro(locale: string, body: string) {
  const target = path.join(dir, GARDEN_INTRO_DIR)
  await fs.mkdir(target, { recursive: true })
  await fs.writeFile(path.join(target, `${locale}.md`), body, 'utf8')
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'garden-intro-'))
  process.chdir(dir)
})

afterEach(async () => {
  process.chdir(originalCwd)
  await fs.rm(dir, { recursive: true, force: true })
})

describe('loadGardenIntro', () => {
  it('renders the authored markdown', async () => {
    await writeIntro('en', 'Hello **there**, and [a link](/notes/kotlin).')
    const html = await loadGardenIntro('en')
    expect(html).toContain('<strong>there</strong>')
    expect(html).toContain('href="/notes/kotlin"')
  })

  it('returns null when the locale has no intro', async () => {
    await writeIntro('en', 'English only.')
    // The index renders nothing at all in this case — deliberately, so a
    // locale without an intro shows blank rather than another locale's text
    // or a generic framework sentence.
    expect(await loadGardenIntro('uk')).toBeNull()
  })

  it('returns null when nothing is written yet', async () => {
    expect(await loadGardenIntro('en')).toBeNull()
  })

  it('treats a blank file as absent', async () => {
    await writeIntro('en', '   \n\n  \n')
    expect(await loadGardenIntro('en')).toBeNull()
  })

  it('strips frontmatter rather than printing it', async () => {
    // An author moving a note into this slot would otherwise see
    // "--- title: Welcome ---" rendered as body text.
    await writeIntro('en', '---\ntitle: Welcome\n---\n\nReal body.')
    const html = await loadGardenIntro('en')
    expect(html).toContain('Real body.')
    expect(html).not.toContain('title: Welcome')
  })

  it('refuses a locale that would climb out of the directory', async () => {
    // The locale reaches a filesystem path; `..%2f`-style values must not
    // read arbitrary files even though locales come from config today.
    await writeIntro('en', 'secret')
    expect(await loadGardenIntro('../garden/en')).toBeNull()
    expect(await loadGardenIntro('..')).toBeNull()
  })
})
