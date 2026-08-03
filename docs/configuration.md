# Configuration

Everything a site declares about itself lives in `site.config.ts` at the repository root. It exports one object typed as `SiteConfig`, so a wrong key is a build error rather than a silent no-op. The type itself is `src/config/site.ts`, and it carries commentary this page does not repeat.

`site.config.ts` and `site.<locale>.config.ts` are both marked `merge=ours`, so upstream never overwrites them.

## Per-locale overrides

`site.<locale>.config.ts` exports a `Partial<SiteConfig>` that deep-merges over the base for that locale:

```ts
// site.de.config.ts
import type { SiteConfig } from '@config/site'

export const config: Partial<SiteConfig> = {
  owner: {
    bio: 'Softwareentwickler und Open-Source-Mitwirkender.',
  },
}
```

Only the keys that change need to appear. Sibling fields keep their base values, and a locale with no file falls through to the base entirely. Put user-facing strings that differ by language here (a bio, a job title, a project description) and leave anything identical everywhere (logos, URLs, social handles) in the base.

The merge walks plain objects key by key. Arrays are replaced wholesale, not concatenated, so overriding `home.projects` means listing every project again.

## Reference

### `owner` (required)

| Key | Type | Notes |
|:---|:---|:---|
| `name` | `string` | Used as the default article byline and in JSON-LD. |
| `handle` | `string` | Header brand text when `branding` is absent. |
| `profileImage` | `string` | Site-absolute path or external URL. |
| `bio` | `string` | Hero paragraph. |
| `socials` | `SocialLink[]` | Rendered in the hero and the mobile drawer. |

A `SocialLink` is `{ platform, url, icon? }`. Any platform name is accepted. Known names resolve to a glyph automatically: `github`, `gitlab`, `linkedin`, `twitter`, `x`, `instagram`, `youtube`, `twitch`, `facebook`, `telegram`, `discord`, `slack`, `mastodon`, `bluesky`, `threads`, plus the generic `email`, `mail`, `rss`, `website` and `link`.

For anything else, or to override a default, pass `icon`. The prefix picks the icon set: `Si*` reads from Simple Icons, `Fa*` from Font Awesome, and anything else from Lucide. An unresolvable name falls back to the platform's first letter, so a typo degrades to a visible glyph rather than a hole.

### `locales` (required)

```ts
locales: { primary: 'en', supported: ['en', 'de', 'uk'] }
```

`primary` is the default locale and the fallback for missing translations. `supported` drives the routes generated, the language switcher, the sitemap, hreflang and the message layering. Codes are free-form BCP-47, so `pt-BR` works as long as the matching `messages/pt-BR.json` and `content/notes/pt-BR/` exist. See [Localisation](localisation.md).

With one entry in `supported`, the language switcher disappears rather than offering the language you are already reading.

### `defaultTheme` and `themes`

`defaultTheme` is a theme id, and it is what a first-time visitor gets. `themes` is optional; omit it for the five built-in palettes (`light`, `dark`, `warm`, `forest`, `system`).

A `ThemeOption` is `{ id, label?, icon?, dark? }`. `label` is looked up under the `theme.*` message namespace and falls back to the literal string. `icon` is a PascalCase Lucide name, defaulting to `Palette`. `dark` declares whether the palette sits on a dark canvas, which decides `color-scheme` and therefore what the browser paints before your stylesheet arrives. Omitting `dark` means "follow the OS", correct for a `system` entry and wrong for anything else. [Theming](theming.md) has the details.

A single-entry `themes` array hides the theme control, on the same reasoning as the language switcher.

### `branding`

Optional. Omit it and the header shows `owner.handle` as text.

```ts
branding: { kind: 'text', text: 'My Site' }
branding: { kind: 'image', src: '/logo.svg', alt: 'My Site', width: 28, height: 28 }
```

### `mode`

`'static'` or `'server'`. Optional, and the `ONVU_MODE` environment variable wins over it, which is how `npm run build:static` forces a static export without touching config. Unset means `'server'`.

It describes the artifact you deploy, not `next dev`. A dev server always serves the API routes and never writes the pre-built snapshots, so it runs in server mode whatever this says. See [Deployment](deployment.md).

### `basePath`

Serve the site from a subpath, as in `example.com/notes/` rather than the domain root. GitHub Pages project sites are the usual reason. No trailing slash.

Setting it wires Next's `basePath` and `assetPrefix` together with `NEXT_PUBLIC_BASE_PATH`, which the browser bundle reads through `publicPath()` for the URLs Next does not prefix by itself (the static search index, the API routes, generated asset paths, the giscus stylesheet).

### `pwa` (required)

`{ name, shortName, description, themeColor?, backgroundColor? }`. Rendered as `/manifest.webmanifest` by `src/app/manifest.ts`, and linked from every page automatically. `themeColor` and `backgroundColor` are omitted from the manifest when unset. The icon comes from the generated `/icon` route.

### `navigation` (required)

```ts
navigation: {
  featuredNotes: ['deep-modules', 'kotlin-coroutines-intro'],
  workExperienceNote: 'work-experience',
  projectsNote: 'projects',
  educationNote: 'education',
  summaryNote: 'about',
}
```

`featuredNotes` is an ordered list of slugs shown as large cards on the landing page. The other four name the notes behind the landing page's section links. Every value is a note slug that has to exist.

This is separate from `content/navigation.ts`, which owns the header dropdown menus. See [Customisation](customisation.md).

### `home` (required)

Three arrays feeding the landing page.

```ts
home: {
  workExperience: [{ company, role, period, url, logo? }],
  projects: [{ name, description, url, logo? }],
  education: [{ institution, degree, period, url?, logo? }],
}
```

