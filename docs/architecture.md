# Architecture

You do not need this page to run a site. It is here for anyone changing `src/`, or trying to work out where something happens.

## Layout

```
src/
  core/          domain model and use cases, no framework imports
  adapters/      implementations of the core's ports
  app/           Next.js App Router routes
  components/    React components, grouped by surface
  lib/           shared utilities: markdown, images, SEO, agents, theme
  hooks/         React hooks
  store/         Zustand stores
  config/        the SiteConfig type and the navigation schema
  i18n/          next-intl routing and request configuration
```

`core/` is deliberately free of Next, React and filesystem imports. It defines the model (`Note`, `Heading`, `MentionGraph`, `SearchIndexEntry`), the `NoteRepository` port, and the use cases that operate on them: `ListNotes`, `GetNote`, `GetMentions`, `GetRelatedNotes`, `GetSeriesNavigation`, `GetCategories`, `BuildMentionGraph`, `BuildLocalGraph`, `BuildSearchIndex`.

`SearchPort` and `GraphPort` are also declared there, but nothing implements or consumes them today. Search and graph data are built by the use cases directly and served either from an API route or from a pre-built snapshot.

`adapters/` implements the repository port. `fs/FileSystemNoteRepository` is the only one production uses; `memory/MemoryNoteRepository` exists for tests. `static/StaticBuildEmitter` and `static/AgentArtifactEmitter` write build-time artifacts.

Repositories are locale-scoped. Each locale gets its own instance with its own slugs, its own wiki-link resolution and its own mention graph, so a note existing in English and not in Ukrainian is simply absent from the Ukrainian site rather than being a broken link.

## Path aliases

`@core/*`, `@config/*`, `@adapters/*`, `@components/*`, `@hooks/*`, `@store/*`, `@lib/*`, `@i18n/*`, plus `~/site.config`, `~/site.*.config` and `~/content/*`.

They are declared in three places that have to agree: `tsconfig.json` for the compiler and the editor, a webpack alias in `next.config.ts` for `~`, and `vitest.config.ts` for tests.

## Routes

| Route | What it is |
|:---|:---|
| `/<locale>` | Landing page. |
| `/<locale>/notes` | Garden index. |
| `/<locale>/notes/<slug>` | A note. |
| `/<locale>/notes/graph` | Full-page graph. |
| `/<locale>/feed.xml` | RSS. |
| `/notes/<slug>` | Client-side redirect to a locale-prefixed note. |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/icon` | Generated. |
| `/opengraph-image` | Site social card. |
| `/<locale>/notes/<slug>/opengraph-image`, `/twitter-image` | Per-note social cards. |
| `/api/search`, `/api/search-index`, `/api/graph` | Server mode only. Their files are `route.node.ts`, which `pageExtensions` treats as a route everywhere except a static build. |

No page is generated at `/`. In a server build the middleware redirects it to a locale; in a static export a generated `_redirects` rule does the same job. See [Deployment](deployment.md).

`<html>` is rendered by `components/shell/Document.tsx`, not by the root layout. Next allows exactly one `<html>` in a tree, and the root layout sits above `[locale]` where it has no way to know which language it is wrapping, so it passes through and `Document` is rendered by `[locale]/layout.tsx` and by the two routes outside that segment.

## The markdown pipeline

`lib/mdx/pipeline.ts` builds one unified chain per note. Order is load-bearing, and the file says why at each step. In outline:

On the parsed Markdown, Obsidian comments are stripped first so nothing downstream can see them, then GFM, maths and callouts, then wiki links.

Crossing to HTML, self-linked image wrappers are unwrapped before any plugin rewrites a `src`, since the check compares `href` against the authored value. Inline-image markers are read next so the image resolver sees a clean URL. Videos run before images, or Sharp would try to decode an mp4. Images resolve last of the three.

Then heading ids, heading extraction (before autolinking injects a `#` into the text), autolinks, outgoing-link collection, external-link marking, KaTeX, lazy iframes, carousel detection, raw-text capture for the search index, Mermaid extraction, and finally syntax highlighting.

The repository drives this in two passes: read every note's frontmatter first so wiki links can resolve against the full corpus, then process bodies with a resolver wired in.

