import type { NextConfig } from 'next'
import path from 'node:path'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const isStatic = process.env.ONVU_MODE === 'static'

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '~': path.resolve(process.cwd()),
    }
    return config
  },
  // Static export for Cloudflare Pages (and any other CDN-based host).
  // When ONVU_MODE=static, `next build` produces an `out/` directory.
  // API routes are not included in the static export; the client reads
  // pre-built JSON from public/_static/ instead (emitted by StaticBuildEmitter).
  ...(isStatic && {
    output: 'export',
    trailingSlash: true,
  }),
  images: {
    unoptimized: isStatic,
  },
  env: {
    NEXT_PUBLIC_ONVU_MODE: process.env.ONVU_MODE || 'server',
  },
  experimental: {
    // Rewrites `import { X, Y } from 'lucide-react'` (and the others
    // listed) into individual deep imports at build time so the named
    // imports actually tree-shake. Without this Next pulls the entire
    // icon barrel into the client bundle — a measurable hit Lighthouse
    // flags as "unused JavaScript". The list is opt-in per package.
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
}

export default withNextIntl(nextConfig)

