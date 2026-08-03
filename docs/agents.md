# Agents and AI surfaces

Everything under `agents` in `site.config.ts` is off by default, apart from the crawler policy. Publishing your writing in an agent-friendly form is a choice, and plenty of authors would rather not.

## What this is and is not for

It is not an SEO lever. Google states plainly that you "don't need to create new machine readable files, AI text files, markup, or Markdown to appear in Google Search", and that such files "neither harm nor help your site's visibility" because Search ignores them. Measured crawler logs also show the major AI crawlers overwhelmingly skipping `/llms.txt` in favour of fetching HTML.

What it does help is agents that fetch your page at request time: coding agents, ChatGPT and Claude browsing, `Perplexity-User`. Those pay tokens for your navigation chrome and get nothing from it. A Markdown mirror is markedly cheaper for them to read, and the structured-data options describe relationships (series membership, mentions) that the site already computes and never expressed in machine-readable form.

## The default: crawl me, cite me, do not train on me

Two things are on without any configuration, and they are the only opinion the template holds on your behalf.

The AI training group is blocked in robots.txt, and `Content-Signal: search=yes, ai-train=no` is stated in every group.

Blocking the training group costs nothing you would otherwise have. Every token in it exists to collect training corpora, and none is a search crawler. `Google-Extended` is a robots.txt control token that Google says "does not impact a site's inclusion in Google Search nor is it used as a ranking signal". OpenAI and Anthropic each run separate search crawlers, `OAI-SearchBot` and `Claude-SearchBot`, which this policy still allows.

One line opts back in:

```ts
agents: { crawlers: { training: 'allow' } }
```

## Crawler policy

Crawlers are grouped by what blocking one actually costs you, because "AI crawler" covers three jobs with very different consequences and you cannot tell which is which from the name.

| Group | What it does | Cost of blocking |
|:---|:---|:---|
| `training` | Collects corpora for model training. | Nothing in any search product. |
| `aiSearch` | The retrieval index AI answers cite. | Removes you from AI answers. |
| `userTriggered` | A fetch because someone just asked about your page. | Mostly theoretical. OpenAI and Perplexity both document that these largely ignore robots.txt, since a human initiated the request. |

Only `training` has a default. Blocking `aiSearch` is a real trade the template will not make for you, and a rule for `userTriggered` is a stated preference rather than a control.

The tokens currently grouped:

| Group | Tokens |
|:---|:---|
| `training` | `GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`, `Applebot-Extended`, `Meta-ExternalAgent`, `Amazonbot`, `Bytespider` |
| `aiSearch` | `OAI-SearchBot`, `Claude-SearchBot`, `Google-CloudVertexBot`, `PerplexityBot`, `DuckAssistBot` |
| `userTriggered` | `ChatGPT-User`, `Claude-User`, `Perplexity-User` |

The ten OpenAI, Anthropic, Google and Perplexity tokens were checked against those vendors' own documentation, and `AI_CRAWLERS` marks them `verified`. The remaining six are widely documented but unconfirmed there. A mistyped token is inert rather than harmful, but do not treat an unverified entry as a guarantee.

`Googlebot` and `Bingbot` are absent from every group and no configuration can produce a rule for them. They are ordinary search crawlers, and blocking them would delist you entirely.

For a crawler the template does not know about, or to carve one vendor out of its group:

```ts
agents: {
  crawlers: {
    training: 'block',
    aiSearch: 'allow',
    overrides: { CCBot: 'allow', SomeNewBot: 'block' },
  },
}
```

Every emitted group restates the site-wide `Disallow` rules. That repetition is load-bearing: robots.txt groups are not merged, so a crawler obeys the most specific group naming it and ignores the wildcard entirely. A bare `User-agent: GPTBot / Allow: /` would quietly hand that one crawler the paths everything else is kept out of.

## Content signals

A different axis from crawler rules, and mixing the two up is the usual mistake. `Disallow` is an access control, meaning do not fetch this. A content signal is a use preference, meaning you may fetch it, and here is what you may do with it afterwards. A site can reasonably allow the fetch and still refuse training, which is why these are not derived from the crawler policy.

```ts
agents: {
  contentSignals: {
    search: true,    // index it, link it, quote a snippet
    aiInput: true,   // ground an AI answer in it
    aiTrain: false,  // do not train on it
  },
}
```

Omitting a signal is meaningful. Per the policy, an absent signal "neither grants nor restricts permission", so an unset key is left out of the line rather than written as `no`.

`search` defaults to yes and `aiTrain` to no. `aiInput` is deliberately unset, because whether an AI may ground an answer in your writing is a genuine preference rather than a safe assumption. Cloudflare made the same call on managed robots.txt files.

Like every robots.txt directive, this is declarative. It records a preference in a machine-readable place. It enforces nothing.

See [SEO and metadata](seo.md) for the Lighthouse audit this trips, and why the file is nonetheless correct.

## Markdown mirrors

```ts
agents: {
  markdown: {
    enabled: true,
    resolveWikilinks: true,
    include: {
      frontmatter: true,
      parents: true,
      series: true,
      backlinks: true,
      outgoing: true,
      relatedNotes: true,
    },
  },
}
```

Emits `/<locale>/notes/<slug>.md` beside every note page, generated at build time into `public/` (and git-ignored).