Every `logo` is optional, and every one takes a site-absolute path or an external URL. Appending `?dark-invert` to a logo URL inverts it under dark palettes, which saves keeping two files for a monochrome mark:

```ts
logo: '/images/university.svg?dark-invert'
```

`period` is a free string, so write it however reads best in your language.

### `comments`

```ts
comments: { provider: 'none' }
```

Omitting the key does the same thing: no comments section renders at all. For per-note threads backed by GitHub Discussions, switch to giscus and fill in the four values from [giscus.app](https://giscus.app):

```ts
comments: {
  provider: 'giscus',
  repo: 'you/your-repo',
  repoId: 'R_xxxx',
  category: 'Announcements',
  categoryId: 'DIC_xxxx',
}
```

Giscus is the only built-in renderer. Adding another means extending the union in `src/config/site.ts`, routing it in `CommentsSection.tsx` and writing a renderer beside `GiscusComments.tsx`.

### `links`

```ts
links: { fetchExternalTitles: false }
```

When true, the build fetches each external link's `<title>` so the outgoing-links panel shows a real label instead of a bare URL. Off by default, because turning it on makes the build non-hermetic: the same commit produces different HTML online and offline, failures fall back silently, and every site you have ever cited gets pinged from CI on every deploy.

### `seo`

| Key | Notes |
|:---|:---|
| `siteUrl` | Canonical origin, no trailing slash. Beats `NEXT_PUBLIC_BASE_URL` when both are set. |
| `defaultOgImage` | Static fallback social card, absolute path or URL. |
| `ogFont` | `{ path, name? }`, a font file relative to the project root, used for generated OG cards and the favicon. |
| `twitterHandle` | Including the leading `@`. |
| `organization` | `{ name, logo }`. Emits Organization instead of Person in the site's JSON-LD. |
| `verification` | `{ google?, bing?, yandex? }` search-engine verification keys. |
| `noindexPaths` | Unprefixed routes excluded from the sitemap and disallowed in robots.txt. Defaults to `['/notes/graph']`. |

`siteUrl` is shipped commented out on purpose. Any non-empty value here wins over the environment variable, so a placeholder produces a clean build whose sitemap, canonicals, RSS guids and OG `metadataBase` all point somewhere wrong. Precedence is `seo.siteUrl`, then `NEXT_PUBLIC_BASE_URL`, then `http://localhost:3000`. A production build whose origin resolves to one of the known placeholders (`https://example.com`, `https://your-domain.com`, or the localhost fallback) prints a warning once.

`ogFont` matters for non-Latin titles. `next/og` bundles a Latin-subset face, so without it a Japanese, Korean, Chinese, Arabic or Hebrew title renders as empty boxes on every social card, and the build still succeeds. It is not a default because covering CJK means tens of megabytes most forks would never use.

`noindexPaths` entries are written unprefixed, the way you think about your own routes, and expanded across every configured locale when robots.txt is written. See [SEO and metadata](seo.md).

### `shortcuts`

```ts
shortcuts: { enabled: false }
```

Turns off the garden's bare-letter keyboard shortcuts (`e`, `f`, `t`, `s`, `l`, `g`). They are convenient for a keyboard-first reader and a nuisance in a screen reader's browse mode or on a switch device, where stray letter keys reach the document and start moving panels. Disabling also removes the matching entries from the command palette, so nothing advertises a key that no longer works. Readers can toggle this themselves from the palette; the config sets the default.

### `garden`

```ts
garden: { actions: ['graph', 'random', 'rss'] }
```

Which action cards appear on the note index, in this order. Omit the key for those three built-ins; set `[]` to drop the section.

Alongside the built-in ids you can define your own. Behaviour is data rather than a callback, because the config is imported on the server while the action row is a client component, and a function would be dropped crossing that boundary rather than failing loudly.

```ts
garden: {
  actions: [
    'graph',
    { label: 'Email me', icon: 'mail', href: 'mailto:you@example.com' },
    { label: 'Copy the feed URL', icon: 'rss', copy: '/en/feed.xml' },
    { label: 'Search notes', icon: 'search', command: 'search' },
  ],
}
```

Each variant names what it does. `href` navigates, and a bare path is treated as internal and client-routed while anything with a scheme opens in a new tab. `copy` puts text on the clipboard, and a value starting with `/` is resolved against the site's own origin at click time. `command` runs one of the garden's own commands, using the same ids the keyboard shortcuts and the palette dispatch (see [The garden](garden.md)).

`icon` is any Lucide icon name in kebab-case. Icons load on demand rather than being bundled, and the name is typed against Lucide's own union, so a misspelling fails the build.

### `agents`

Machine-readable surfaces for AI agents. Everything in this block except the crawler policy is off by default. It is large enough to have its own page: [Agents and AI surfaces](agents.md).

## Environment variables

| Variable | Read by | Effect |
|:---|:---|:---|
| `NEXT_PUBLIC_BASE_URL` | build and runtime | Canonical origin. `seo.siteUrl` beats it. Defaults to `http://localhost:3000`. |
| `ONVU_MODE` | build | `static` or `server`, overriding `mode` in config. |
| `ONVU_DRAFTS` | build and dev | `1` includes notes marked `draft: true`. |
| `NEXT_PUBLIC_ONVU_MODE` | browser bundle | Derived. Tells the client whether to read pre-built JSON or call the API. |
| `NEXT_PUBLIC_BASE_PATH` | browser bundle | Derived from `basePath`. Read by `publicPath()`. |

The last two are set by `next.config.ts` from the resolved mode and base path. Setting them yourself will disagree with the build.
