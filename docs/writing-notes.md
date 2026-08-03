# Writing notes

Notes are Markdown files with YAML frontmatter, one per page, under `content/notes/<locale>/`.

## Where files go

```
content/notes/
  en/
    deep-modules.md
    permanent/
      software-design.md
    _scratch/
      half-finished.md      not published
  uk/
    deep-modules.md
```

The loader reads the locale folder recursively. The slug is the filename with `.md` removed, so folders organise your source without appearing in any URL: `permanent/software-design.md` serves at `/en/notes/software-design`. Move a file between folders and its URL does not change.

Because slugs are flat, two files sharing a name in different folders would collide. That is a build error naming both files rather than a silent pick.

Any path segment beginning with `_` is skipped, which is the convention most static generators use for partials and scratch space.

Locale folders are independent. A note that exists in `en/` and not in `uk/` simply is not part of the Ukrainian site, and hreflang alternates are emitted only for the locales that actually have it.

## Frontmatter

```markdown
---
title: Understanding Kotlin coroutines
preview: Suspend functions, scopes and context dispatchers, from the beginning.
date: 2024-03-01
updated: 2024-06-12
parents: [Kotlin, Backend]
tags: [concurrency, jvm]
series: Kotlin coroutines
order: 1
coverImage: ./cover.png
pinned: false
epic: false
archived: false
draft: false
noindex: false
description: A longer, SEO-specific description.
author: Someone Else
ogImage: /images/custom-card.png
---
```

Every field is optional. A note with no frontmatter at all still builds: the title falls back to the slug and the preview to an empty string.

### Content and navigation

| Field | Type | What it does |
|:---|:---|:---|
| `title` | string | Page heading, tab label, wiki-link target. Defaults to the slug. |
| `preview` | string | Card blurb, and the meta description unless `description` is set. |
| `parents` | string[] | The axis the garden navigates on. Groups notes on the index, fills the filter chips, and renders as parent links in the tools panel. |
| `tags` | string[] | Free-form keywords. Feed `keywords` meta, JSON-LD and the Markdown mirrors, but drive no navigation. |
| `series` | string | Groups notes into an ordered sequence with previous and next links. |
| `order` | number | Position within the series. |
| `date` | date | Publication date. Notes without one sort last under either date order. |
| `updated` | date | Rendered as "Updated" beside `date`. |
| `coverImage` | string | Header image. See below. |

Dates are read as calendar days in UTC, so a note dated `2024-03-01` shows as 1 March regardless of the reader's timezone.

`parents` and `tags` are worth separating deliberately. Parents are structure, and a note listed under three parents appears in three places in the index. Tags are description, and nothing navigates by them.

### Flags

| Field | What it does |
|:---|:---|
| `pinned` | Leads the note index under "Start here". For a note worth reading now. |
| `epic` | Marks the note as a topic hub, highlighted in the index's category cards. For a note worth traversing. |
| `archived` | Shows an "archived" badge. The page is still built, listed and indexed. |
| `draft` | Kept in the repository, off the site entirely. |
| `noindex` | Built and listed, but dropped from the sitemap, the feed, and search engines. |

`draft` is filtered at the repository boundary, which is the one choke point every consumer already passes through: the note list, the graph, the search index, the sitemap, the feed, the Markdown mirrors and static path generation. A filter per consumer is how one gets forgotten, and the one that forgets publishes the note.

To read your own drafts while writing:

```bash
ONVU_DRAFTS=1 npm run dev
```

### Metadata overrides

| Field | What it does |
|:---|:---|
| `description` | Meta description, overriding `preview`. |
| `author` | Byline, overriding `owner.name`. |
| `ogImage` | Social card, absolute path or URL, overriding the generated one. |

## Markdown

Everything GitHub Flavored Markdown supports works: tables, task lists, strikethrough, autolinks and footnotes.

Code is highlighted by Shiki, picking `github-light` or `github-dark` from the current palette's polarity. Fenced blocks get a language label and a copy button.

Maths goes through KaTeX, as `$inline$` and `$$block$$`.

