'use client'

import { useEffect } from 'react'

export function useReadingProgress() {
  useEffect(() => {
    const bar = document.getElementById('reading-progress')
    if (!bar) return

    function update() {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const ratio = docHeight > 0 ? Math.min(1, scrollTop / docHeight) : 0
      // scaleX rather than width — see `#reading-progress` in globals.css.
      bar!.style.transform = `scaleX(${ratio})`
    }

    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => window.removeEventListener('scroll', update)
  }, [])
}
