import path from 'node:path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { config as siteConfig } from './site.config'
import { resolveStaticTarget, resolveStaticBuild } from './src/lib/buildMode'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/**
 * What the deployed artifact will be, and whether this process is producing it.
 *
 * The two differ for `next dev`, which serves a real application with the route
 * handlers mounted no matter what the target is. Both rules live in
 * `@lib/buildMode`, with the reasoning, so they can be tested; a config file is
 * the one place in the repository nothing can reach.
 */
const staticTarget = resolveStaticTarget(process.env.ONVU_MODE, siteConfig.mode)
const staticBuild = resolveStaticBuild(
  process.env.ONVU_MODE,
  siteConfig.mode,
  process.env.NODE_ENV,
)

/**
 * One source for the subpath, shared by Next's own prefixing and by
 * `publicPath()` in the browser bundle. `next.config.ts` cannot be imported
 * client-side, hence the public env var rather than a second read of config.
 */
const basePath = (siteConfig.basePath ?? '').replace(/\/+$/, '')

const nextConfig: NextConfig = {
  ...(basePath && { basePath, assetPrefix: basePath }),
  // Static export for Cloudflare Pages (and any other CDN-based host).
  // `npm run build:static` produces an `out/` directory. API routes are not
  // included in it; the client reads pre-built JSON from public/_static/
  // instead (emitted by StaticBuildEmitter).
  ...(staticBuild && { output: 'export' }),
  /**
   * Which files count as routes.
   *
   * `output: 'export'` refuses route handlers, so the API routes have to be
   * absent from a static build rather than merely unused. They are named
   * `route.node.ts` and that suffix is only a route extension when this is not
   * a static build, which makes the exclusion a matter of configuration.
   *
   * The alternative was moving `src/app/api` out of the tree for the duration
   * of the build and moving it back afterwards. That works until the build is
   * interrupted, at which point the directory stays moved and the next build
   * fails on the leftover with an error about the wrong file.
   *
   * The default list is spelled out because naming any extension replaces it.
   */
  pageExtensions: staticBuild
    ? ['tsx', 'ts', 'jsx', 'js']
    : ['node.ts', 'tsx', 'ts', 'jsx', 'js'],
  // URL shape and image handling follow the *target*, not this process, so a
  // dev server for a static site still renders the URLs and the images that
  // site will actually ship. Neither of them breaks anything in dev, which is
  // the whole reason `output: 'export'` above is treated differently.
  trailingSlash: staticTarget,
  images: {
    unoptimized: staticTarget,
  },
  env: {
    // What the browser can actually reach. In dev that is always the API
    // routes, because the snapshots under public/_static/ are only written by
    // a production build.
    NEXT_PUBLIC_ONVU_MODE: staticBuild ? 'static' : 'server',
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // `loadSiteConfig` resolves `~/site.<locale>.config` by dynamic import, and
  // webpack has no `~` alias of its own — so the documented per-locale config
  // feature silently never applied on a stock clone, its failure swallowed by
  // the loader's own try/catch. The downstream fork had to patch this file and
  // `tsconfig.json`, both outside the `merge=ours` boundary, to use a feature
  // the template already advertised.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '~': path.resolve(process.cwd()),
    }
    return config
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