## Images

`lib/images/encodeResponsive.ts` owns encoding. Sources are resized across a fixed ladder capped at the source width, encoded to WebP, and written to `public/notes-assets/` under a content-addressed name, so an unchanged image is never re-encoded and a changed one gets a new URL.

Three entry points feed it: `processNoteImage` for a path relative to a note, `processStaticImage` for a site-absolute path in a known bucket, and `processNoteVideo` for video, which copies rather than encodes.

## State

Six Zustand stores, all client-side. `panelStore` (open state, widths, active modes, focus requests), `tabStore` (open tabs and the active one), `themeStore`, `searchStore` (palette), `shortcutsStore` (the reader's preference) and `noteContextStore`.

`panelStore`, `themeStore` and `shortcutsStore` persist to `localStorage`. Both panels start closed, and are opened on desktop after mount by an opt-in path, so a phone never gets a flash of open panels.

## Build-time emission

Three emitters write into `public/` during a build, so the export step picks them up when it copies that directory.

`emitHostRedirects` runs from the root layout, alongside `ensureMonoFont`, because the site root belongs to no locale and that layout is the only one guaranteed to run. It writes the `_redirects` rule that sends `/` to the primary locale, on static production builds only.

The other two run from `[locale]/notes/layout.tsx`, the layout every garden route passes through.

`emitStaticData` writes `public/_static/<locale>/{search-index,graph}.json`, gated on the resolved mode being static and the build being production. It reads `NEXT_PUBLIC_ONVU_MODE`, the value `next.config.ts` computed, rather than testing `ONVU_MODE` again, so config and artifact cannot disagree.

`emitAgentArtifacts` writes the Markdown mirrors, `llms.txt` and `_headers`. It covers every locale in one pass rather than accumulating across calls, because Next's page workers are separate processes and each would otherwise see only a slice.

`_headers` and `_redirects` are both files a site owns, so neither is overwritten. `lib/hosting/fencedBlock.ts` handles the shared problem: the generated region is delimited by escaped markers and rewritten in place, and the site's own content is snapshotted the first time so the file can be rebuilt from it rather than appended to. Appending is what broke when page workers ran concurrently, since two of them could each observe a fence-free file and each add a block.

## Testing

```bash
npm test           # vitest, both projects
npm run test:watch
npm run test:e2e   # playwright
npm run typecheck
npm run lint
```

Vitest runs two projects. `node` covers `tests/core`, `tests/adapters`, `tests/lib`, `tests/store`, `tests/app`, `tests/content` and `tests/functions`. `jsdom` covers `tests/hooks`, `tests/components`, and any `lib` test that touches `document`, which opts in through a `.dom.test.ts` suffix.

Both run single-fork, one worker process per project with tests sequential inside it. Slower than fanning out, and deliberate: several suites change the working directory and would fight neighbouring forks for it, and a crash during setup leaves two children to reap rather than one per CPU.

Coverage thresholds are 70% lines, statements and functions, 65% branches, measured over `core`, `lib`, `adapters`, `store`, `hooks` and `components`. `src/app` is excluded, since route files are covered end to end instead.

Playwright specs live in `tests-e2e/specs`: the garden, the command palette, keyboard shortcuts, scroll restoration, themes and the sitemap.

## Adding things

A new field on a note starts in `core/Note.ts`, is parsed in `FileSystemNoteRepository.parseNoteMeta`, and is rendered wherever it belongs. If it should hide a note from the site, filter it at the repository boundary the way `isDraft` does, rather than at each consumer.

A new markdown behaviour is a plugin in `lib/mdx/pipeline.ts`, placed with an explanation of why it sits where it does in the chain.

A new configuration option is a key on `SiteConfig` with a comment explaining the default. Prefer deriving a value over asking for it: writing direction comes from `Intl`, theme polarity from the theme's own `dark` flag, and the list of locales a note exists in from the repositories that are already being read.

A new user-facing string goes in `messages/en.json` and every other `messages/<locale>.json`. Missing translations fall back to the primary locale rather than rendering a key path, so an untranslated string is not urgent, but a missing English one is.
