'use client'

import Link from 'next/link'
import { forwardRef } from 'react'
import { useNoteLinkClick } from '@hooks/useNoteLinkClick'

type LinkProps = React.ComponentProps<typeof Link>

interface NoteLinkProps extends Omit<LinkProps, 'onClick'> {
  slug: string
  title: string
  onClick?: (e: React.MouseEvent) => void
}

/**
 * A Next.js Link to a note that integrates with the tab store:
 * plain click navigates only, Cmd/Ctrl+click opens a new in-app tab.
 */
export const NoteLink = forwardRef<HTMLAnchorElement, NoteLinkProps>(
  function NoteLink({ slug, title, onClick, ...rest }, ref) {
    const handleTabClick = useNoteLinkClick(slug, title)
    return (
      <Link
        prefetch={false}
        {...rest}
        ref={ref}
        onClick={(e) => {
          handleTabClick(e)
          if (!e.defaultPrevented) onClick?.(e)
        }}
      />
    )
  },
)