`resolveWikilinks` rewrites `[[Wiki Links]]` to absolute URLs and is on by default whenever mirrors are. An agent cannot follow `[[deep-modules]]`, so a mirror that keeps the raw syntax is half a document. Turn it off to publish the source byte for byte.

Every `include` flag is off except `frontmatter`, which carries the title, dates, tags and canonical HTML URL. The rest add context the site already computes: parents resolved from names to links, series position with sibling links, incoming links, outgoing links, and notes sharing a parent or tag.

## llms.txt

```ts
agents: { llmsTxt: { enabled: true, full: false } }
```

`/llms.txt` is a flat map of the site, grouped by locale so an agent can pick a language without fetching anything, with each entry pointing at the Markdown mirror where one exists. `full: true` additionally writes `/llms-full.txt` with every note body inlined, for agents that would rather make one request than N. That file can get large.

Both are shipped as cheap insurance and for agents a reader points at the site by hand, not as a ranking lever.

## Discovery

```ts
agents: {
  discovery: {
    linkAlternate: true,
    jsonLdEncoding: true,
    emitHeadersFile: false,
  },
}
```

`linkAlternate` adds `<link rel="alternate" type="text/markdown">` to each page's head, the same mechanism RSS autodiscovery has used for twenty years. Invisible to readers, and it means an agent never has to guess the `.md` URL.

`jsonLdEncoding` adds schema.org `encoding` to the Article node, pointing at the mirror. `encoding` is defined as "a media object that encodes this CreativeWork", which is exactly what a mirror is.

Both are on by default once mirrors are enabled, and both are gated on mirrors existing, because advertising one that does not is a dangling link.

`emitHeadersFile` writes a Netlify or Cloudflare Pages `_headers` file doing three jobs. It sets `Content-Type: text/markdown` so hosts serve mirrors inline instead of as a download. It sets `X-Robots-Tag: noindex` so the mirrors do not compete with your HTML as duplicate URLs, which costs nothing since Google ignores Markdown by its own account, and never blocks a live agent fetch. And it adds RFC 8288 `Link` headers so an agent can discover `llms.txt` and a page's mirror from a `HEAD` request without parsing HTML.

`_headers` is a file sites already own, typically carrying CSP, HSTS and cache policy, so the generated rules are merged into a fenced block rather than overwriting it. Your own rules are left alone.

## Structured data extensions

```ts
agents: {
  schema: {
    series: true,
    mentions: true,
    definedTerms: true,
    citations: true,
    knowsAbout: true,
  },
}
```

| Flag | Adds |
|:---|:---|
| `series` | `isPartOf` a `CreativeWorkSeries` with `position`, from `series` and `order`. |
| `mentions` | `mentions`, from the wiki-link graph. |
| `definedTerms` | `DefinedTerm` and `DefinedTermSet`, treating the garden as a glossary. |
| `citations` | `citation`, from outbound external links. |
| `knowsAbout` | `Person.knowsAbout`, aggregated from note tags. |

These describe relationships the site already knows about. They are not a citation lever.

## WebMCP

```ts
agents: { webmcp: { enabled: true } }
```

Registers three tools on `document.modelContext` for an AI agent running inside the reader's browser: `search_notes`, `list_notes` and `get_note`.

Read the trade before enabling it. Every capability it exposes is already available to any agent over plain HTTP through `llms.txt` and the mirrors, with no browser and no flag involved. WebMCP earns its keep on sites with actions an agent cannot perform by fetching, such as adding to a cart, filtering a table, or submitting a form. A reading-only garden has none of those.

It is also a moving target. `provideContext()` was removed in March 2026 in favour of `registerTool()`, and the entry point moved from `navigator.modelContext` to `document.modelContext` in Chrome 150. Registration probes for what the browser exposes rather than assuming a shape, so a browser that moves on again produces silence rather than a broken page. You are opting into churn for a modest gain.

## Content negotiation on Cloudflare Pages

`functions/[locale]/notes/_middleware.ts` answers `GET /en/notes/kotlin/` with the Markdown mirror when the request carries `Accept: text/markdown`, and with the HTML otherwise. This is the one agent-facing behaviour a static export cannot produce by itself, because a file server answers per URL while negotiation is per request.

The directory's presence is the switch. There is no config flag, because the file existing is what makes Cloudflare route those paths through a Worker, and a setting claiming to turn that off would be lying. Delete `functions/` to serve note pages straight from the edge. On any host that is not Cloudflare Pages it is already inert.

It needs no configuration and stays correct whether or not mirrors are enabled: with mirrors off there is no `.md` to serve, the lookup fails, and the request falls through to HTML.

It decides by quality value, not by whether `Accept` merely mentions Markdown. Browsers send `text/html,...,*/*;q=0.8`, and an agent listing both types while ranking HTML higher means it. A tie goes to Markdown, since asking for it at all is deliberate and no browser does. `text/plain` is excluded, because plenty of tooling sends it while expecting something human-readable.

Cloudflare sells a zone-level "Markdown for Agents" feature that converts your HTML on the fly. This is deliberately not that: the build already produces a better mirror than any converter could, with frontmatter, resolved wiki links, parents and backlinks. Negotiation here just hands over the good one.
