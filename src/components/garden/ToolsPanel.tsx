'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowDownLeft, ArrowUpRight, BookOpen } from 'lucide-react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { usePanelStore } from '@store/panelStore'
import { useTabStore } from '@store/tabStore'
import { useNoteContextStore } from '@store/noteContextStore'
import { useListKeyboardNav } from '@hooks/useListKeyboardNav'
import dynamic from 'next/dynamic'
import { TableOfContents, type TableOfContentsHandle } from './TableOfContents'
import { NoteLink } from './NoteLink'

// `LocalGraph` pulls in `react-force-graph-2d` and d3-force, ~200 KiB
// gzipped. The graph tab is opt-in (mounted only when the user selects
// it in the right panel), so deferring the import keeps that weight off
// the note page's initial bundle. The `ssr: false` flag matches the
// dynamic boundary already used inside `ForceGraph` itself.
const LocalGraph = dynamic(
  () => import('@components/graph/LocalGraph').then((m) => m.LocalGraph),
  { ssr: false },
)

const ITEM_BASE = 'panel-item'
const ITEM_ACTIVE = 'is-active'

export function ToolsPanel() {
  const t = useTranslations('panel')
  const tNote = useTranslations('note')
  const { toolsMode, toolsFocusNonce } = usePanelStore()
  const params = useParams<{ locale: string }>()
  const pathname = usePathname()
  const router = useRouter()

  const { headings, series, currentSlug, backlinks, outgoing } = useNoteContextStore()
  const onGlobalGraphPage = pathname?.endsWith('/notes/graph') ?? false
  const effectiveMode = toolsMode === 'series' && !series ? 'toc' : toolsMode

  const tocRef = useRef<TableOfContentsHandle>(null)

  // Series: navigate-on-select
  const navigateToNote = useCallback(
    (slug: string, title: string, modifier = false) => {
      const ctx = useNoteContextStore.getState()
      const current =
        ctx.currentSlug && ctx.currentTitle
          ? { slug: ctx.currentSlug, title: ctx.currentTitle }
          : null
      if (modifier) {
        useTabStore.getState().openInNewTab({ slug, title }, current)
      } else {
        useTabStore.getState().replaceActive({ slug, title }, ctx.currentSlug)
      }
      router.push(`/${params.locale}/notes/${slug}`)
    },
    [router, params.locale],
  )

  const seriesNotes = series?.notes ?? []
  const seriesNav = useListKeyboardNav({
    count: seriesNotes.length,
    resetKey: seriesNotes,
    initialIdx: Math.max(
      0,
      seriesNotes.findIndex((n) => n.slug === currentSlug),
    ),
    onSelect: (idx, e) => {
      const note = seriesNotes[idx]
      if (note) navigateToNote(note.slug, note.title, e.metaKey || e.ctrlKey)
    },
  })

  // Links mode merges backlinks + outgoing into a single keyboard list.
  type LinkRow =
    | { kind: 'back'; slug: string; title: string }
    | { kind: 'out-internal'; slug: string; title: string }
    | { kind: 'out-external'; href: string; title: string }
  const linkRows: LinkRow[] = [
    ...backlinks.map((b) => ({ kind: 'back' as const, slug: b.slug, title: b.title })),
    ...outgoing.map((o) =>
      o.isExternal
        ? { kind: 'out-external' as const, href: o.href, title: o.title }
        : { kind: 'out-internal' as const, slug: o.slug, title: o.title },
    ),
  ]
  const linksNav = useListKeyboardNav({
    count: linkRows.length,
    resetKey: linkRows.length,
    onSelect: (idx, e) => {
      const row = linkRows[idx]
      if (!row) return
      if (row.kind === 'out-external') {
        window.open(row.href, '_blank', 'noopener,noreferrer')
        return
      }
      navigateToNote(row.slug, row.title, e.metaKey || e.ctrlKey)
    },
  })

  // Auto-focus the appropriate list when a shortcut requests it. Keyed on
  // the nonce alone — a mouse click that just changes the mode shouldn't
  // pull keyboard focus into the list.
  useEffect(() => {
    if (toolsFocusNonce === 0) return
    if (effectiveMode === 'toc') tocRef.current?.focus()
    else if (effectiveMode === 'series') seriesNav.focus()
    else if (effectiveMode === 'links') linksNav.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsFocusNonce])

  return (
    <div className="kbd-section flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {effectiveMode === 'toc' && (
          <TableOfContents ref={tocRef} headings={headings} />
        )}

        {effectiveMode === 'series' && (
          !series ? (
            <EmptyState text={t('noSeries')} />
          ) : (
            <div {...seriesNav.containerProps} className="py-2 focus:outline-none">
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted uppercase tracking-wide">
                <BookOpen size={11} /> {series.name}
              </div>
              {series.notes.map((note, idx) => (
                <NoteLink
                  key={note.slug}
                  slug={note.slug}
                  title={note.title}
                  href={`/${params.locale}/notes/${note.slug}`}
                  ref={seriesNav.setItemRef(idx)}
                  onMouseEnter={() => seriesNav.setIdx(idx)}
                  className={`${ITEM_BASE} ${note.slug === currentSlug ? ITEM_ACTIVE : ''} ${idx === seriesNav.idx ? 'is-kbd' : ''}`}
                  role="option"
                  aria-selected={idx === seriesNav.idx}
                >
                  <span className="text-xs text-muted w-5 text-right flex-shrink-0">
                    {note.order}
                  </span>
                  <span className="truncate">{note.title}</span>
                </NoteLink>
              ))}
            </div>
          )
        )}

        {effectiveMode === 'links' && (
          linkRows.length === 0 ? (
            <EmptyState text={t('noLinks')} />
          ) : (
            <div {...linksNav.containerProps} className="py-2 flex flex-col gap-4 focus:outline-none">
              {backlinks.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted uppercase tracking-wide">
                    <ArrowDownLeft size={11} /> {tNote('backlinks')} ({backlinks.length})
                  </div>
                  {backlinks.map((note) => {
                    const idx = linkRows.findIndex(
                      (r) => r.kind === 'back' && r.slug === note.slug,
                    )
                    return (
                      <NoteLink
                        key={note.slug}
                        slug={note.slug}
                        title={note.title}
                        href={`/${params.locale}/notes/${note.slug}`}
                        ref={linksNav.setItemRef(idx)}
                        onMouseEnter={() => linksNav.setIdx(idx)}
                        className={`${ITEM_BASE} ${idx === linksNav.idx ? 'is-kbd' : ''}`}
                        role="option"
                        aria-selected={idx === linksNav.idx}
                      >
                        <span className="truncate">{note.title}</span>
                      </NoteLink>
                    )
                  })}
                </div>
              )}

              {outgoing.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted uppercase tracking-wide">
                    <ArrowUpRight size={11} /> {tNote('outgoing')} ({outgoing.length})
                  </div>
                  {outgoing.map((link) => {
                    const idx = linkRows.findIndex(
                      (r) =>
                        (r.kind === 'out-external' && r.href === link.href) ||
                        (r.kind === 'out-internal' && r.slug === link.slug),
                    )
                    return link.isExternal ? (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        ref={(el) => linksNav.setItemRef(idx)(el)}
                        onMouseEnter={() => linksNav.setIdx(idx)}
                        className={`${ITEM_BASE} ${idx === linksNav.idx ? 'is-kbd' : ''}`}
                        role="option"
                        aria-selected={idx === linksNav.idx}
                      >
                        <span className="truncate">{link.title}</span>
                        <ArrowUpRight size={10} className="flex-shrink-0" />
                      </a>
                    ) : (
                      <NoteLink
                        key={link.href}
                        slug={link.slug}
                        title={link.title}
                        href={`/${params.locale}/notes/${link.slug}`}
                        ref={linksNav.setItemRef(idx)}
                        onMouseEnter={() => linksNav.setIdx(idx)}
                        className={`${ITEM_BASE} ${idx === linksNav.idx ? 'is-kbd' : ''}`}
                        role="option"
                        aria-selected={idx === linksNav.idx}
                      >
                        <span className="truncate">{link.title}</span>
                      </NoteLink>
                    )
                  })}
                </div>
              )}
            </div>
          )
        )}

        {effectiveMode === 'graph' && (
          onGlobalGraphPage
            ? <EmptyState text={t('noGraph')} />
            : currentSlug
              ? <LocalGraph slug={currentSlug} />
              : <EmptyState text={t('noGraph')} />
        )}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center px-6 py-10">
      <p className="text-xs text-muted italic text-center">{text}</p>
    </div>
  )
}
