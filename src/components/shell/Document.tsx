import { GeistSans } from 'geist/font/sans'
import { themeBootstrapScript } from '@lib/theme'
import { localeDirection } from '@lib/i18n/direction'

/**
 * The `<html>` document every rendered route sits inside.
 *
 * This used to live in `src/app/layout.tsx` with `lang="en"` hardcoded — the
 * root layout sits above `[locale]`, so it has no way to know which language
 * it is wrapping. Every `/de` and `/uk` page therefore declared English to
 * screen readers and search engines, on a template whose headline feature is
 * being multi-locale. (A comment in `[locale]/not-found.tsx` asserted the
 * opposite, which is roughly why it went unnoticed.)
 *
 * Next allows exactly one `<html>` in a render tree, so the fix is to move it
 * *below* the locale segment and let the root layout pass through. That leaves
 * the handful of routes outside `[locale]` — the root 404 and the unprefixed
 * `/notes/<slug>` redirect — without a document, so they render this directly
 * with the default locale. One component rather than three copies: the theme
 * bootstrap and the Trusted Types policy have to be byte-identical everywhere
 * or the pages that miss them flash, and nobody would notice on a 404.
 */
export function Document({
  locale,
  children,
}: {
  locale: string
  children: React.ReactNode
}) {
  return (
    <html
      lang={locale}
      // Derived from the locale's script via `Intl`, so adding a right-to-left
      // language is a config change. Correct `dir` is also the precondition
      // for logical CSS properties doing anything at all.
      dir={localeDirection(locale)}
      suppressHydrationWarning
      className={GeistSans.variable}
    >
      {/* `next/head` is the Pages Router API; in the App Router a layout owns
          its own `<head>`. The rule fires only because this component lives
          outside `src/app/`, where the Next plugin exempts it. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
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
            frame — class, `color-scheme` and `data-polarity`. Must stay
            blocking and ahead of the stylesheet: anything deferred runs after
            the first paint, which is the flash we're removing. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript() }} />
      </head>
      <body className="bg-bg text-fg">{children}</body>
    </html>
  )
}
