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
