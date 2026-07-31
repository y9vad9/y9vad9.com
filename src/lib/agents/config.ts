import { config as siteConfig } from '~/site.config'

/**
 * `AgentsConfig` with every optional flag collapsed to a boolean, so callers
 * never repeat the `?? false` dance. Resolution lives here alone — the shape
 * in `site.config.ts` is sparse on purpose (authors set what they want),
 * and every default is off except sub-toggles that only apply once their
 * parent feature is already switched on.
 */
export interface ResolvedAgentsConfig {
  markdown: {
    enabled: boolean
    resolveWikilinks: boolean
    include: {
      frontmatter: boolean
      parents: boolean
      series: boolean
      backlinks: boolean
      outgoing: boolean
      relatedNotes: boolean
    }
  }
  llmsTxt: { enabled: boolean; full: boolean }
  discovery: {
    linkAlternate: boolean
    jsonLdEncoding: boolean
    emitHeadersFile: boolean
  }
  schema: {
    series: boolean
    mentions: boolean
    definedTerms: boolean
    citations: boolean
    knowsAbout: boolean
  }
  webmcp: { enabled: boolean }
}

export function resolveAgentsConfig(): ResolvedAgentsConfig {
  const a = siteConfig.agents ?? {}
  const md = a.markdown ?? {}
  const include = md.include ?? {}
  const discovery = a.discovery ?? {}
  const schema = a.schema ?? {}
  const llms = a.llmsTxt ?? {}

  const markdownEnabled = md.enabled === true
  const llmsEnabled = llms.enabled === true

  return {
    markdown: {
      enabled: markdownEnabled,
      // The one default-on sub-flag: an unresolved `[[link]]` is dead weight
      // to an agent, so mirrors resolve unless asked not to.
      resolveWikilinks: md.resolveWikilinks !== false,
      include: {
        frontmatter: include.frontmatter !== false,
        parents: include.parents === true,
        series: include.series === true,
        backlinks: include.backlinks === true,
        outgoing: include.outgoing === true,
        relatedNotes: include.relatedNotes === true,
      },
    },
    llmsTxt: {
      enabled: llmsEnabled,
      full: llms.full === true,
    },
    discovery: {
      // Advertising a mirror that doesn't exist would be a dangling link, so
      // both discovery hooks are gated on the mirrors themselves.
      linkAlternate: markdownEnabled && discovery.linkAlternate !== false,
      jsonLdEncoding: markdownEnabled && discovery.jsonLdEncoding !== false,
      // `_headers` serves both features — a content type for the mirrors, a
      // content type and a `Link` pointer for llms.txt — so either one alone
      // is reason enough to write it.
      emitHeadersFile: (markdownEnabled || llmsEnabled) && discovery.emitHeadersFile === true,
    },
    schema: {
      series: schema.series === true,
      mentions: schema.mentions === true,
      definedTerms: schema.definedTerms === true,
      citations: schema.citations === true,
      knowsAbout: schema.knowsAbout === true,
    },
    webmcp: { enabled: (a.webmcp ?? {}).enabled === true },
  }
}

/** Absolute URL of a note's markdown mirror. */
export function markdownMirrorPath(locale: string, slug: string): string {
  return `/${locale}/notes/${slug}.md`
}
