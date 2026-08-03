'use client'

import { useState } from 'react'
import { publicOrigin } from '@lib/publicPath'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Network, Shuffle, Rss, Check, ArrowUpRight } from 'lucide-react'
import { DynamicIcon } from 'lucide-react/dynamic'
import { useTranslations } from 'next-intl'
import { RouteLink } from './RouteLink'
import { GRAPH_TAB_SLUG } from '@store/tabStore'
import { GARDEN_SHORTCUTS } from '@lib/shortcuts/gardenShortcuts'
import { createShortcutActions } from '@lib/shortcuts/createShortcutActions'
import type { GardenAction, CustomGardenAction } from '@config/site'

/**
 * One shape for every action, whether it renders as a link, a route-aware
 * link or a button — several elements that must not read as several
 * different affordances.
 */
const CARD =
  'group flex items-center gap-2.5 p-4 rounded-xl border border-border ' +
  'hover:border-primary hover:bg-card transition-all duration-300 ' +
  'text-start w-full cursor-pointer'

const ICON = 'text-primary flex-shrink-0'

/** A path with a scheme goes out; a bare one stays in the app. */
function isExternal(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')
}

function hasKey<K extends string>(
  action: CustomGardenAction,
  key: K,
): action is CustomGardenAction & Record<K, string> {
  return key in action
}

export function GardenActions({
  actions,
  locale,
  randomSlugs,
}: {
  actions: readonly GardenAction[]
  locale: string
  /** Candidates for the random pick, already filtered by the caller. */
  randomSlugs: string[]
}) {
  const t = useTranslations('garden')
  const tNote = useTranslations('note')
  const router = useRouter()
  /** Which action most recently copied, so only that one says "Copied!". */
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  function pickRandom() {
    if (randomSlugs.length === 0) return
    // Chosen on click, never during render: randomising while rendering hands
    // the server one slug and the client another, and React tears the tree
    // down over the mismatch.
    const pick = randomSlugs[Math.floor(Math.random() * randomSlugs.length)]
    router.push(`/${locale}/notes/${pick}`)
  }

  async function copy(value: string, key: string) {
    // A site-relative value becomes a real URL here rather than in config,
    // which cannot know the deployed origin.
    const text = value.startsWith('/') ? `${publicOrigin()}${value}` : value
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000)
    } catch {
      // Clipboard can be denied (insecure origin, permissions). Opening the
      // value instead would be worse for the feed case: browsers no longer
      // render XML feeds — Firefox downloads the file — which is the whole
      // reason this copies rather than navigating.
    }
  }

  function runCommand(id: string) {
    const shortcut = GARDEN_SHORTCUTS.find((s) => s.id === id)
    if (shortcut) {
      shortcut.run(createShortcutActions({ navigate: (path) => router.push(path), locale }))
    }
  }

  function iconFor(action: CustomGardenAction, fallback: React.ReactNode) {
    return action.icon ? (
      <DynamicIcon name={action.icon} size={16} className={ICON} />
    ) : (
      fallback
    )
  }

  function renderCustom(action: CustomGardenAction, key: string) {
    const label = <span className="font-medium text-sm">{action.label}</span>

    if (hasKey(action, 'href')) {
      const external = isExternal(action.href)
      const href = external ? action.href : `/${locale}/${action.href.replace(/^\/+/, '')}`
      const body = (
        <>
          {iconFor(action, <ArrowUpRight size={16} className={ICON} />)}
          {label}
        </>
      )
      return external ? (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={CARD}>
          {body}
        </a>
      ) : (
        <Link key={key} href={href} className={CARD}>
          {body}
        </Link>
      )
    }

    if (hasKey(action, 'copy')) {
      const done = copiedKey === key
      return (
        <button key={key} type="button" onClick={() => copy(action.copy, key)} className={CARD}>
          {done ? <Check size={16} className={ICON} /> : iconFor(action, <Rss size={16} className={ICON} />)}
          <span className="font-medium text-sm">{done ? tNote('copied') : action.label}</span>
        </button>
      )
    }

    return (
      <button key={key} type="button" onClick={() => runCommand(action.command)} className={CARD}>
        {iconFor(action, <ArrowUpRight size={16} className={ICON} />)}
        {label}
      </button>
    )
  }

  const rendered = actions.map((action, i) => {
    const key = String(i)
    if (typeof action !== 'string') return renderCustom(action, key)

    // The built-ins are the same three behaviours with defaults filled in —
    // `graph` is a tab-aware link, `rss` is a copy, `random` is the one that
    // needs the note list and so cannot be expressed in config.
    switch (action) {
      case 'graph':
        return (
          <RouteLink
            key={key}
            href={`/${locale}/notes/graph`}
            routeSlug={GRAPH_TAB_SLUG}
            routeTitle={t('knowledgeGraph')}
            routeKind="graph"
            className={CARD}
          >
            <Network size={16} className={ICON} />
            <span className="font-medium text-sm">{t('knowledgeGraph')}</span>
          </RouteLink>
        )
      case 'random':
        // Nothing to pick from on a site with no eligible notes.
        if (randomSlugs.length === 0) return null
        return (
          <button key={key} type="button" onClick={pickRandom} className={CARD}>
            <Shuffle size={16} className={ICON} />
            <span className="font-medium text-sm">{t('randomNote')}</span>
          </button>
        )
      case 'rss':
        return renderCustom(
          { label: t('rssFeed'), copy: `/${locale}/feed.xml` },
          key,
        )
    }
  })

  const visible = rendered.filter(Boolean)
  if (visible.length === 0) return null

  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{visible}</div>
}
