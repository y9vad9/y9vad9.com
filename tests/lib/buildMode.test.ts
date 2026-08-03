import { describe, it, expect } from 'vitest'
import { resolveStaticTarget, resolveStaticBuild } from '@lib/buildMode'

/**
 * `next dev` resolving to static mode broke every client feature that loads
 * data at once, and silently: `output: 'export'` stopped the API routes being
 * served, `NEXT_PUBLIC_ONVU_MODE` pointed the browser at snapshots only a
 * production build writes, and each consumer caught its own 404 and rendered
 * nothing. Link previews, the palette's note results, the explorer's full-text
 * search and both graph views were all dead on a stock `npm run dev`.
 */
describe('resolveStaticTarget', () => {
  it('follows the environment variable first', () => {
    expect(resolveStaticTarget('static', 'server')).toBe(true)
    expect(resolveStaticTarget('server', 'static')).toBe(false)
  })

  it('falls back to the configured mode', () => {
    expect(resolveStaticTarget(undefined, 'static')).toBe(true)
    expect(resolveStaticTarget(undefined, 'server')).toBe(false)
  })

  it('is a server build when nothing says otherwise', () => {
    expect(resolveStaticTarget(undefined, undefined)).toBe(false)
  })
})

describe('resolveStaticBuild', () => {
  it('is a static build when a production build targets static', () => {
    expect(resolveStaticBuild('static', undefined, 'production')).toBe(true)
    expect(resolveStaticBuild(undefined, 'static', 'production')).toBe(true)
  })

  it('is never static in development, whatever the config says', () => {
    // The regression. `site.config.ts` ships `mode: 'static'`, so a stock
    // `npm run dev` took the static branch and fetched files nothing writes.
    expect(resolveStaticBuild(undefined, 'static', 'development')).toBe(false)
  })

  it('is never static in development, even when the variable is forced', () => {
    // `ONVU_MODE=static npm run dev` still has to serve the API routes: dev
    // does not run the emitters that would make the static branch answerable.
    expect(resolveStaticBuild('static', 'static', 'development')).toBe(false)
  })

  it('is not static in a test run either', () => {
    expect(resolveStaticBuild('static', 'static', 'test')).toBe(false)
    expect(resolveStaticBuild('static', 'static', undefined)).toBe(false)
  })

  it('leaves a server target alone in production', () => {
    expect(resolveStaticBuild('server', 'static', 'production')).toBe(false)
    expect(resolveStaticBuild(undefined, undefined, 'production')).toBe(false)
  })

  it('never claims more than the target does', () => {
    // A static build is a strict subset: whenever this is true the target is
    // too, so nothing downstream can see a static build aimed at a server.
    for (const env of [undefined, 'static', 'server']) {
      for (const cfg of [undefined, 'static', 'server'] as const) {
        for (const node of [undefined, 'development', 'test', 'production']) {
          if (resolveStaticBuild(env, cfg, node)) {
            expect(resolveStaticTarget(env, cfg)).toBe(true)
          }
        }
      }
    }
  })
})
