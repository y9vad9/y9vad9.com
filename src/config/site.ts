/**
 * Any BCP-47 locale code. Free-form so users can add or remove languages by
 * editing `locales.supported` in `site.config.ts` and dropping matching
 * `messages/<locale>.json` + `content/notes/<locale>/` folders.
 */
export type Locale = string

/**
 * Free-form social platform identifier. The Hero looks up an icon for the
 * known names (github, linkedin, mastodon, bluesky, …) automatically; pass
 * `icon: 'PascalCaseLucideName'` to override or to ship a brand-new entry.
 */
export type SocialPlatform = string

export interface SocialLink {
  platform: SocialPlatform
  url: string
  /** Override the default icon. PascalCase lucide-react icon name. */
  icon?: string
}

/**
 * The brand mark shown in the header (and mobile drawer). Omit `branding`
 * entirely to fall back to `owner.handle` as plain text.
 */
export type Branding =
  | { kind: 'text'; text: string }
  | { kind: 'image'; src: string; alt: string; width?: number; height?: number }

/**
 * One selectable theme. When `themes` is omitted from `SiteConfig`, the
 * framework ships five defaults (light, dark, warm, forest, system). When
 * provided, only the listed themes appear in the picker; each `id` must
 * correspond to a `.theme-<id>` rule in `content/theme.css` (or globals).
 */
export interface ThemeOption {
  id: string
  /** Translation key under `theme.*`, or a literal label if no translation. */
  label?: string
  /** PascalCase lucide-react icon name. Defaults to `Palette`. */
  icon?: string
  /**
   * Whether the palette sits on a dark canvas. Drives `color-scheme`, which
   * decides what the browser paints before the stylesheet loads (and how it
   * styles scrollbars and form controls). Omit to follow the OS preference —
   * correct for a `system` theme, but set it explicitly on a custom one or a
   * cold load flashes the wrong colour.
   */
  dark?: boolean
}

export interface WorkEntry {
  company: string
  role: string
  period: string
  url: string
  logo: string
}

export interface ProjectEntry {
  name: string
  description: string
  url: string
  /**
   * Optional leading icon (project logo, repo avatar, etc.). Same shape
   * as `WorkEntry.logo` and `EducationEntry.logo` — site-absolute path
   * or external URL. Appending `?dark-invert` swaps the logo's colours
   * under dark themes (see `parseDecoratedImage`).
   */
  logo?: string
}

export interface EducationEntry {
  institution: string
  degree: string
  period: string
  logo: string
  url?: string
}

export interface SiteConfig {
  owner: {
    name: string
    handle: string
    profileImage: string
    bio: string
    socials: SocialLink[]
  }
  locales: {
    primary: Locale
    supported: Locale[]
  }
  defaultTheme: string
  /** Override the built-in theme list. Omit for the five framework defaults. */
  themes?: ThemeOption[]
  /** Brand mark for the header. Omit to use `owner.handle` as plain text. */
  branding?: Branding
  mode: 'static' | 'server'
  pwa: {
    name: string
    shortName: string
    description: string
  }
  navigation: {
    featuredNotes: string[]
    workExperienceNote: string
    projectsNote: string
    educationNote: string
    summaryNote: string
    interestsNote?: string
    pronunciationNote?: string
  }
  home: {
    workExperience: WorkEntry[]
    projects: ProjectEntry[]
    education: EducationEntry[]
  }
  comments?: CommentsConfig
  seo?: SeoConfig
  agents?: AgentsConfig
}

/**
 * Machine-readable surfaces for AI agents. **Everything here is off by
 * default** — publishing your writing in an agent-friendly form is a choice,
 * not a default, and plenty of authors would rather not.
 *
 * A note on expectations before you switch anything on: Google states plainly
 * that you "don't need to create new machine readable files, AI text files,
 * markup, or Markdown to appear in Google Search", and that such files
 * "neither harm nor help your site's visibility" because Search ignores them.
 * So none of this is an SEO lever.
 *
 * What it *is* for: agents that fetch your page at request time — coding
 * agents, ChatGPT/Claude browsing, `Perplexity-User`. Those pay tokens for
 * your nav chrome and get nothing from it. A markdown mirror is markedly
 * cheaper for them to read, and the structured-data options describe
 * relationships (series, mentions) that onvu already computes but never
 * expressed in a machine-readable way.
 *
 * @see https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
 */
export interface AgentsConfig {
  markdown?: MarkdownMirrorConfig
  llmsTxt?: LlmsTxtConfig
  discovery?: AgentDiscoveryConfig
  schema?: AgentSchemaConfig
  /**
   * Per-group robots.txt policy for AI crawlers.
   *
   * Unlike everything else in this block, this one has a default: the
   * `training` group is blocked unless you say otherwise, so a fresh onvu
   * site is crawlable and citable but stays out of training corpora. Set
   * `training: 'allow'` to opt back in. See `@lib/agents/crawlers` for the
   * groups, why the distinction between them matters, and why blocking the
   * training group costs nothing in search.
   */
  crawlers?: import('@lib/agents/crawlers').CrawlerPolicyConfig
  /**
   * `Content-Signal` directives in robots.txt: what may be *done* with your
   * content once fetched, as opposed to `crawlers`, which governs whether it
   * may be fetched.
   *
   * Defaults to `search=yes, ai-train=no`, matching the crawler default on
   * the other axis. Omit a single signal and you state no preference on that
   * use — the policy treats absence as neither granting nor restricting, so
   * it is never silently written as `no`. See `@lib/agents/contentSignals`.
   */
  contentSignals?: import('@lib/agents/contentSignals').ContentSignalsConfig
  webmcp?: WebMcpConfig
}

