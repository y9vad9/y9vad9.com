import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { SocialLink } from '@config/site'
import { resolveSocialIcon } from '@lib/socialIcon'
import { isExternalHref } from '@lib/url'
import { parseDecoratedImage } from '@lib/images/decoratedImage'
import { processStaticImage } from '@lib/images/processStaticImage'

/**
 * Hero is intentionally split into primitives so the landing composition
 * in `content/landing.tsx` can swap pieces — e.g. drop the avatar for a
 * full-bleed banner, add a CTA button, replace socials with a custom row.
 *
 * The default `Hero` export wires the four primitives together in the
 * shape most portfolio consumers want; reach for the primitives the
 * moment that shape doesn't fit.
 */

export function HeroSection({ children }: { children: ReactNode }) {
  return (
    <section className="pt-24 pb-16 px-4">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-8 md:gap-12">
        {children}
      </div>
    </section>
  )
}

export async function HeroAvatar({
  src,
  alt,
  className = '',
}: {
  src: string
  alt: string
  className?: string
}) {
  // Avatars may carry a `?dark-invert` marker — strip it so the encoder
  // sees a clean URL, then re-attach the resulting class to the rendered
  // image. SVG / external sources fall through to `next/image` (works
  // in both static and server mode).
  const { src: rawSrc, className: decoClass } = parseDecoratedImage(src)
  const optimised = await processStaticImage(rawSrc)
  const combinedClass = `rounded-2xl w-48 md:w-80 h-auto object-cover flex-shrink-0 ${decoClass} ${className}`.trim()

  if (optimised) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={optimised.src}
        srcSet={optimised.srcset || undefined}
        sizes="(max-width: 768px) 192px, 320px"
        width={optimised.width}
        height={optimised.height}
        alt={alt}
        loading="eager"
        decoding="async"
        className={combinedClass}
      />
    )
  }
  return (
    <Image
      src={rawSrc}
      alt={alt}
      width={320}
      height={320}
      className={combinedClass}
      priority
    />
  )
}

export function HeroIntro({
  name,
  bio,
  children,
}: {
  name: string
  bio: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 text-center md:text-start">
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{name}</h1>
      <p className="text-lg text-muted max-w-lg">{bio}</p>
      {children}
    </div>
  )
}

export function HeroSocials({ socials }: { socials: SocialLink[] }) {
  return (
    <div className="flex gap-3 justify-center md:justify-start flex-wrap mt-2">
      {socials.map((s) => {
        const external = isExternalHref(s.url) || s.platform.toLowerCase() === 'email'
        const target = external && s.platform.toLowerCase() !== 'email' ? '_blank' : undefined
        return (
          <Link
            key={`${s.platform}:${s.url}`}
            href={s.url}
            target={target}
            rel={target ? 'noopener noreferrer' : undefined}
            className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary-muted transition-all duration-300"
            aria-label={s.platform}
          >
            {resolveSocialIcon(s.platform, s.icon)}
          </Link>
        )
      })}
    </div>
  )
}

export function Hero({
  name,
  bio,
  profileImage,
  socials,
}: {
  name: string
  bio: string
  profileImage: string
  socials: SocialLink[]
}) {
  return (
    <HeroSection>
      {/* RSC: async component renders directly. */}
      <HeroAvatar src={profileImage} alt={name} />
      <HeroIntro name={name} bio={bio}>
        <HeroSocials socials={socials} />
      </HeroIntro>
    </HeroSection>
  )
}
