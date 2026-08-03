import { describe, it, expect, vi, afterEach } from 'vitest'

/**
 * Three surfaces switch language, and each had its own path rewrite. The one in
 * the garden header matched `/^\/[a-z]{2}(?=\/|$)/`, so on any locale code that
 * is not two lowercase letters it matched nothing, `router.push` was handed the
 * page the reader was already on, and the switcher did nothing at all.
 * `locales.supported` is documented as free-form BCP-47.
 */
async function withLocales(locales: string[], primary = locales[0]) {
  vi.resetModules()
  vi.doMock('~/site.config', () => ({
    config: {
      locales: { primary, supported: locales },
      owner: { name: 'x', handle: 'x', profileImage: '', bio: '', socials: [] },
      defaultTheme: 'system',
      pwa: { name: 'x', shortName: 'x', description: 'x' },
      navigation: {
        featuredNotes: [],
        workExperienceNote: '',
        projectsNote: '',
        educationNote: '',
        summaryNote: '',
      },
      home: { workExperience: [], projects: [], education: [] },
    },
  }))
  return import('@lib/i18n/localePath')
}

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('~/site.config')
})

describe('switchLocalePath', () => {
  it('swaps the prefix on a nested path', async () => {
    const { switchLocalePath } = await withLocales(['en', 'de', 'uk'])
    expect(switchLocalePath('/en/notes/deep-modules', 'de')).toBe('/de/notes/deep-modules')
  })

  it('handles the locale home page without leaving a bare slash', async () => {
    const { switchLocalePath } = await withLocales(['en', 'de'])
    expect(switchLocalePath('/en', 'de')).toBe('/de')
  })

  it('works for locale codes that are not two lowercase letters', async () => {
    // The case the old regex silently dropped.
    const { switchLocalePath } = await withLocales(['pt-BR', 'zh-Hans', 'ckb', 'fil'], 'pt-BR')
    expect(switchLocalePath('/pt-BR/notes/x', 'zh-Hans')).toBe('/zh-Hans/notes/x')
    expect(switchLocalePath('/ckb/notes/x', 'fil')).toBe('/fil/notes/x')
    expect(switchLocalePath('/fil', 'ckb')).toBe('/ckb')
  })

  it('prefers the longest matching prefix', async () => {
    // Stripping `pt` from `/pt-BR/notes` would leave `-BR/notes` behind.
    const { switchLocalePath } = await withLocales(['pt', 'pt-BR'], 'pt')
    expect(switchLocalePath('/pt-BR/notes/x', 'pt')).toBe('/pt/notes/x')
  })

  it('does not mistake a path segment for the prefix', async () => {
    // `pathname.replace('/' + locale, '')` is an unanchored substring replace.
    // It happens to be right when the prefix is present, and this pins that a
    // locale appearing later in the path is not what gets rewritten.
    const { switchLocalePath } = await withLocales(['en', 'de'])
    expect(switchLocalePath('/en/notes/de-facto-standards', 'de')).toBe(
      '/de/notes/de-facto-standards',
    )
  })

  it('does not strip a slug that merely starts with a locale code', async () => {
    const { switchLocalePath } = await withLocales(['en', 'de'])
    expect(switchLocalePath('/en/notes/english', 'de')).toBe('/de/notes/english')
  })

  it('puts an unprefixed path under the target locale', async () => {
    // Routes outside `[locale]` exist: the root 404 and `/notes/<slug>`.
    const { switchLocalePath } = await withLocales(['en', 'de'])
    expect(switchLocalePath('/notes/x', 'de')).toBe('/de/notes/x')
    expect(switchLocalePath('/', 'de')).toBe('/de')
  })
})
