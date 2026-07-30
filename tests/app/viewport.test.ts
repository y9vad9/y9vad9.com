import { describe, it, expect, vi } from 'vitest'

// The root layout imports fonts and global CSS, neither of which resolves
// under the node pool. We only care about the `viewport` export.
vi.mock('geist/font/sans', () => ({ GeistSans: { variable: '' } }))
vi.mock('geist/font/mono', () => ({ GeistMono: { variable: '' } }))

describe('root viewport', () => {
  it('pins the scale so the garden shell behaves like an app, not a document', async () => {
    const { viewport } = await import('../../src/app/layout')
    expect(viewport).toMatchObject({
      width: 'device-width',
      initialScale: 1,
      minimumScale: 1,
      maximumScale: 1,
      userScalable: false,
    })
  })

  it('declares a colour scheme so the pre-stylesheet canvas is not white', async () => {
    const { viewport } = await import('../../src/app/layout')
    const { META_COLOR_SCHEME } = await import('@lib/theme')
    expect(viewport.colorScheme).toBe(META_COLOR_SCHEME)
    expect(viewport.colorScheme).toBeTruthy()
  })
})
