import type { ReactNode } from 'react'
import { createElement } from 'react'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import * as SimpleIcons from 'react-icons/si'
import * as FaIcons from 'react-icons/fa6'
import type { IconType } from 'react-icons'

/**
 * Two icon sources cover socials:
 *   - Lucide for non-brand glyphs (Mail, Rss, Globe, Link, AtSign, …).
 *     lucide-react 1.x dropped every brand mark, so anything Github /
 *     Twitter / Linkedin-shaped has to come from elsewhere.
 *   - react-icons/si (Simple Icons) for the brand marks — tree-shaken
 *     per import, so only the brands users actually reference get into
 *     the bundle.
 *   - react-icons/fa6 (Font Awesome) for the handful of brands Simple
 *     Icons has since removed on trademark grounds (LinkedIn).
 *
 * Resolution order for each entry:
 *   1. If `iconName` is provided on the SocialLink, look it up in BOTH
 *      icon sets (PascalCase lucide name OR `Si*` / `Fa*` react-icons
 *      identifier). This lets a downstream user pick e.g. "SiBluesky"
 *      explicitly when they want a colour-accurate brand glyph.
 *   2. Otherwise consult `DEFAULTS` for the platform's standard glyph.
 *   3. Fall back to the platform's first letter so users at least see
 *      *something* if they typo'd the icon name.
 */

type IconRef =
  | { lib: 'lucide'; name: string }
  | { lib: 'si'; name: string }
  | { lib: 'fa'; name: string }

const DEFAULTS: Record<string, IconRef> = {
  github: { lib: 'si', name: 'SiGithub' },
  gitlab: { lib: 'si', name: 'SiGitlab' },
  // Simple Icons dropped the LinkedIn mark, so `SiLinkedin` is gone from
  // react-icons ≥ 5.6 and the lookup silently fell through to the
  // first-letter fallback ("L"). Font Awesome still ships the glyph.
  linkedin: { lib: 'fa', name: 'FaLinkedin' },
  twitter: { lib: 'si', name: 'SiX' },
  x: { lib: 'si', name: 'SiX' },
  instagram: { lib: 'si', name: 'SiInstagram' },
  youtube: { lib: 'si', name: 'SiYoutube' },
  twitch: { lib: 'si', name: 'SiTwitch' },
  facebook: { lib: 'si', name: 'SiFacebook' },
  telegram: { lib: 'si', name: 'SiTelegram' },
  discord: { lib: 'si', name: 'SiDiscord' },
  slack: { lib: 'si', name: 'SiSlack' },
  mastodon: { lib: 'si', name: 'SiMastodon' },
  bluesky: { lib: 'si', name: 'SiBluesky' },
  threads: { lib: 'si', name: 'SiThreads' },
  // Generic / non-brand glyphs stay on Lucide.
  email: { lib: 'lucide', name: 'Mail' },
  mail: { lib: 'lucide', name: 'Mail' },
  rss: { lib: 'lucide', name: 'Rss' },
  website: { lib: 'lucide', name: 'Globe' },
  link: { lib: 'lucide', name: 'Link' },
}

function lookup(iconName: string): IconType | LucideIcon | undefined {
  if (iconName.startsWith('Si')) {
    return (SimpleIcons as unknown as Record<string, IconType | undefined>)[iconName]
  }
  if (iconName.startsWith('Fa')) {
    return (FaIcons as unknown as Record<string, IconType | undefined>)[iconName]
  }
  return (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[iconName]
}

export function resolveSocialIcon(
  platform: string,
  iconName: string | undefined,
  size = 20,
): ReactNode {
  if (iconName) {
    const Icon = lookup(iconName)
    if (Icon) return createElement(Icon, { size })
  }
  const def = DEFAULTS[platform.toLowerCase()]
  if (def) {
    const Icon = lookup(def.name)
    if (Icon) return createElement(Icon, { size })
  }
  return createElement(
    'span',
    { className: 'text-base font-bold' },
    platform.charAt(0).toUpperCase(),
  )
}
