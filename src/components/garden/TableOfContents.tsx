'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useListKeyboardNav } from '@hooks/useListKeyboardNav'
import type { Heading } from '@core/Note'

export interface TableOfContentsHandle {
  focus: () => void
}

export const TableOfContents = forwardRef<TableOfContentsHandle, { headings: Heading[] }>(
  function TableOfContents({ headings }, ref) {
    const t = useTranslations('panel')
    const [activeId, setActiveId] = useState<string>('')
    const linkRefs = useRef<Array<HTMLAnchorElement | null>>([])

    useEffect(() => {
      if (headings.length === 0) return
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActiveId(entry.target.id)
            }
          }
        },
        { rootMargin: '-10% 0% -80% 0%', threshold: 0 },
      )
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (el) observer.observe(el)
      }
      return () => observer.disconnect()
    }, [headings])

    const activeIdx = useMemo(() => {
      const idx = headings.findIndex((h) => h.id === activeId)
      return idx >= 0 ? idx : 0
    }, [headings, activeId])

    const jumpTo = useCallback((heading: Heading) => {
      document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' })
      window.history.pushState(null, '', `#${heading.id}`)
      setActiveId(heading.id)
    }, [])

    const nav = useListKeyboardNav({
      count: headings.length,
      initialIdx: activeIdx,
      resetKey: headings,
      onSelect: (idx) => {
        const h = headings[idx]
        if (h) jumpTo(h)
      },
    })

    useImperativeHandle(ref, () => ({ focus: nav.focus }), [nav.focus])

    if (headings.length === 0) {
      return (
        <div className="h-full flex items-center justify-center px-6 py-10">
          <p className="text-xs text-muted italic text-center">{t('noToc')}</p>
        </div>
      )
    }

    return (
      <nav {...nav.containerProps} className="kbd-section py-2 focus:outline-none">
        {headings.map((h, idx) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            ref={(el) => {
              linkRefs.current[idx] = el
              nav.setItemRef(idx)(el)
            }}
            // `paddingInlineStart`, not `paddingLeft`: this is the one inline
            // style in the tree that would ignore `<html dir="rtl">` and indent
            // the outline off the wrong edge.
            style={{ paddingInlineStart: `${0.25 + h.depth * 0.5}rem` }}
            className={`panel-item ${activeId === h.id ? 'is-active' : 'is-muted'} ${idx === nav.idx ? 'is-kbd' : ''}`}
            onMouseEnter={() => nav.setIdx(idx)}
            onClick={(e) => {
              e.preventDefault()
              jumpTo(h)
            }}
          >
            {h.text}
          </a>
        ))}
      </nav>
    )
  },
)
