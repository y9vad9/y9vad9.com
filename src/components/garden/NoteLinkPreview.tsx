'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from 'next-intl'
import type { SearchIndexEntry } from '@core/search/SearchIndex'

interface PreviewState {
  slug: string
  title: string
  preview: string
  coverImage: string | null
  date: string | null
  x: number
  y: number
  placement: 'above' | 'below'
}

const indexCache = new Map<string, Promise<Map<string, SearchIndexEntry>>>()

function loadIndex(locale: string): Promise<Map<string, SearchIndexEntry>> {
  let p = indexCache.get(locale)
  if (!p) {
    // Static export has no API routes; the build emitter writes a mirror
    // of the search index to `public/_static/<locale>/search-index.json`
    // (see `StaticBuildEmitter.ts`). The dev/server branch keeps the
    // `/api/search-index` route so we still get fresh data on rebuild.
    const url = process.env.NEXT_PUBLIC_ONVU_MODE === 'static'
      ? `/_static/${locale}/search-index.json`
      : `/api/search-index?locale=${encodeURIComponent(locale)}`
    p = fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: SearchIndexEntry[]) => new Map(rows.map((r) => [r.slug, r])))
      .catch(() => new Map<string, SearchIndexEntry>())
    indexCache.set(locale, p)
  }
  return p
}

/**
 * Watches for hover events on internal note links inside the article body
 * and shows a small floating card with the target note's title and preview.
 *
 * Delegates from `document` rather than caching an `article .prose` node
 * at mount time. Caching the container broke under SPA navigation: when
 * the user switched notes the original DOM node was discarded but the
 * listeners were still attached to it, so previews silently stopped
 * firing for the rest of the session. Document-level delegation walks the
 * current DOM on every event, so it stays correct across tab swaps and
 * doesn't need a remount on slug change.
 */
export function NoteLinkPreview({
  containerSelector = 'article',
}: {
  containerSelector?: string
}) {
  const [state, setState] = useState<PreviewState | null>(null)
  const hoverTimer = useRef<number | null>(null)
  const hideTimer = useRef<number | null>(null)
  const locale = useLocale()

  useEffect(() => {
    function slugFromHref(a: HTMLAnchorElement): string | null {
      const explicit = a.getAttribute('data-note-slug')
      if (explicit) return explicit
      const href = a.getAttribute('href') ?? ''
      const m = href.match(/^(?:\/[a-z]{2})?\/notes\/([^#?/]+)/)
      return m ? m[1] : null
    }

    function position(a: HTMLAnchorElement): Pick<PreviewState, 'x' | 'y' | 'placement'> {
      const r = a.getBoundingClientRect()
      const viewportH = window.innerHeight
      const spaceBelow = viewportH - r.bottom
      const placement: 'above' | 'below' = spaceBelow > 200 ? 'below' : 'above'
      return {
        x: r.left + r.width / 2,
        y: placement === 'below' ? r.bottom + 8 : r.top - 8,
        placement,
      }
    }

    async function show(a: HTMLAnchorElement) {
      const slug = slugFromHref(a)
      if (!slug) return
      if (a.classList.contains('wikilink-broken')) return
      const idx = await loadIndex(locale)
      const entry = idx.get(slug)
      if (!entry) return
      const pos = position(a)
      setState({
        slug: entry.slug,
        title: entry.title,
        preview: entry.preview,
        coverImage: entry.coverImage,
        date: entry.date,
        ...pos,
      })
    }

    function anchorInScope(target: EventTarget | null): HTMLAnchorElement | null {
      if (!(target instanceof Element)) return null
      const a = target.closest('a')
      if (!(a instanceof HTMLAnchorElement)) return null
      if (!a.closest(containerSelector)) return null
      return a
    }

    function onEnter(e: Event) {
      const a = anchorInScope(e.target)
      if (!a) return
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
      hoverTimer.current = window.setTimeout(() => show(a), 350)
    }

    function onLeave(e: Event) {
      const a = anchorInScope(e.target)
      if (!a) return
      if (hoverTimer.current) {
        window.clearTimeout(hoverTimer.current)
        hoverTimer.current = null
      }
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      hideTimer.current = window.setTimeout(() => setState(null), 180)
    }

    document.addEventListener('mouseover', onEnter)
    document.addEventListener('mouseout', onLeave)
    return () => {
      document.removeEventListener('mouseover', onEnter)
      document.removeEventListener('mouseout', onLeave)
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [containerSelector, locale])

  if (!state || typeof document === 'undefined') return null

  const transform =
    state.placement === 'below'
      ? 'translate(-50%, 0)'
      : 'translate(-50%, -100%)'

  return createPortal(
    <div
      role="tooltip"
      className="fixed z-[60] w-72 max-w-[80vw] pointer-events-none animate-[fadeIn_120ms_ease]"
      style={{ left: state.x, top: state.y, transform }}
    >
      <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
        {state.coverImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={state.coverImage}
            alt=""
            className="w-full aspect-video object-cover bg-bg"
          />
        )}
        <div className="p-3">
          <p className="text-sm font-semibold text-fg line-clamp-2">{state.title}</p>
          {state.preview && (
            <p className="text-xs text-muted mt-1 line-clamp-3">{state.preview}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
