# Getting started

This walks the first hour with a fresh clone: get it running, make it yours, delete the demo, publish something.

## Clone and run

```bash
git clone https://github.com/y9vad9/onvu.git my-site
cd my-site
git remote rename origin upstream
git remote add origin https://github.com/your-username/my-site.git
npm install
npm run dev
```

Two things about that remote rename. `upstream` is where template updates come from later, and `npm install` runs a `prepare` script that registers the git merge driver protecting your files during those updates. Skip the rename and pulling upstream gets awkward; skip `npm install` and the driver silently does nothing. [Upgrading](upgrading.md) covers both.

The dev server listens on `http://localhost:3000`. It will redirect you to `/en`, the primary locale.

## Make it yours

Open `site.config.ts`. It ships filled in with a fictional person called Alex Rivers, and almost every visible string on the landing page comes from here.

Start with `owner`: your name, handle, avatar path and bio, plus the social links in the header and hero. Any platform name is accepted, and the icon is looked up for the well-known ones. Then `home`, which holds the work history, project list and education entries the landing page renders. Then `pwa`, which becomes the web app manifest.

`navigation.featuredNotes` is an array of note slugs shown as large cards on the landing page, and the other four keys under `navigation` point at the notes behind the "work experience", "projects", "education" and "summary" links. All five refer to notes that must exist, so change them when you change the notes.

Leave `seo.siteUrl` commented out until you know your production origin. It beats the `NEXT_PUBLIC_BASE_URL` environment variable, which means a placeholder left in there makes the variable inert and points every canonical URL, sitemap entry and RSS guid at the wrong domain. A production build warns when the origin is one of the known placeholders, but it cannot tell that a plausible-looking domain is the wrong one. [Configuration](configuration.md) documents every key.

## Write a note

Notes are Markdown files under `content/notes/<locale>/`. Create `content/notes/en/hello.md`:

```markdown
---
title: Hello
preview: The first note.
date: 2026-01-15
parents: [Meta]
---

This is a note. It can link to [[Another Note]] by title or slug.
```

It appears at `/en/notes/hello` and in the index at `/en/notes`. The filename is the slug, so subfolders organise your source without changing any URL.

`parents` is the axis the garden navigates on: it groups notes on the index, drives the filter chips, and forms the parent links in the tools panel. `preview` is the card blurb and the fallback meta description.

[Writing notes](writing-notes.md) covers the full frontmatter set and everything the Markdown pipeline understands.

## Delete the demo

The template ships working example content so that a fresh clone shows a real site rather than empty panels. None of it is load-bearing.

| Path | What it is |
|:---|:---|
| `content/notes/en/*.md` | Sixteen demo notes, including `template-reference.md`. |
| `content/notes/en/sample-colocated.png` | The co-located image `template-reference.md` embeds. |
| `public/images/sample-*.svg`, `sample-architecture.svg`, `template-reference-cover.svg` | Illustrations for the demo notes. |
| `public/profile.svg` | Placeholder avatar, referenced by `owner.profileImage`. Replace it rather than deleting it, or point that key somewhere else. |
| `public/images/og-default.svg` | A social card placeholder nothing currently references. Point `seo.defaultOgImage` at it, or delete it. |

`content/notes/en/template-reference.md` is worth keeping until you are done setting up. It exercises every renderer in one page (wiki links, KaTeX, Mermaid, carousels, footnotes, code highlighting) and ends with a checklist, so it is the fastest way to confirm a build is intact. Delete it once it stops telling you anything.

Do not delete `content/garden/README.md`. It is instructions, and it is never rendered.

## Write the garden intro

`content/garden/<locale>.md` renders at the top of that locale's note index, above the pinned notes. It is ordinary Markdown, and relative image paths resolve against that directory.

There is no default. A locale without a file gets no intro, which is deliberate: a generic sentence shipped by the template would stand in for your voice on every fork of it. The file's opening paragraph also becomes the index's meta description, so writing one is worth the minute.

## Build it

```bash
npm run build:static
```

That produces `out/`, a directory you can hand to any CDN. Use `npm run build` instead if you are deploying to a Node server. The two differ in more than the output directory, and [Deployment](deployment.md) explains where.

One thing to do before you publish: set your production origin, either as `seo.siteUrl` in the config or as `NEXT_PUBLIC_BASE_URL` in the environment. Without it every absolute URL in the sitemap and feed points at `localhost:3000`. [Deployment](deployment.md) covers that and the rest of the hosting story.

## Where things live

| Path | Yours or the template's |
|:---|:---|
| `site.config.ts`, `site.<locale>.config.ts` | Yours. |
| `content/` | Yours, all of it. |
| `messages/` | The template's. Override from `content/i18n/` instead. |
| `src/` | The template's. Changing it means merge conflicts forever. |
| `public/` | Shared. You add files; the template owns `notes-assets/` and `_static/`. |

That split is enforced by `.gitattributes` and explained in [Upgrading](upgrading.md). The short version: keep your edits in `content/` and `site*.config.ts` and upstream updates stay boring.
