'use client'

import { useEffect } from 'react'
import {
  buildWebMcpTools,
  findModelContextHost,
  registerWebMcpTools,
} from '@lib/agents/webmcp'

interface Props {
  locale: string
  /** Whether markdown mirrors exist to point agents at. */
  hasMirrors: boolean
}

/**
 * Registers this site's WebMCP tools, if the browser has WebMCP at all.
 *
 * Renders nothing and touches no state — in a browser without
 * `modelContext` (which is most of them today) the effect finds no host and
 * returns immediately. Registration is torn down on unmount via the
 * `AbortSignal` the spec accepts, so a locale switch replaces the tools
 * rather than stacking a second copy on top.
 */
export function WebMcpTools({ locale, hasMirrors }: Props) {
  useEffect(() => {
    const host = findModelContextHost(window)
    if (!host) return

    const controller = new AbortController()
    const origin = window.location.origin

    registerWebMcpTools(
      host,
      buildWebMcpTools({
        locale,
        searchIndexUrl: `/_static/${locale}/search-index.json`,
        noteUrl: (slug) => `${origin}/${locale}/notes/${slug}/`,
        mirrorUrl: hasMirrors ? (slug) => `${origin}/${locale}/notes/${slug}.md` : null,
        fetchJson: async (url) => {
          const res = await fetch(url, { signal: controller.signal })
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
          return res.json()
        },
      }),
      controller.signal,
    )

    return () => controller.abort()
  }, [locale, hasMirrors])

  return null
}
