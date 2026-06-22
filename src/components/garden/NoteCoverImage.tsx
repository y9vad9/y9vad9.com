import Image from 'next/image'

/**
 * Cover image for a single note's article. The default `next/image`
 * path works in server mode (Next's optimiser plugs srcset in for us),
 * but under `ONVU_MODE=static` `next/image` is forced to
 * `unoptimized: true` in `next.config.ts`, which ships the source-width
 * variant with no srcset / sizes — terrible for LCP.
 *
 * Our pipeline already encodes a responsive ladder for every note cover
 * (see `processNoteImage` and `processStaticImage`) and stores it on
 * `Note.coverImageSrcSet`. When that's present we emit a plain `<img>`
 * with the explicit `srcSet`, an accurate `sizes` matching the article
 * column width, and the LCP hints (`loading="eager"`,
 * `fetchPriority="high"`) the browser needs to pull the cover in
 * before paint. Without `coverImageSrcSet` (external URL or SVG) we
 * fall back to `next/image` with `priority`.
 *
 * `sizes`: the article body is `max-w-3xl` (768px) inside `px-6` (24px
 * each side), nested inside `PanelWrapper`'s `px-2` (8px each side). So
 * the actual rendered width is 720px at the breakpoint and above, and
 * `100vw - 80px` (panel padding + article padding) below it. The previous
 * `(max-width: 768px) 100vw, 768px` over-claimed by 48px on every
 * viewport, which made the browser pick a one-step-too-large srcset
 * entry (e.g. 800w when 480w would do at 360 CSS px × 2 DPR).
 */
export function NoteCoverImage({
  src,
  srcSet,
  width,
  height,
  alt,
}: {
  src: string
  srcSet: string | null
  width: number | null
  height: number | null
  alt: string
}) {
  if (srcSet && width && height) {
    return (
      <div className="relative w-full aspect-video bg-bg rounded-xl overflow-hidden mb-6 border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          srcSet={srcSet}
          sizes="(min-width: 768px) 720px, calc(100vw - 80px)"
          alt={alt}
          loading="eager"
          // fetchPriority is camelCase in React 19+, lowercase as a DOM
          // attribute — React forwards the prop either way, but the
          // typed prop name is `fetchPriority`.
          fetchPriority="high"
          decoding="async"
          width={width}
          height={height}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    )
  }
  return (
    <div className="relative w-full aspect-video bg-bg rounded-xl overflow-hidden mb-6 border border-border">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 768px) 720px, calc(100vw - 80px)"
        priority
        className="object-cover"
      />
    </div>
  )
}
