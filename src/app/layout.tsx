import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import '../../content/theme.css'

export const metadata: Metadata = {
  title: { template: '%s | Onvu', default: 'Onvu' },
  description: 'Personal portfolio and digital garden.',
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
            1. Registers a `default` Trusted Types policy so subsequent
               `innerHTML` assignments (note body MDX, Mermaid SVG, Giscus
               container clear) don't violate a
               `require-trusted-types-for 'script'` CSP. The policy is a
               passthrough — we already trust the content we generate
               server-side or load from giscus.app; a stricter sanitiser
               here would break legitimate HTML in note bodies. Sites
               that want sanitisation can register their own `default`
               policy earlier (a `<script src>` before this one).
            2. Prevents the flash of unstyled theme by applying the
               persisted theme class to `<html>` synchronously. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.trustedTypes&&window.trustedTypes.createPolicy&&!window.trustedTypes.defaultPolicy){window.trustedTypes.createPolicy('default',{createHTML:function(s){return s;},createScript:function(s){return s;},createScriptURL:function(s){return s;}});}}catch(e){}try{var t=localStorage.getItem('theme');if(t){var p=JSON.parse(t);document.documentElement.className=document.documentElement.className.replace(/\\btheme-\\S+/g,'').trim()+' theme-'+p.state.theme;}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-bg text-fg">{children}</body>
    </html>
  )
}
