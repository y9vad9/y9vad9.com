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
 * `sizes`: the article body is `max-w-3xl` (768px) inside `px-6`. On
 * mobile the image is full viewport width minus that padding; above the
 * breakpoint it's capped at 768px. `(max-width: 768px) 100vw, 768px`
 * is the right hint for the browser to pick the smallest srcset entry
 * that still has the right pixel density.
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
          sizes="(max-width: 768px) 100vw, 768px"
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
        sizes="(max-width: 768px) 100vw, 768px"
        priority
        className="object-cover"
      />
    </div>
  )
}
