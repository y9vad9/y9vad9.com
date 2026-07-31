import { describe, it, expect, vi } from 'vitest'

// The root layout imports fonts and global CSS, neither of which resolves
// under the node pool. We only care about the `viewport` export.
vi.mock('geist/font/sans', () => ({ GeistSans: { variable: '' } }))
vi.mock('geist/font/mono', () => ({ GeistMono: { variable: '' } }))

describe('root viewport', () => {
  it('is the plain responsive viewport', async () => {
    const { viewport } = await import('../../src/app/layout')
    expect(viewport).toMatchObject({ width: 'device-width', initialScale: 1 })
  })

  it('never restricts zoom', async () => {
    // This used to pin the scale so the panel layout could not be pinched out
    // of alignment. Magnification is how a low-vision reader reads the page at
    // all, so the layout does not get to win that trade — and iOS ignored the
    // restriction anyway, making it inconsistent as well as harmful.
    const { viewport } = await import('../../src/app/layout')
    expect(viewport.userScalable ?? true).toBe(true)
    expect(viewport.maximumScale ?? Infinity).toBeGreaterThanOrEqual(5)
  })

  it('declares a colour scheme so the pre-stylesheet canvas is not white', async () => {
    const { viewport } = await import('../../src/app/layout')
    const { META_COLOR_SCHEME } = await import('@lib/theme')
    expect(viewport.colorScheme).toBe(META_COLOR_SCHEME)
    expect(viewport.colorScheme).toBeTruthy()
  })
})
