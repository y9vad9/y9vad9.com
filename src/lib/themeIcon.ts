import {
  Aperture,
  BookOpen,
  Brush,
  Circle,
  Cloud,
  CloudMoon,
  Coffee,
  Contrast,
  Droplet,
  Eye,
  Feather,
  Flame,
  Flower2,
  Ghost,
  Heart,
  Leaf,
  Lightbulb,
  Monitor,
  Moon,
  MoonStar,
  Mountain,
  Palette,
  Rainbow,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  SunMoon,
  Sunrise,
  Sunset,
  Terminal,
  Trees,
  Waves,
  Wind,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Theme icons, as an explicit registry rather than a lookup into the whole
 * icon package.
 *
 * `import * as LucideIcons` with a `[name]` access reads as the obvious way
 * to support "any PascalCase lucide name" from `site.config.ts`, and it is a
 * trap: the access is dynamic, so no bundler can prove which of the package's
 * ~5,950 exports are unused. The Header is a client component, so all of them
 * shipped — 600 KiB of SVG path data on every page, for the five icons the
 * default themes actually use. `optimizePackageImports` cannot help either;
 * it rewrites *named* imports and a namespace import gives it nothing to
 * rewrite.
 *
 * Naming each icon restores tree-shaking. The cost is that a custom theme can
 * only pick from this list, which is why it errs generous — anything
 * plausibly "a theme" is here. An unknown name falls back to `Palette`, the
 * same behaviour a typo had before.
 *
 * Adding one is a one-line change in two places: import it above, list it
 * below. Prefer that to reaching for the namespace import again.
 */
export const THEME_ICONS: Record<string, LucideIcon> = {
  // Used by the built-in themes.
  Sun,
  Moon,
  Coffee,
  Trees,
  Monitor,
  Palette,
  // Light and dark.
  Sunrise,
  Sunset,
  SunMoon,
  MoonStar,
  Cloud,
  CloudMoon,
  Star,
  Sparkles,
  Contrast,
  Lightbulb,
  // Nature and weather.
  Leaf,
  Flower2,
  Droplet,
  Flame,
  Waves,
  Mountain,
  Snowflake,
  Wind,
  Rainbow,
  Feather,
  // Everything else that reads as a mood.
  Zap,
  Heart,
  Eye,
  Ghost,
  Terminal,
  BookOpen,
  Aperture,
  Brush,
  Circle,
}

/** The icon for a configured theme, or `Palette` when the name is unknown. */
export function themeIconFor(name: string | undefined): LucideIcon {
  if (name === undefined) return Palette
  return THEME_ICONS[name] ?? Palette
}
