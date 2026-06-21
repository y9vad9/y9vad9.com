import { describe, it, expect, vi } from 'vitest'
import { baseMetadata } from '@lib/seo/metadata'
import { routing } from '@i18n/routing'

describe('baseMetadata', () => {
  it('emits a canonical and an entry per locale (plus x-default)', async () => {
    const meta = await baseMetadata({ locale: 'en', path: '/notes' })
    const langs = (meta.alternates?.languages ?? {}) as Record<string, string>
    expect(langs['x-default']).toMatch(new RegExp(`${routing.defaultLocale}/notes$`))
    for (const l of routing.locales) {
      expect(langs[l]).toMatch(new RegExp(`/${l}/notes$`))
    }
    expect(meta.alternates?.canonical).toMatch(/\/en\/notes$/)
  })

  it('sets a title template and a sensible default', async () => {
    const meta = await baseMetadata({ locale: 'en' })
    expect(meta.title).toMatchObject({ template: expect.stringMatching(/%s \| /) })
  })

  it('opens graph + twitter card derived from locale and config', async () => {
    const meta = await baseMetadata({ locale: 'uk', path: '/notes/foo' })
    const og = meta.openGraph as { locale?: string; type?: string } | undefined
    const tw = meta.twitter as { card?: string } | undefined
    expect(og?.locale).toBe('uk')
    expect(og?.type).toBe('website')
    expect(tw?.card).toBe('summary_large_image')
  })

  it('uses metadataBase from the siteUrl helper', async () => {
    const meta = await baseMetadata({ locale: 'en' })
    expect(meta.metadataBase).toBeInstanceOf(URL)
  })

  it('reads per-locale owner.name / owner.bio from loadSiteConfig (regression)', async () => {
    // Bug 2 regression: before the fix, baseMetadata imported the base
    // site config statically, so the rendered <head> served English
    // owner.name / owner.bio on every locale, even when the user had
    // shipped a site.uk.config.ts translation. We mock loadSiteConfig to
    // return distinct names/bios per locale and assert the resulting
    // Metadata reflects them, proving the dependency arrow actually
    // flows through.
    vi.resetModules()
    vi.doMock('@lib/config/loadConfig', () => ({
      loadSiteConfig: async (locale: string) => ({
        owner: {
          name: locale === 'uk' ? 'Вадим' : 'Vadym',
          handle: 'y9vad9',
          profileImage: '/img.png',
          bio: locale === 'uk' ? 'Інженер' : 'Engineer',
          socials: [],
        },
        url: 'https://example.com',
        locales: { primary: 'en', supported: ['en', 'uk'] },
        defaultTheme: 'light',
        navigation: { featuredNotes: 3 },
        home: { workExperience: [], projects: [], education: [] },
      }),
    }))
    const { baseMetadata: localised } = await import('@lib/seo/metadata')
    const en = await localised({ locale: 'en' })
    const uk = await localised({ locale: 'uk' })
    const enTitle = en.title as { template?: string; default?: string }
    const ukTitle = uk.title as { template?: string; default?: string }
    expect(enTitle.default).toBe('Vadym')
    expect(ukTitle.default).toBe('Вадим')
    expect(enTitle.template).toMatch(/\| Vadym$/)
    expect(ukTitle.template).toMatch(/\| Вадим$/)
    expect(en.description).toBe('Engineer')
    expect(uk.description).toBe('Інженер')
    const enOg = en.openGraph as { siteName?: string } | undefined
    const ukOg = uk.openGraph as { siteName?: string } | undefined
    expect(enOg?.siteName).toBe('Vadym')
    expect(ukOg?.siteName).toBe('Вадим')
    vi.doUnmock('@lib/config/loadConfig')
  })
})
