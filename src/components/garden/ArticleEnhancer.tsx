'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { useTabScrollRestore } from '@hooks/useTabScrollRestore'
import { useTabStore } from '@store/tabStore'
import { getCurrentTabAnchor } from '@lib/notes/currentTabAnchor'
import { decideWikiClickIntent } from '@lib/notes/wikiLinkClickIntent'

/**
 * Adds client-side enhancements to a rendered article:
 *  - Copy buttons on `<pre>` code blocks
 *  - Lightbox overlay on image click
 *  - Reading progress bar (updates `#reading-progress` width)
 *  - Per-tab scroll position restoration
 *
 * The component renders nothing into the article — it manipulates the DOM
 * after the article HTML has been mounted by the server component above.
 */
export function ArticleEnhancer({
  slug,
  containerSelector = 'article .prose',
}: {
  slug: string
  containerSelector?: string
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams<{ locale: string }>()

  useTabScrollRestore(slug)

  // Intercept clicks on wiki links inside the article body. These are raw
  // anchors emitted by the rehype pipeline (with data-note-slug) rather
  // than React `NoteLink` components, so without delegation the browser
  // does a full document navigation — which resets the page, blows away
  // tab state and feels like a hard reload. Route them through the
  // tabStore instead so they behave like NoteLink clicks: plain click
  // rewrites the active tab, Cmd/Ctrl-click pins as a new tab.
  useEffect(() => {
    const container = document.querySelector(containerSelector)
    if (!container) return

    function onClick(e: Event) {
      const me = e as MouseEvent
      const eventTarget = me.target as HTMLElement | null
      const anchor = eventTarget?.closest('a') as HTMLAnchorElement | null
      if (!anchor || !container!.contains(anchor)) return

      const noteSlug = anchor.getAttribute('data-note-slug')
      if (!noteSlug) return
      const href =
        anchor.getAttribute('href') || `/${params.locale}/notes/${noteSlug}`
      const title = anchor.textContent?.trim() || noteSlug

      const intent = decideWikiClickIntent(
        {
          button: me.button,
          ctrlKey: me.ctrlKey,
          metaKey: me.metaKey,
          shiftKey: me.shiftKey,
          altKey: me.altKey,
        },
        {
          noteSlug,
          href,
          title,
          broken: anchor.classList.contains('wikilink-broken'),
        },
        getCurrentTabAnchor(),
      )

      const store = useTabStore.getState()
      switch (intent.kind) {
        case 'ignore':
        case 'browser':
          return
        case 'broken':
          me.preventDefault()
          return
        case 'open-background':
          me.preventDefault()
          store.openInNewTab(intent.target, intent.current)
          return
        case 'open-new-tab':
          me.preventDefault()
          store.openInNewTab(intent.target, intent.current)
          router.push(intent.href)
          return
        case 'replace':
          me.preventDefault()
          store.replaceActive(intent.target, intent.currentSlug)
          router.push(intent.href)
          return
      }
    }

    // Middle-click usually fires `auxclick`, not `click` — listen to both so
    // both gestures route through the tab store.
    container.addEventListener('click', onClick)
    container.addEventListener('auxclick', onClick)
    return () => {
      container.removeEventListener('click', onClick)
      container.removeEventListener('auxclick', onClick)
    }
  }, [containerSelector, router, params.locale])

  // Reading progress bar — driven by the inner scroll container.
  useEffect(() => {
    const bar = document.getElementById('reading-progress')
    const scroller = document.getElementById('notes-scroll')
    if (!bar || !scroller) return
    function update() {
      const scrollTop = scroller!.scrollTop
      const docHeight = scroller!.scrollHeight - scroller!.clientHeight
      const ratio = docHeight > 0 ? Math.min(1, scrollTop / docHeight) : 0
      // scaleX rather than width — see `#reading-progress` in globals.css.
      bar!.style.transform = `scaleX(${ratio})`
    }
    scroller.addEventListener('scroll', update, { passive: true })
    update()
    return () => {
      scroller.removeEventListener('scroll', update)
      if (bar) bar.style.width = '0%'
    }
  }, [slug])

  // Code copy buttons + image lightbox handlers
  useEffect(() => {
    const container = document.querySelector(containerSelector)
    if (!container) return

    const cleanups: Array<() => void> = []

    // Code blocks
    const codeBlocks = container.querySelectorAll('pre')
    for (const pre of Array.from(codeBlocks)) {
      if (pre.dataset.enhanced) continue
      pre.dataset.enhanced = '1'

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'code-copy-btn'
      btn.setAttribute('aria-label', 'Copy code')
      btn.textContent = 'Copy'

      const onClick = async () => {
        const code = pre.querySelector('code')?.textContent ?? ''
        try {
          await navigator.clipboard.writeText(code)
          btn.textContent = 'Copied!'
          btn.classList.add('copied')
          setTimeout(() => {
            btn.textContent = 'Copy'
            btn.classList.remove('copied')
          }, 1500)
        } catch {
          btn.textContent = 'Failed'
        }
      }
      btn.addEventListener('click', onClick)
      pre.style.position = 'relative'
      pre.appendChild(btn)

      cleanups.push(() => {
        btn.removeEventListener('click', onClick)
        btn.remove()
        delete pre.dataset.enhanced
      })
    }

    // Images
    const images = container.querySelectorAll('img')
    for (const img of Array.from(images)) {
      if (img.dataset.enhanced) continue
      // Inline images are text-flow ornaments — never open them in a lightbox.
      if (img.classList.contains('inline-image')) continue
      img.dataset.enhanced = '1'

      const onClick = () => setLightboxSrc(img.getAttribute('src'))
      img.addEventListener('click', onClick)
      img.style.cursor = 'zoom-in'

      cleanups.push(() => {
        img.removeEventListener('click', onClick)
        delete img.dataset.enhanced
      })
    }

    return () => { for (const fn of cleanups) fn() }
  }, [slug, containerSelector])

  // Lightbox keyboard handling
  useEffect(() => {
    if (!lightboxSrc) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxSrc(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lightboxSrc])

  if (!lightboxSrc || typeof document === 'undefined') return null

  // Portal to <body> so the overlay escapes the body card's sticky stacking
  // context — otherwise the sticky header (z-40) and panels can overlap it,
  // and the backdrop-blur only blurs the content inside the card.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-fg/70 backdrop-blur-sm flex items-center justify-center p-8 cursor-zoom-out"
      onClick={() => setLightboxSrc(null)}
      role="dialog"
      aria-label="Image preview"
    >
      <button
        onClick={() => setLightboxSrc(null)}
        className="absolute top-4 right-4 p-2 rounded-lg bg-bg/80 hover:bg-bg text-fg transition-colors"
        aria-label="Close"
      >
        <X size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={lightboxSrc}
        alt=""
        className="max-w-full max-h-full object-contain rounded-xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  )
}
