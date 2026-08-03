# Localisation

Every route is locale-prefixed. `/en`, `/de/notes`, `/uk/notes/kotlin`. The set of locales comes from one config key, and everything else derives from it: the generated routes, the language switcher, the sitemap, hreflang annotations, per-locale feeds, and which message files are loaded.

```ts
locales: { primary: 'en', supported: ['en', 'de', 'uk'] }
```

Codes are free-form BCP-47, so `pt-BR` and `zh-Hans` work. English, German and Ukrainian ship translated.

## Adding a language

Say you are adding French. Two steps are required:

1. Add it to `supported`: `locales: { primary: 'en', supported: ['en', 'de', 'uk', 'fr'] }`.
2. Create `content/notes/fr/`. It can start empty. A locale with no notes renders an empty garden rather than failing.

Then, whenever you get to them:

3. Copy `messages/en.json` to `messages/fr.json` and translate the interface. Skipping this is fine, because untranslated keys fall back to the primary locale, so the site is usable in the meantime and never shows a reader a raw key path.
4. Write `content/garden/fr.md` for the index intro, add a `byLocale.fr` entry to `content/navigation.ts` for the header menus, and create `site.fr.config.ts` for anything in the config that reads differently in French.

Nothing else needs touching. The language switcher, sitemap, feed, hreflang links and static routes all pick it up.

Removing a language is the same list in reverse. Take it out of `supported` and the routes stop being generated.

## How messages resolve

Four sources are merged, each overriding the one before:

| Layer | File | Owner |
|:---|:---|:---|
| 1 | `messages/<primary>.json` | The template. |
| 2 | `messages/<locale>.json` | The template. |
| 3 | `content/i18n/<primary>.json` | You. |
| 4 | `content/i18n/<locale>.json` | You. |

The merge is deep, so a file only has to mention keys it changes.

Layers 1 and 3 are the fallbacks, and they are why a missing translation is merely untranslated. Without layer 1, a key upstream adds before you have translated it would render as the literal path, and a reader would see `garden.actions` on the page. Without layer 3, your own invented keys would vanish on every locale you had not yet translated them into.

None of the four files is required to exist. A site whose primary locale has no `messages/` file still renders.

### Overriding a framework string

`content/i18n/<locale>.json` mirrors the structure of `messages/<locale>.json`. To change one label, write just that path:

```json
{
  "garden": {
    "welcome": "Notes and half-formed thoughts"
  }
}
```

### Your own strings

New keys are additive, so the same file is where strings your `content/` code needs should live:

```json
{
  "home": {
    "chips": { "hiring": "Available for contract work" }
  }
}
```

Read them the usual way, with `useTranslations('home')` in a client component or `getTranslations({ locale, namespace: 'home' })` on the server.

Do not edit `messages/` directly. It is framework-owned, upstream changes it constantly, and it is deliberately outside the `merge=ours` boundary. Overriding from `content/i18n/` means you never conflict on a string.

The namespaces currently in `messages/en.json` are `nav`, `header`, `theme`, `language`, `home`, `garden`, `note`, `graph`, `search`, `explorer`, `panel`, `comments`, `notFound`, `footer`, `error`, `commands` and `a11y`.

## Per-locale configuration

`site.<locale>.config.ts` exports a `Partial<SiteConfig>` that deep-merges over the base. Use it for anything visible whose wording changes by language: a bio, a job title, a project description. Leave logos, URLs and handles in the base. [Configuration](configuration.md) has the details.

## Locale detection

In a server build the middleware redirects `/` and other unprefixed paths to a locale. A static export has no middleware, so the build writes a `_redirects` rule for the root instead. Both are covered in [Deployment](deployment.md).

There is also `/notes/<slug>`, an unprefixed alias for note URLs. It resolves a locale on the client and redirects, preserving any query string and hash, so a link written without a locale prefix still lands somewhere sensible. It tries, in order:

1. A language the reader chose, stored the last time they used a language switcher.
2. The browser's language, when that matches a supported locale.
3. The primary locale.

A deliberate choice comes first, and it beats the browser setting even when the two agree, so choosing your primary language is not mistaken for having chosen nothing.

Every language switcher on the site goes through one hook, which both swaps the path and records the choice. The path swap keeps everything but the prefix, so switching language on a note keeps you on that note, and the prefix is matched against your configured locales rather than parsed, so codes like `pt-BR` and `zh-Hans` work the same as `en`.

## Right-to-left

Adding an RTL language is the same four steps as any other. `<html dir>` is derived from the locale through `Intl.Locale`, so `ar`, `he`, `fa`, `ur` and the less obvious cases (`ckb`, `az-Arab`, `pa-Arab`, Dhivehi, Uyghur, Yiddish) are all handled without a list anyone has to maintain. Runtimes too old for `Intl.Locale.textInfo` fall back to left-to-right rather than throwing.

Correct `dir` is the precondition for everything else. The layout uses CSS logical properties throughout (`ps-`, `pe-`, `start-`, `end-`, `text-start`), so padding, alignment and positioning flip with it.

Two behaviours worth knowing. Panel resizing inverts, because pointer movement is physical while panel sides are logical, and the same gesture has to grow the panel in both directions. And directional icons mirror through one CSS rule keyed on the class Lucide stamps on every icon, rather than through a list of call sites, so an arrow icon added later is covered without anyone remembering to.

Right-to-left support is implemented but not shipped as a configured locale, since none of the three bundled languages is RTL. Adding one is a config change, not a code change.
