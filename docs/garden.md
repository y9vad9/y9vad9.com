# The garden

The garden is everything under `/<locale>/notes`. It is a three-panel reading workspace rather than a blog archive: a file tree and search on the left, a tabbed note view in the middle, and per-note tools on the right.

## The index

`/<locale>/notes` opens with whatever you wrote in `content/garden/<locale>.md`, and works down from there.

First comes "Start here", the notes marked `pinned: true`. A pin means "read this now", which is why the index leads with them: they need no traversal.

Then topic cards, built from the notes marked `epic: true`. An epic is the other thing, a durable hub you traverse, and each card links into the full list filtered to that topic.

Then a row of action cards configured by `garden.actions`. The three built-ins open the global graph, jump to a random note and copy the feed URL. [Configuration](configuration.md) covers adding your own.

Then the full list, which is filterable and sortable.

### Filtering

Filters are multi-select and live in the URL as repeated `?parent=` parameters, so `?parent=Kotlin&parent=Backend` is a link you can share or bookmark. Selecting a chip rewrites the query string through the History API rather than navigating, so the page does not reload.

A series collapses into a single card so a twelve-part course does not bury everything else in the list. The collapsed card carries the union of every member's parents, which means filtering by a topic that only the seventh instalment belongs to still surfaces the series.

Sorting offers newest first, oldest first, and name ascending or descending. Undated notes sort last under both date orders rather than clumping at whichever end an empty value lands on.

## Tabs

Opening a note adds a tab. Tabs cover notes, the index, and the graph page, they survive navigation, and each one restores its own scroll position when you come back to it.

## The explorer panel

Two modes. `e` shows a tree of your notes, grouped the way the vault is.

`f` is full-text search. In a server build it calls `/api/search`, which walks the raw text of every note and returns up to eight occurrences per note, each with a snippet around the match and the offsets to highlight. In a static build the same search runs in the browser against the pre-built index. Selecting an occurrence opens the note at that hit and scrolls to it.

## The tools panel

Four modes. `t` is the table of contents, listing every heading h1 through h6 and tracking the one you are reading. `s` is the series the note belongs to, with previous and next. `g` draws the note's immediate neighbourhood in the graph.

`l` shows what this note points at and what points back. Outgoing links appear in the order you wrote them, so the panel matches the reading order. External links show the bare URL unless you enable `links.fetchExternalTitles`.

The series tab falls back to the table of contents when the open note is not part of a series.

Both panels collapse, and drag to any width between 180 and 400 pixels. State persists, and both open by default on desktop the first time you visit.

## Backlinks and mentions

Below a note body sit two lists.

Linked mentions are the notes that link here, plus the notes that name this one as a `parent`. Frontmatter parentage counts as a link because a child names its parent in frontmatter rather than in the body, and without that an epic would report zero backlinks while every one of its children pointed straight at it.

Unlinked mentions are notes whose text contains this note's title without linking it, which is a good way to spot connections you meant to make.

Related notes, two of them, are chosen by shared parents: ranked first by how many parents overlap, then by date.

## The graph

Three things become edges: an internal link from one note to another, a `parent` whose name matches an existing note's title, and an unlinked mention, meaning one note's text contains another's title. Titles shorter than three characters are skipped, since they match everything. External URLs contribute nothing. The result is rendered as a force-directed canvas.

`/<locale>/notes/graph` is the whole thing, full page. The tools panel shows the local view: the open note, everything one hop away, and only the edges that touch the centre. Edges between two neighbours that avoid the centre are dropped deliberately, because they make a side-panel view look like a clump while saying nothing about this note's own relationships.

A note with no relations shows a sentence rather than a lone dot floating in the panel, which reads as a broken graph.

On desktop, hovering a node labels it. On touch, a long press does the same thing.

The graph page is in `seo.noindexPaths` by default, so it stays out of the sitemap and asks search engines to skip it. It is a navigation surface with no text of its own.

## The command palette

Opens on `/` or a double tap of `Shift`, and closes on Escape. It is the answer to "I know the garden can do this and I do not remember where it lives".

It searches notes fuzzily across title, preview and parents, weighted in that order. A multi-word query has to match every word, and results that match all of them rank first. Type `parent:kotlin` to filter, and stack filters freely: `coroutines parent:kotlin parent:backend`.

Below the notes it lists every garden command as `Scope: Action`, which is the convention Obsidian uses. Knowing where you want to act (the explorer, the tools panel) is enough to find the command without guessing the verb someone picked. Every word you type has to appear somewhere in the label, in any order, so "search notes" finds "Explorer: Search in notes". Command matching is deliberately not fuzzy: a typo that silently runs the wrong action is worse than one that does not come up.

It also switches theme, switches language, jumps home or to the garden, and toggles the keyboard shortcuts.

The palette's open state and query live in the URL as `?search=true&q=<query>`.

## Keyboard shortcuts

| Keys | Action |
|:---|:---|
| `/` or double `Shift` | Open the command palette. |
| `Ctrl`/`⌘` `[` | Toggle the explorer panel. |
| `Ctrl`/`⌘` `]` | Toggle the tools panel. |
| `Ctrl`/`⌘` `\` | Close the active tab. |
| `e` | Explorer, files. |
| `f` | Explorer, search. |
| `t` | Tools, contents. |
| `s` | Tools, series. |
| `l` | Tools, links. |
| `g` | Tools, graph. |

Modifier chords fire while you are typing, because nothing wants `⌘[` in a text field. Bare letters do not, since they would eat every `e` and `f` you type into the search box.

The bare-letter shortcuts can be turned off, from the palette by a reader or by `shortcuts: { enabled: false }` for the default. They are a nuisance in a screen reader's browse mode and on switch devices, where stray letter keys reach the document and start moving panels around. Disabling also removes those commands from the palette, so nothing advertises a key that no longer works.

Chords are shown in the palette beside each command, and rendered as `⌘` on macOS and `Ctrl` everywhere else.

## Reading a note

A progress bar tracks how far through you are. Code blocks carry a language label and a copy button. Images open in a lightbox on click, closed with Escape or a click outside. Wiki links show a preview card of the target note on hover. Headings have anchors.

Comments render below all of that when `comments.provider` is set to `giscus`.
