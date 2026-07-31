import Link from 'next/link'
import { ArrowRight, ExternalLink } from 'lucide-react'
import type { WorkEntry } from '@config/site'
import { isExternalHref } from '@lib/url'
import { PortfolioLogo } from './PortfolioLogo'

/**
 * One work-experience row. Caller decides spacing, ordering, and how many
 * to render (e.g. `entries.slice(0, 3).map(…)`).
 */
export function WorkItem({
  entry,
  viewLabel,
}: {
  entry: WorkEntry
  viewLabel: string
}) {
  const external = entry.url ? isExternalHref(entry.url) : false
  const Icon = external ? ExternalLink : ArrowRight

  const body = (
    <>
      <PortfolioLogo src={entry.logo} alt={entry.company} />
      <div className="flex-1 min-w-0">
        <p className="font-medium group-hover:text-primary transition-colors truncate">
          {entry.company} — {entry.role}
        </p>
        <p className="text-sm text-muted">{entry.period}</p>
      </div>
      {entry.url && (
        <span className="text-sm text-muted flex items-center gap-1 flex-shrink-0">
          {viewLabel} <Icon size={14} />
        </span>
      )}
    </>
  )

  // An entry with no `url` used to render `<Link href="">`, which is a link
  // to the current page: it offered a "View →" affordance and then silently
  // reloaded the landing page. Match `EducationItem` and render a plain row
  // instead, so an unset URL looks like what it is.
  if (!entry.url) {
    return (
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border">
        {body}
      </div>
    )
  }

  return (
    <Link
      href={entry.url}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary hover:bg-card transition-all duration-300 group"
    >
      {body}
    </Link>
  )
}
