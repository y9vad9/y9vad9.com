'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { sortNotes, SORT_MODES, SORT_LABEL_KEY, type SortMode } from '@lib/notes/sortNotes'
import { useParams } from 'next/navigation'
import { useHydrated } from '@hooks/useHydrated'
import { useTranslations } from 'next-intl'
import {
  Hash,
  Info,
  Search,
  ArrowUpDown,
  FoldVertical,
  UnfoldVertical,
  ArrowRight,
  X,
} from 'lucide-react'
import { NoteLink } from './NoteLink'


function readStored(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

export interface MentionItem {
  slug: string
  title: string
  preview: string
  date: string | null
}

export function MentionsSection({
  linked,
  unlinked,
}: {
  linked: MentionItem[]
  unlinked: MentionItem[]
}) {
  const t = useTranslations('note')

  if (linked.length === 0 && unlinked.length === 0) return null

  return (
    <div className="border-t border-border mt-10 pt-8 flex flex-col gap-8">
      <Group
        storageKey="mentions-linked-expanded"
        items={linked}
        icon={<Hash size={12} />}
        title={t('linkedMentions')}
        emptyMessage={t('noLinkedMentions')}
      />
      <Group
        storageKey="mentions-unlinked-expanded"
        items={unlinked}
        icon={<Info size={12} />}
        title={t('unlinkedMentions')}
        emptyMessage={t('noUnlinkedMentions')}
      />
    </div>
  )
}

function Group({
  storageKey,
  items,
  icon,
  title,
  emptyMessage,
}: {
  storageKey: string
  items: MentionItem[]
  icon: React.ReactNode
  title: string
  emptyMessage: string
}) {
  const t = useTranslations('note')
  const params = useParams<{ locale: string }>()
  const [filter, setFilter] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sort, setSort] = useState<SortMode>('date-desc')
  const [sortOpen, setSortOpen] = useState(false)
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null)
  const filterInputRef = useRef<HTMLInputElement>(null)

  // Read the stored preference only once hydration is done, so the first
  // client render still matches the server HTML.
  const hydrated = useHydrated()
  const expanded = expandedOverride ?? (hydrated && readStored(storageKey))

  function toggleExpanded() {
    const next = !expanded
    setExpandedOverride(next)
    try {
      localStorage.setItem(storageKey, String(next))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (filterOpen) filterInputRef.current?.focus()
  }, [filterOpen])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = q
      ? items.filter((i) =>
          i.title.toLowerCase().includes(q) || i.preview.toLowerCase().includes(q),
        )
      : items.slice()

    return sortNotes(list, sort)
  }, [items, filter, sort])

  const sortLabels = Object.fromEntries(
    SORT_MODES.map((m) => [m, t(SORT_LABEL_KEY[m])]),
  ) as Record<SortMode, string>

  return (
    <section>
      <header className="flex items-center gap-2 mb-3">
        <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wide font-medium text-muted">
          {icon} {title}
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-card text-fg text-[10px]">
            {items.length}
          </span>
        </h3>
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className="p-1 rounded hover:bg-card-hover text-muted hover:text-fg transition-colors"
            aria-label="Filter"
          >
            <Search size={12} />
          </button>
          <div className="relative">
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="p-1 rounded hover:bg-card-hover text-muted hover:text-fg transition-colors"
              aria-label="Sort"
            >
              <ArrowUpDown size={12} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-20 min-w-44">
                {SORT_MODES.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setSort(mode); setSortOpen(false) }}
                    className={`block w-full px-3 py-1.5 text-xs text-left hover:bg-card-hover transition-colors ${
                      sort === mode ? 'text-primary font-bold' : 'text-fg'
                    }`}
                  >
                    {sortLabels[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={toggleExpanded}
            className="p-1 rounded hover:bg-card-hover text-muted hover:text-fg transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <FoldVertical size={12} /> : <UnfoldVertical size={12} />}
          </button>
        </div>
      </header>

      {filterOpen && (
        <div className="relative mb-3">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={filterInputRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            // 16px below `sm`: iOS Safari zooms the viewport on focus for
            // anything smaller, and never zooms back out.
            className="w-full pl-8 pr-7 py-1.5 text-base sm:text-xs bg-card border border-border rounded-lg focus:outline-none focus:border-primary"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
              aria-label="Clear"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-xs text-muted italic text-center py-4 border-2 border-dashed border-border rounded-xl">
          {emptyMessage}
        </p>
      ) : (
        <ul className="flex flex-col">
          {filtered.map((item) => (
            <li key={item.slug}>
              <NoteLink
                slug={item.slug}
                title={item.title}
                href={`/${params.locale}/notes/${item.slug}`}
                className="group flex items-start gap-3 py-2 px-1 hover:bg-card-hover rounded transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                    {item.title}
                  </p>
                  {expanded && item.preview && (
                    <p className="text-xs text-muted italic line-clamp-2 mt-0.5">
                      {item.preview}
                    </p>
                  )}
                </div>
                <ArrowRight
                  size={12}
                  className="text-muted opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all mt-1"
                />
              </NoteLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
