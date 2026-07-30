import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { themeBootstrapScript, META_COLOR_SCHEME } from '@lib/theme'
import './globals.css'
import '../../content/theme.css'

export const metadata: Metadata = {
  title: { template: '%s | Onvu', default: 'Onvu' },
  description: 'Personal portfolio and digital garden.',
}

/**
 * The garden is a fixed app shell rather than a scrolling document, so page
 * zoom fights the layout instead of helping — pinching mostly just knocks the
 * panels out of alignment. Pinning the scale keeps it behaving like an app.
 *
 * Note this is advisory on iOS: Safari has ignored `user-scalable=no` since
 * iOS 10 and clamps `maximumScale` so readers can always magnify. Android
 * Chrome honours it.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Colours the canvas the browser paints before the stylesheet loads.
  // See META_COLOR_SCHEME for why a meta tag and not the bootstrap script.
  colorScheme: META_COLOR_SCHEME,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        {/* Runs before React hydration.
            Registers a `default` Trusted Types policy so subsequent
            `innerHTML` assignments (note body MDX, Mermaid SVG, Giscus
            container clear) don't violate a
            `require-trusted-types-for 'script'` CSP. The policy is a
            passthrough — we already trust the content we generate
            server-side or load from giscus.app; a stricter sanitiser
            here would break legitimate HTML in note bodies. Sites
            that want sanitisation can register their own `default`
            policy earlier (a `<script src>` before this one). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.trustedTypes&&window.trustedTypes.createPolicy&&!window.trustedTypes.defaultPolicy){window.trustedTypes.createPolicy('default',{createHTML:function(s){return s;},createScript:function(s){return s;},createScriptURL:function(s){return s;}});}}catch(e){}})();`,
          }}
        />
        {/* Paints the persisted (or configured default) theme on the first
            frame — class *and* `color-scheme`. Must stay blocking and ahead
            of the stylesheet: anything deferred runs after the first paint,
            which is the flash we're removing. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript() }} />
      </head>
      <body className="bg-bg text-fg">{children}</body>
    </html>
  )
}
