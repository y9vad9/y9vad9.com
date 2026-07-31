import { config as siteConfig } from '~/site.config'

/**
 * Content Signals: how your content may be *used* after it is fetched.
 *
 * This is a different axis from `crawlers`, and mixing them up is the usual
 * mistake. A robots.txt `Disallow` is an *access* control — don't fetch this.
 * A content signal is a *use* preference — you may fetch it, here is what you
 * may do with it afterwards. A site can quite reasonably allow the fetch and
 * still refuse training, which is why these are not derived from the crawler
 * policy: doing so would state a preference the author never expressed.
 *
 * Three signals are defined:
 *
 *  - `search`   — build a search index, show links and short excerpts.
 *  - `ai-input` — use the content at answer time: retrieval, grounding, RAG.
 *  - `ai-train` — train or fine-tune a model on it.
 *
 * Each is `yes` or `no`, and **omitting one is meaningful**: per the policy,
 * an absent signal "neither grants nor restricts permission". So an unset key
 * here is left out of the line entirely rather than defaulting to `no` —
 * Cloudflare made the same call for `ai-input` on managed robots.txt files,
 * declining to guess a preference on the operator's behalf.
 *
 * Like every other robots.txt directive, this is declarative. It records a
 * preference in a machine-readable place; it does not enforce anything.
 *
 * @see https://blog.cloudflare.com/content-signals-policy/
 */
export interface ContentSignalsConfig {
  /** Search indexing, links and excerpts. */
  search?: boolean
  /** Answer-time use — retrieval, grounding, RAG input. */
  aiInput?: boolean
  /** Model training and fine-tuning. */
  aiTrain?: boolean
}

/** Emitted in the policy's own order, which is also Cloudflare's. */
const SIGNALS: ReadonlyArray<readonly [keyof ContentSignalsConfig, string]> = [
  ['search', 'search'],
  ['aiInput', 'ai-input'],
  ['aiTrain', 'ai-train'],
]

/**
 * Render the `Content-Signal:` value, or null when nothing is configured.
 *
 * Returns null rather than an empty string so callers can skip the directive
 * entirely — a bare `Content-Signal:` line would be a malformed statement of
 * nothing, and silence already carries the right meaning.
 */
export function buildContentSignal(cfg: ContentSignalsConfig | undefined): string | null {
  if (!cfg) return null
  const parts = SIGNALS.filter(([key]) => typeof cfg[key] === 'boolean').map(
    ([key, name]) => `${name}=${cfg[key] ? 'yes' : 'no'}`,
  )
  return parts.length > 0 ? parts.join(', ') : null
}

/**
 * The effective signals: what the site configured, over onvu's defaults.
 *
 * Defaults to `search=yes, ai-train=no` — the same pair Cloudflare writes
 * into managed robots.txt files, and the same position `crawlerPolicy` takes
 * on the access axis. Stating both matters because they cover different
 * gaps: the crawler rules name specific bots, while this binds any fetcher
 * that reads robots.txt at all, including ones onvu has never heard of.
 *
 * `ai-input` is left unset on purpose. Cloudflare declined to guess it for
 * their customers and the reasoning holds here: whether an AI may ground an
 * answer in your writing is a genuine preference, not a safe assumption, and
 * the policy treats an absent signal as neither granting nor restricting.
 * Set `aiInput` explicitly to say either way.
 */
export function resolveContentSignals(
  configured: ContentSignalsConfig | undefined,
): ContentSignalsConfig {
  const cfg = configured ?? {}
  return {
    search: cfg.search ?? true,
    aiInput: cfg.aiInput,
    aiTrain: cfg.aiTrain ?? false,
  }
}

/** `resolveContentSignals` applied to this site's config. */
export function contentSignals(): ContentSignalsConfig {
  return resolveContentSignals(siteConfig.agents?.contentSignals)
}