A ```` ```mermaid ```` fence becomes a diagram. Those render on the client at view time, so the source never goes through the syntax highlighter on the way.

Every heading, h1 through h6, gets an anchor and a place in the table of contents.

External links open in a new tab with `rel="noopener noreferrer"` and carry an arrow glyph.

Embedded iframes are lazy-loaded unless you write your own `loading` attribute. A pasted YouTube embed is usually the most expensive thing in a note, and deferring it keeps a video player off the critical path without changing anything about what happens when the reader scrolls to it.

## Obsidian syntax

The template is built to read an Obsidian vault without preprocessing.

| Syntax | Result |
|:---|:---|
| `[[Deep Modules]]` | Link resolved against slugs first, then titles, both case-insensitively, then a form that folds whitespace to hyphens. |
| `[[Deep Modules\|see this]]` | Link with alias text. |
| `[[Missing Note]]` | Still an anchor, styled as broken so you can spot it. |
| `![[diagram.png]]` | Embedded image, resolved against the note's own folder. |
| `![[diagram.png\|300]]` | Same. The size hint is dropped rather than used as alt text. |
| `![[Some Note]]` | A plain link. Note bodies are not transcluded. |
| `%%a private aside%%` | Stripped before anything sees it. |
| `> [!note] Title` | A callout. |

Comments are removed on the parsed document before any other plugin runs, so they reach neither the page, the search index, nor the Markdown mirrors. That matters more than it looks: `%%...%%` is where people park half-formed opinions and the names of real colleagues.

Callouts render as a blockquote carrying `data-callout="<type>"`, plus `data-callout-title` when you write one. The accent colour comes from a single custom property, so four families of type name are recognised and anything else still looks deliberate rather than unstyled:

| Accent | Types |
|:---|:---|
| Green | `tip`, `hint`, `success`, `check`, `done` |
| Amber | `warning`, `caution`, `attention` |
| Red | `danger`, `error`, `bug`, `failure` |
| Your primary colour | `note`, `info`, `todo`, `question`, `example`, `abstract`, `summary` |

Emitting a blockquote rather than a bespoke element means a callout degrades to an ordinary quotation wherever the stylesheet is absent, including RSS, reader modes and the Markdown mirrors. Obsidian's fold markers (`+`, `-`) are recorded as an attribute but not acted on, because a collapsed-by-default block hides content from readers who never find the affordance, and from find-in-page.

A bare Markdown link whose target has no slashes, dots, protocol or fragment is treated as a wiki link too, so `[the deep modules idea](deep-modules)` resolves the same way. Note that `[text](Two Words)` is not valid Markdown at all, since CommonMark forbids spaces in an inline link's URL. Write `[[Two Words]]` instead.

## Images

Reference an image the way you would in any Markdown editor, and the build takes care of the rest:

```markdown
![A build pipeline sketch](./diagram.png)
![Something in a shared folder](assets/screenshot.png)
![Something already published](/images/banner.jpg)
```

Relative paths resolve against the directory containing the `.md` file, so a note in `permanent/` referencing `./diagram.png` means the copy in `permanent/`. Site-absolute paths under `/images/`, `/notes-assets/` or `/notes/<locale>/attachments/` go through the same encoder, so a cover image and a body image pointing at the same file share one output on disk.

At build time each image is resized across a ladder of widths (256, 384, 512, 640, 768, 896, 1024, 1280, 1536, 1920, 2560), capped at the source width so nothing is upscaled, encoded to WebP, and written under `public/notes-assets/` with a content-hashed filename. The `<img>` gets `srcset`, `sizes`, intrinsic `width` and `height`, `loading="lazy"` and `decoding="async"`.

`public/notes-assets/` is git-ignored. Keep your originals in `content/` and never commit build output.

Clicking a body image opens it in a lightbox, closed with Escape or a click outside.

### Cover images

`coverImage` in frontmatter takes a co-located relative path, a site-absolute path in one of the buckets above, or an external URL. External URLs and anything that cannot be optimised (an SVG, a missing file, an unknown bucket) are left exactly as written, so your intent survives even when the pipeline cannot help.

### Inline images

Append `?inline` to make an image flow with the surrounding text at roughly the size of a glyph, which is what you want for a reaction GIF or a small badge:

```markdown
That went about as well as ![](/images/shrug.gif?inline) you would expect.
```

The marker is stripped from the URL, the image is pulled out of the paragraph Markdown would otherwise wrap it in, and responsive variants are skipped since the CSS pins its height. Inline images never open a lightbox.

### Carousels

A table whose data cells each contain exactly one image and nothing else becomes a horizontally scrolling strip:

```markdown
| | | |
|---|---|---|
| ![One](./a.png) | ![Two](./b.png) | ![Three](./c.png) |
```

Carousel images are pinned to a fixed height, and because the build knows each one's aspect ratio it declares the real rendered width in `sizes` rather than the body-image approximation. That is the difference between pulling an 800px variant for a 165px slot and pulling the right one.

### Self-linked images

Image galleries exported from editors often produce `[![](x.png)](x.png)`, an image linked to itself. That wrapper is removed. On a site that rewrites image URLs it is actively broken: the `src` becomes the generated asset path while the `href` keeps pointing at a raw attachment that was never published, guaranteeing a 404 on every click. It also hides the image from the carousel detector and swallows the click that would open the lightbox.

A deliberate link, `[![](thumb.png)](https://example.com)`, is left alone.

## Video

Markdown has no video syntax, so write videos as images and the pipeline adapts:

```markdown
![A short demo](./demo.mp4)
```

Anything ending in `.mp4`, `.webm`, `.mov`, `.m4v`, `.ogg` or `.ogv` becomes a `<video controls>` with a typed `<source>`. Relative paths are copied and published like images; absolute and external URLs are used as written.

Videos are emitted with `preload="none"`. Chrome implements a metadata preload as a full request it aborts once it has the header, followed by a ranged re-request, which costs real bytes on every page view whether or not anyone presses play. The layout does not need the metadata either, because the CSS pins a 16:9 box, so nothing shifts when the video finally loads.

## Series

Give several notes the same `series` value and an `order`, and each gets previous and next navigation plus a series list in the tools panel. On the note index, a series collapses into one card so a twelve-part course does not bury everything else.

```markdown
---
title: Suspend functions
series: Kotlin coroutines
order: 2
parents: [Kotlin]
---
```

## Sorting

Lists that offer a sort control accept newest first, oldest first, and name ascending or descending. Notes without a date sort last under both date orders rather than clumping at whichever end an empty value lands on, because hub notes routinely have no date and burying them above everything on "oldest first" reads as a bug.
