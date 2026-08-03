'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useTabStore, tabHref } from '@store/tabStore'
import { useRouter, useParams, usePathname } from 'next/navigation'
import { slugFromPathname } from '@lib/url'

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeSlug = useTabStore((s) => s.activeSlug)
  const router = useRouter()
  const params = useParams<{ locale: string }>()
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Auto-scroll the active tab into view when it changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [activeSlug])

  if (tabs.length === 0) return null

  function handleTabClick(slug: string) {
    const tab = useTabStore.getState().tabs.find((t) => t.slug === slug)
    if (!tab) return
    useTabStore.getState().setActiveTab(slug)
    router.push(tabHref(tab, params.locale))
  }

  function handleClose(e: React.MouseEvent | React.KeyboardEvent, slug: string) {
    e.stopPropagation()
    e.preventDefault()

    const stateBefore = useTabStore.getState()
    const closingActive = stateBefore.activeSlug === slug
    const idx = stateBefore.tabs.findIndex((t) => t.slug === slug)

    useTabStore.getState().closeTab(slug)

    // Navigate if we closed the currently-viewed tab
    const currentlyOnSlug = slugFromPathname(pathname)
    if (closingActive || currentlyOnSlug === slug) {
      const after = useTabStore.getState()
      if (after.tabs.length === 0) {
        router.push(`/${params.locale}/notes`)
      } else {
        const nextIdx = Math.min(idx, after.tabs.length - 1)
        router.push(tabHref(after.tabs[nextIdx], params.locale))
      }
    }
  }

  return (
    <div
      ref={scrollRef}
      className="flex items-center overflow-x-auto gap-0.5 h-full scrollbar-hide justify-center"
      style={{ scrollbarWidth: 'none' }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.slug}
          ref={activeSlug === tab.slug ? activeRef : null}
          onClick={() => handleTabClick(tab.slug)}
          onAuxClick={(e) => { if (e.button === 1) handleClose(e, tab.slug) }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs whitespace-nowrap flex-shrink-0 transition-colors group ${
            activeSlug === tab.slug
              ? 'bg-primary-muted text-primary font-medium'
              : 'text-muted hover:bg-card-hover hover:text-fg'
          }`}
        >
          <span className="max-w-32 truncate">{tab.title}</span>
          <span
            onClick={(e) => handleClose(e, tab.slug)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClose(e, tab.slug)}
            className="opacity-0 group-hover:opacity-100 hover:text-fg transition-opacity ms-0.5 cursor-pointer"
            aria-label={`Close ${tab.title}`}
          >
            <X size={11} />
          </span>
        </button>
      ))}
    </div>
  )
}
