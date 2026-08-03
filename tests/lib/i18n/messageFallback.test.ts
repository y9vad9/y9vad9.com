import { describe, it, expect } from 'vitest'
import { deepMerge } from '@lib/deepMerge'
import enMessages from '../../../messages/en.json'
import deMessages from '../../../messages/de.json'

type Messages = Record<string, unknown>

/**
 * `src/i18n/request.ts` layers four message sources, primary-first:
 *
 *   messages/<primary> → messages/<locale> → content/i18n/<primary> → content/i18n/<locale>
 *
 * The two primary layers are what was missing. A locale's own file used to
 * *replace* the primary's, so a key upstream added and this locale hadn't
 * translated yet rendered as its literal path — a reader seeing
 * `garden.actions` where a label belonged, with no build failure and no test.
 * Upstream touches `messages/` on most releases, so every sync put that in
 * front of somebody.
 *
 * The layering is pure `deepMerge`, so it can be asserted directly rather than
 * by booting next-intl's request pipeline.
 */
function resolve(layers: Array<Messages | null>): Messages {
  return layers
    .filter((m): m is Messages => m !== null)
    .reduce<Messages>((acc, layer) => deepMerge(acc, layer) as Messages, {})
}

describe('message layering', () => {
  it('falls back to the primary language for an untranslated key', () => {
    const primary = { garden: { welcome: 'Welcome', brandNew: 'Brand new' } }
    const locale = { garden: { welcome: 'Ласкаво просимо' } }
    const out = resolve([primary, locale]) as { garden: Record<string, string> }

    expect(out.garden.welcome).toBe('Ласкаво просимо')
    // The key the locale has not caught up with. Previously this was absent,
    // and next-intl renders a missing key as `garden.brandNew`.
    expect(out.garden.brandNew).toBe('Brand new')
  })

  it("keeps the site's own invented keys across locales", () => {
    // A downstream defines `home.chips.*` in content/i18n/en.json; those must
    // not vanish on /uk before it gets round to translating them.
    const contentPrimary = { home: { chips: { quickFacts: 'Quick facts' } } }
    const contentLocale = { home: { greeting: 'Привіт' } }
    const out = resolve([{}, {}, contentPrimary, contentLocale]) as {
      home: { chips: Record<string, string>; greeting: string }
    }
    expect(out.home.chips.quickFacts).toBe('Quick facts')
    expect(out.home.greeting).toBe('Привіт')
  })

  it('lets the site override a framework string for one locale only', () => {
    const out = resolve([
      { nav: { home: 'Home' } },
      { nav: { home: 'Startseite' } },
      null,
      { nav: { home: 'Zuhause' } },
    ]) as { nav: Record<string, string> }
    // content/i18n is the last layer, so the site wins over the framework.
    expect(out.nav.home).toBe('Zuhause')
  })

  it('resolves to the primary language when a locale has no files at all', () => {
    const out = resolve([{ nav: { home: 'Home' } }, null, null, null]) as {
      nav: Record<string, string>
    }
    // The `ja`-primary crash lived here: the old catch re-imported the *same*
    // missing file and threw out of `getRequestConfig`. Nothing is required.
    expect(out.nav.home).toBe('Home')
  })

  it('covers every framework key shipped for the primary language', () => {
    // The invariant the layering exists to hold: whatever `de` is missing
    // relative to `en`, a reader still gets a string rather than a key path.
    const merged = resolve([enMessages as Messages, deMessages as Messages])
    const flat = (o: Messages, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' ? flat(v as Messages, `${p}${k}.`) : [`${p}${k}`],
      )
    for (const key of flat(enMessages as Messages)) {
      expect(flat(merged)).toContain(key)
    }
  })
})
