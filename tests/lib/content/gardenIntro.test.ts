import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { loadGardenIntro, loadGardenIntroSummary, GARDEN_INTRO_DIR } from '@lib/content/gardenIntro'

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

  it('resolves wiki links against the corpus', async () => {
    await writeIntro('en', 'Start with [[Deep Modules]].')
    const html = await loadGardenIntro('en', [
      { slug: 'deep-modules', title: 'Deep Modules' },
    ])
    // The pipeline only installs the wiki-link plugin when handed a resolver.
    // Without one the intro rendered `[[Deep Modules]]` as literal brackets —
    // on the page whose entire job is pointing readers at entry notes.
    // Locale-prefixed: the intro is read per locale, so the notes it points
    // at are that locale's. The trailing slash follows the build's URL shape
    // and is covered by the `noteHref` tests.
    expect(html).toMatch(/href="\/en\/notes\/deep-modules\/?"/)
    expect(html).not.toContain('[[')
  })

  it('marks a wiki link the corpus does not answer', async () => {
    await writeIntro('en', 'Start with [[No Such Note]].')
    const html = await loadGardenIntro('en', [
      { slug: 'deep-modules', title: 'Deep Modules' },
    ])
    // Same treatment a note gets: visibly broken beats silently plausible.
    expect(html).toContain('wikilink-broken')
  })

  it('renders brackets literally when given no corpus', async () => {
    await writeIntro('en', 'Start with [[Deep Modules]].')
    // The default. Callers that have no note list get the old behaviour rather
    // than a resolver that answers nothing and marks every link broken.
    expect(await loadGardenIntro('en')).toContain('[[Deep Modules]]')
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

/**
 * `garden.welcomeDescription` was removed from the page for reading as filler
 * and survived as the `<meta description>` of every adopter's garden — the one
 * place a shared boilerplate sentence does the most damage. The description
 * now comes from the author's own opening line, or from nothing.
 */
describe('loadGardenIntroSummary', () => {
  it('takes the opening line of the authored intro', async () => {
    await writeIntro('en', 'This garden is where I think in public.\n\nMore below.')
    expect(await loadGardenIntroSummary('en')).toBe(
      'This garden is where I think in public.',
    )
  })

  it('skips a leading heading to reach the prose', async () => {
    await writeIntro('en', '## Start here\n\nThe actual opening sentence.')
    expect(await loadGardenIntroSummary('en')).toBe('The actual opening sentence.')
  })

  it('reduces markdown to the words a search result would show', async () => {
    await writeIntro('en', 'Read **this** and [that](/notes/x) and [[Deep Modules]].')
    expect(await loadGardenIntroSummary('en')).toBe(
      'Read this and that and Deep Modules.',
    )
  })

  it('prefers a wiki link alias over its target', async () => {
    await writeIntro('en', 'Start at [[deep-modules|Deep Modules]].')
    expect(await loadGardenIntroSummary('en')).toBe('Start at Deep Modules.')
  })

  it('clips a long opening on a word boundary', async () => {
    await writeIntro('en', `${'word '.repeat(60)}end.`)
    const summary = (await loadGardenIntroSummary('en'))!
    expect(summary.length).toBeLessThanOrEqual(161)
    expect(summary.endsWith('…')).toBe(true)
    // Not mid-word: the character before the ellipsis closes a word.
    expect(summary).not.toMatch(/wor…$/)
  })

  it('returns null with no intro, so the site description stands', async () => {
    await writeIntro('en', 'English only.')
    // Blank beats boilerplate — the caller omits `description` entirely and
    // `baseMetadata`'s site-level one applies.
    expect(await loadGardenIntroSummary('de')).toBeNull()
  })

  it('accepts a three-letter locale code', async () => {
    // `Locale` is documented as "any BCP-47 code", and the guard here used to
    // be `[a-z]{2}` — so `fil`, `haw` and `yue` silently got no intro at all.
    await writeIntro('fil', 'Isang hardin.')
    expect(await loadGardenIntroSummary('fil')).toBe('Isang hardin.')
  })

  it('still refuses a locale that would climb out of the directory', async () => {
    expect(await loadGardenIntroSummary('../../etc/passwd')).toBeNull()
    expect(await loadGardenIntroSummary('en/../../secret')).toBeNull()
  })
})
