# SEO and metadata

There is no SEO plugin. Metadata, structured data, feeds, the sitemap and robots.txt are all generated from the same config and note frontmatter you already fill in.

## Set your origin first

Everything absolute on the site is built from one value: canonical URLs, hreflang alternates, sitemap entries, RSS guids, and the `metadataBase` that resolves Open Graph image URLs.

Precedence is `seo.siteUrl` in `site.config.ts`, then `NEXT_PUBLIC_BASE_URL` in the environment, then `http://localhost:3000`. Config beats environment, which is the right way round for an explicit setting, but it also means a placeholder in config makes the environment variable inert. That is why `siteUrl` ships commented out.

A production build whose origin resolves to `https://example.com`, `https://your-domain.com` or the localhost fallback prints a warning once.

## Per-page metadata

Every page gets a canonical URL, `hreflang` alternates, Open Graph tags and a Twitter card. Notes add `article:published_time`, `article:modified_time`, an author and keywords from `tags`.

`hreflang` is emitted only for the locales a page actually exists in. A note written only in Ukrainian does not claim English and German alternates pointing at 404s. This matters more than it sounds: Google requires hreflang to be reciprocal, so a cluster containing a dead URL is discarded outright, which would throw away the annotations for the notes that were properly translated.

A note with `noindex: true` in its frontmatter gets `robots: { index: false, follow: true }`, and drops out of the sitemap and the feed. The page still builds and is still linked from the index.

## Structured data

JSON-LD is emitted server-side, with no client cost.

| Page | Nodes |
|:---|:---|
| Every page | `WebSite`, plus `Person` or `Organization`. |
| Landing | `BreadcrumbList`, `ItemList` of the featured notes. |
| Note index | `BreadcrumbList`, `CollectionPage`. |
| Note | `BreadcrumbList`, `Article`. |

`Organization` replaces `Person` when you set `seo.organization`. Optional extensions to the `Article` node, driven by `agents.schema`, are covered in [Agents and AI surfaces](agents.md).

## Social cards

Three routes generate images at 1200x630 through `next/og`: one for the site, and one each for the Open Graph and Twitter card of every note. A note's `ogImage` frontmatter overrides the generated card, and `seo.defaultOgImage` is the static fallback.

`/icon` generates the favicon, and the web app manifest points at it.

If your titles are not Latin, set `seo.ogFont`:

```ts
seo: { ogFont: { path: 'public/fonts/NotoSansJP.ttf', name: 'Noto Sans JP' } }
```

`next/og` bundles a Latin subset, so without this a Japanese, Korean, Chinese, Arabic or Hebrew title renders as empty boxes on every social card, and the build succeeds without saying anything. It is not a default because covering CJK means tens of megabytes most sites would never use.

## Sitemap

`/sitemap.xml` lists the landing page and the note index for every locale, then every note, each with `xhtml:link` alternates for the locales it exists in.

Excluded: notes with `noindex: true`, and anything matching `seo.noindexPaths`.

## Feeds

`/<locale>/feed.xml` is an RSS 2.0 feed per locale, containing the notes that have a `date` and are not `noindex`, with a `media:content` element for the cover image where there is one. The feed's title is the owner's name, suffixed with the locale code on non-primary locales.

Notes without a date are absent by design. A feed is chronological, and an undated hub note has no place in it.

## robots.txt

`/robots.txt` is generated rather than a static file, because it carries directives Next's own serialiser drops.

It contains a `Sitemap` and `Host` line, a wildcard group, and one group per AI crawler that has a stance. Rules from `seo.noindexPaths` are written both bare and expanded across every configured locale, since `Disallow` is a prefix match from the site root and a bare `/notes/graph` would never match `/en/notes/graph`.

Out of the box the AI training group is blocked and everything else is allowed. `Content-Signal: search=yes, ai-train=no` is stated in every group. The reasoning, the groups, and how to change any of it are in [Agents and AI surfaces](agents.md).

One thing to expect: Lighthouse reports `robots.txt is not valid`, one error per `Content-Signal` line. Its validator only knows the five directives Google documents, and the Content Signals policy is newer than that. RFC 9309 requires unrecognised lines to be ignored, so the file is correct and every real parser treats it that way, but the audit is pass or fail and it costs roughly eight points on the SEO category.

The signal cannot be switched off from config. `contentSignals` lets you change what it says, and an omitted key states no preference on that use, but `search` and `ai-train` both have defaults, so robots.txt is never silent on training. Removing the directive means editing `resolveContentSignals` in `src/lib/agents/contentSignals.ts`.

## Noindex paths

```ts
seo: { noindexPaths: ['/notes/graph'] }
```

Entries are unprefixed, the way you think about your own routes, and expanded across locales when robots.txt is written. The default is `['/notes/graph']`, because the graph page is a navigation surface with no text of its own.

## What is deliberately absent

There is no `changefreq` or `priority` tuning surface, no keyword configuration beyond note `tags`, and no meta description on pages that have nothing to describe. The garden index takes its description from the first paragraph of `content/garden/<locale>.md` rather than from a shipped default, because a template's boilerplate description is the same string on every fork of it.
