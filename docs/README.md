# Onvu documentation

Start with [Getting started](getting-started.md) if the repository is new to you. Otherwise pick what you need.

## Setting up

[Getting started](getting-started.md) walks a fresh clone through to a first published note: install, configure, write, delete the demo content.

[Configuration](configuration.md) is the reference for `site.config.ts`, covering every key, per-locale overrides, and the environment variables that interact with them.

[Deployment](deployment.md) covers the two build modes, the Cloudflare Pages workflow, subpath deployments, and the two things to set before publishing.

## Writing

[Writing notes](writing-notes.md) covers frontmatter, folder layout, everything the Markdown pipeline understands including the Obsidian syntax, and how images and video are processed.

[The garden](garden.md) is the reader's side: panels, tabs, keyboard shortcuts, the command palette, search, and the graph.

## Making it yours

[Customisation](customisation.md) covers the `content/` seams: the landing page, footer, navigation, note slots, and the garden intro.

[Theming](theming.md) covers design tokens, the built-in palettes, and adding your own.

[Localisation](localisation.md) covers adding a language, how messages resolve across four layers, and right-to-left support.

## Publishing

[SEO and metadata](seo.md) covers canonicals, hreflang, structured data, feeds, the sitemap, robots.txt and social cards.

[Agents and AI surfaces](agents.md) covers the opt-in machine-readable layer: Markdown mirrors, `llms.txt`, crawler policy, content signals and WebMCP.

## Working on the template

[Upgrading](upgrading.md) covers pulling from upstream, what `merge=ours` protects, and what it does not.

[Architecture](architecture.md) covers how `src/` is laid out, the markdown and image pipelines, and how to run the tests.
