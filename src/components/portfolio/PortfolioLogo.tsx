import Image from 'next/image'
import { parseDecoratedImage } from '@lib/images/decoratedImage'
import { processStaticImage } from '@lib/images/processStaticImage'

/**
 * Shared 32×32 logo renderer used by Work / Projects / Education rows.
 *
 * The portfolio components all spell the same logic — strip the
 * `?dark-invert` marker, run the result through the build-time WebP
 * encoder, fall back to `next/image` when the source can't be
 * optimised (SVG, external CDN, missing file). Living in one helper
 * keeps the three components honest with each other and gives the
 * encoder a single integration test target.
 *
 * `sizes` defaults to `32px` because the rows always render the logo at
 * the fixed pixel size; bumping the rendered size in a caller is fine
 * as long as it stays small relative to the source (the encoder won't
 * upscale).
 */
export async function PortfolioLogo({
  src,
  alt,
  className = '',
  sizes = '32px',
}: {
  /** Omit when the entry has no logo — the row renders without one. */
  src?: string
  alt: string
  className?: string
  sizes?: string
}) {
  // No logo is a normal state, not a missing asset: `WorkEntry.logo` and
  // `EducationEntry.logo` are optional, and rendering nothing beats rendering
  // a broken image.
  if (!src) return null

  const { src: rawSrc, className: decoClass } = parseDecoratedImage(src)
  const optimised = await processStaticImage(rawSrc)
  const combined = `rounded-md flex-shrink-0 ${decoClass} ${className}`.trim()

  if (optimised) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={optimised.src}
        srcSet={optimised.srcset || undefined}
        sizes={sizes}
        width={32}
        height={32}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={combined}
      />
    )
  }
  return (
    <Image
      src={rawSrc}
      alt={alt}
      width={32}
      height={32}
      className={combined}
    />
  )
}
