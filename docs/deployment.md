# Deployment

Onvu builds two ways. Which one you want depends on where it is going.

## Static export

```bash
npm run build:static
```

Produces `out/`, a directory of files you can hand to any CDN: Cloudflare Pages, GitHub Pages, Netlify, S3, a bare nginx.

The script sets `ONVU_MODE=static`, which turns on Next's `output: 'export'` and `trailingSlash`, and disables image optimisation.

A static export cannot contain route handlers, so the API routes have to be absent from the build rather than merely unused. They are named `route.node.ts`, and `pageExtensions` counts that suffix as a route only when the build is not a static one, so the exclusion is configuration rather than anything that touches the filesystem.

Since there is no server to answer them, search and graph data are written at build time to `public/_static/<locale>/search-index.json` and `graph.json`, and the browser bundle fetches those instead of calling the API. `NEXT_PUBLIC_ONVU_MODE` is what tells it which.

## Server

```bash
npm run build
npm start
```

Sets `ONVU_MODE=server`. Route handlers exist, the middleware runs, and search and graph data are computed per request from the filesystem with no pre-build step. Deploy this to Vercel, a container, or anywhere that runs Node.

## Choosing

The `mode` key in `site.config.ts` is the default, and the `ONVU_MODE` environment variable overrides it, which is how the two npm scripts force a mode without editing config. Unset in both places means `server`.

Setting `mode: 'static'` and then running `npm start` will fail, because Next refuses to serve an exported build. The scripts pin the variable for exactly that reason.

`npm run dev` is a third case and belongs to neither. It serves the API routes and does not write the pre-built snapshots, since regenerating them on every hot reload would be unusable, so it runs in server mode regardless of what the target is. Search, the graph and link previews therefore read live data in development and pre-built data in a static deploy, which is the only arrangement in which both are answerable.

## Before you publish

Set your origin, either as `seo.siteUrl` in the config or as `NEXT_PUBLIC_BASE_URL` in the environment. Without it, every canonical URL, sitemap entry, RSS guid and social card URL points at `http://localhost:3000`. A production build warns once when the origin resolves to a known placeholder.

```env
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

That is the only value you have to supply by hand. The rest of this page is about where the output goes.

## The site root

A static export generates `/en`, `/de` and `/uk`, and no page at `/`, because locale negotiation lives in the middleware and a static build has no middleware. The build handles this for you: `npm run build:static` writes `public/_redirects` with a rule sending the root to `locales.primary`.

```
/  /en/  302
```

It is generated rather than committed because the destination follows your primary locale, and a fixed `/en/` would send a Ukrainian site's homepage to a language it may not build. A server build needs none of it, so nothing is written there either.

`_redirects` is yours to add to, and the usual reason is a note you renamed:

```
/en/notes/old-slug  /en/notes/new-slug  301
```

Put your rules above the generated block. Cloudflare Pages and Netlify both run the first matching rule, so anything you write wins, including your own `/` rule if you want a different landing language. The generated block is fenced, rewritten in place on each build, and your content is left alone. The template ships no `_redirects`, so the first static build creates one; commit it once you have rules of your own in it.

One path is deliberately not redirected. `/notes/<slug>` without a locale is a real route that picks a language from the reader's stored preference and their browser settings, which a static rule cannot do.

That is worth knowing before you write a rule for it. A `/notes/*  /en/notes/:splat` line looks like it is covering a gap, but redirect rules run at the edge, ahead of any route, so it replaces the language negotiation with a fixed guess: a reader browsing in German who opens a locale-free note link gets the English one. If you have renamed a note whose unprefixed URL was public, redirect that slug on its own rather than the whole prefix.

## Cloudflare Pages

A workflow ships at `.github/workflows/deploy.yml`. It restores two caches (the Next build cache and `public/notes-assets/`, keyed on your note sources so images are not re-encoded on every run), builds the static export, and publishes with Wrangler.

Set two repository secrets under Settings, Secrets and variables, Actions:

| Secret | Where it comes from |
|:---|:---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard, My Profile, API Tokens, using the "Edit Cloudflare Pages" template. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard, right sidebar on any zone page. |

And one repository variable, on the Variables tab of the same page:

| Variable | Value |
|:---|:---|
| `CLOUDFLARE_PROJECT_NAME` | Your Cloudflare Pages project name. |

Hard-coding the name into the workflow instead is fine. `.github/workflows/**` is `merge=ours`, so whatever you put there survives every sync, and the flip side is that CI improvements stop arriving on their own. See [Upgrading](upgrading.md).

The workflow runs on manual dispatch only. To deploy on every push, uncomment the `push` trigger at the top of the file.

Wrangler's version is pinned in the workflow. Left unset, the action resolves whatever is current at deploy time, which means the tool publishing your site could change under you between two runs of the same commit.

Cloudflare Pages is also the one host where `functions/[locale]/notes/_middleware.ts` does anything: it serves the Markdown mirror to clients that ask for `text/markdown`. See [Agents and AI surfaces](agents.md). Delete `functions/` if you would rather note pages come straight off the edge.

## GitHub Pages and other subpaths

A project site lives at `username.github.io/repo-name/`, not at a domain root. Set the subpath once:

```ts
basePath: '/repo-name'
```

That wires Next's `basePath` and `assetPrefix` together with `NEXT_PUBLIC_BASE_PATH`, which the browser bundle reads for the URLs Next does not prefix by itself: the static search index, the API routes, generated asset paths, the giscus stylesheet. Three places that have to agree should not be three places to edit.

No trailing slash.

## Other hosts

Vercel and Netlify both handle a Node build with no configuration beyond the environment variable. For a container or a VPS, `npm run build` then `npm start`, with a reverse proxy in front.

## Environment variables

| Variable | Where |
|:---|:---|
| `NEXT_PUBLIC_BASE_URL` | Build. Canonical origin. `seo.siteUrl` beats it. |
| `ONVU_MODE` | Build. `static` or `server`, overriding config. |
| `ONVU_DRAFTS` | Build or dev. `1` includes notes marked `draft: true`. |

`NEXT_PUBLIC_ONVU_MODE` and `NEXT_PUBLIC_BASE_PATH` are derived by `next.config.ts` and read by the browser bundle. Setting them yourself will disagree with the build.

## Build output and version control

Three directories are generated and git-ignored: `public/notes-assets/` (encoded images and video), `public/_static/` (the search and graph snapshots), and `out/` or `.next/`. Keep your source images in `content/` and never commit encoded output.

`public/_headers` is deliberately not ignored. The optional agent headers are merged into a fenced block inside a file your site owns, alongside whatever CSP, HSTS and cache rules you keep there, so it needs to be committed.