/**
 * WebMCP: expose search/read tools to an AI agent running *inside the
 * browser*, via `document.modelContext`.
 *
 * Worth understanding what this adds before enabling it, because for a
 * reading-only site the answer may be "not much". Every capability it
 * exposes — search the notes, list them, read one — is already available to
 * any agent over plain HTTP through `llms.txt` and the markdown mirrors, with
 * no browser and no flag involved. WebMCP earns its keep on sites with
 * *actions* an agent cannot perform by fetching: adding to a cart, filtering
 * a table, submitting a form. A digital garden has none of those.
 *
 * It is also a moving target: `provideContext()` was removed in March 2026
 * and the entry point moved from `navigator` to `document` in Chrome 150.
 * Nothing breaks when it moves again — registration probes and no-ops — but
 * you are opting into churn for a modest gain. Off by default.
 */
export interface WebMcpConfig {
  /** Register `search_notes`, `list_notes` and `get_note` on every page. */
  enabled?: boolean
}

export interface MarkdownMirrorConfig {
  /** Emit `/<locale>/notes/<slug>.md` beside every note page. */
  enabled?: boolean
  /**
   * Rewrite `[[Wiki Links]]` to absolute URLs. On by default when mirrors
   * are enabled: an agent can't follow `[[deep-modules]]`, so a mirror that
   * keeps the raw syntax is only half a document. Turn it off to publish the
   * source byte-for-byte.
   */
  resolveWikilinks?: boolean
  /** Extra context appended to (or prepended to) the body. */
  include?: {
    /** YAML block with title, dates, tags and the canonical HTML URL. */
    frontmatter?: boolean
    /**
     * The note's parents, linked. Frontmatter carries parent *names*, which
     * an agent can't follow — this resolves them to URLs.
     */
    parents?: boolean
    /** "Part N of <series>" plus links to the sibling notes. */
    series?: boolean
    /** Notes that link *to* this one. */
    backlinks?: boolean
    /** Links out of this note, internal and external. */
    outgoing?: boolean
    /** Notes sharing a parent or tag — onvu's own relatedness heuristic. */
    relatedNotes?: boolean
  }
}

export interface LlmsTxtConfig {
  /** Emit `/llms.txt`: an index of every note with its markdown mirror. */
  enabled?: boolean
  /** Also emit `/llms-full.txt` with every note body inlined. */
  full?: boolean
}

export interface AgentDiscoveryConfig {
  /**
   * `<link rel="alternate" type="text/markdown">` in each page's head — the
   * same mechanism RSS autodiscovery has used for twenty years. Invisible to
   * readers, and it means an agent never has to guess the `.md` URL.
   */
  linkAlternate?: boolean
  /**
   * Schema.org `encoding` on the Article node, pointing at the mirror.
   * Semantically exact: `encoding` is "a media object that encodes this
   * CreativeWork". Free for anything already parsing your JSON-LD.
   */
  jsonLdEncoding?: boolean
  /**
   * Emit a Netlify/Cloudflare-Pages `_headers` file serving mirrors as
   * `text/markdown` (most static hosts otherwise send them as a download)
   * and marking them `noindex`. The noindex costs nothing — Google ignores
   * markdown by its own account — and it keeps the mirrors from competing
   * with your HTML as duplicate URLs. It never blocks a live agent fetch.
   */
  emitHeadersFile?: boolean
}

export interface AgentSchemaConfig {
  /** `isPartOf` a `CreativeWorkSeries` with `position`, from series/order. */
  series?: boolean
  /** `mentions` from the wiki-link graph onvu already builds. */
  mentions?: boolean
  /** `DefinedTerm` / `DefinedTermSet` — a digital garden as a glossary. */
  definedTerms?: boolean
  /** `citation` for outbound external references. */
  citations?: boolean
  /** `Person.knowsAbout`, aggregated from note tags. */
  knowsAbout?: boolean
}

/**
 * SEO + structured data surface. Everything here is optional — the
 * framework falls back to sensible defaults — but consumers will want to
 * at least set `siteUrl` so canonical/OG URLs resolve correctly.
 */
export interface SeoConfig {
  /** Canonical origin, no trailing slash. Falls back to NEXT_PUBLIC_BASE_URL. */
  siteUrl?: string
  /** Static fallback OG image (absolute path or URL). */
  defaultOgImage?: string
  /** Twitter site handle, including the leading `@`. */
  twitterHandle?: string
  /** When set, JSON-LD emits Organization instead of Person for the site root. */
  organization?: {
    name: string
    logo: string
  }
  /** Search-engine verification keys. */
  verification?: {
    google?: string
    bing?: string
    yandex?: string
  }
  /** Routes excluded from sitemap and disallowed in robots.txt. */
  noindexPaths?: string[]
}

/**
 * Comments provider. Set `provider: 'none'` (or omit the whole `comments`
 * key) to render no comments section at all. The Giscus preset is the only
 * built-in renderer — to add another, extend this union, route it in
 * `CommentsSection.tsx`, and ship a renderer alongside `GiscusComments.tsx`.
 */
export type CommentsConfig =
  | { provider: 'none' }
  | {
      provider: 'giscus'
      repo: string
      repoId: string
      category: string
      categoryId: string
    }
