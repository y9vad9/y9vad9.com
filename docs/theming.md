# Theming

A theme is a set of CSS custom properties declared under a `.theme-<id>` class, plus an entry in `site.config.ts` telling the picker it exists. That is the whole mechanism. There is no theme runtime, no JSON schema, and nothing to register.

## The tokens

Every palette declares the same twelve properties. `src/app/globals.css` defines the built-in five; `content/theme.css` overrides them.

| Token | Used for |
|:---|:---|
| `--bg` | Page background. |
| `--shell-bg` | Header, panels and other chrome. |
| `--fg` | Body text. |
| `--primary` | Links, accents, the active state. |
| `--primary-muted` | Tinted backgrounds derived from the accent. |
| `--muted` | Secondary text and icons. |
| `--warning` | Advisory marks such as the archived badge. |
| `--border` | Hairlines and dividers. |
| `--card` | Card and list-item surface. |
| `--card-hover` | The same on hover. |
| `--code-bg` | Inline and block code background. |
| `--selection` | Text selection highlight. |

Tailwind utilities are wired to these through the `@theme` block, so `bg-bg`, `text-fg`, `text-muted`, `border-border`, `bg-card` and `text-primary` all follow the active palette without any extra work.

`--warning` is per-palette rather than a fixed amber because Tailwind's `amber-500` measures 1.99:1 against the light background, well short of the 4.5:1 a small advisory mark needs. Light uses a darker amber; the dark palettes keep the bright one, where it is already legible.

## The built-in palettes

| Id | Canvas |
|:---|:---|
| `light` | Light, violet accent. |
| `dark` | Dark, violet accent. |
| `warm` | Dark, amber accent on brown. |
| `forest` | Dark, green accent. |
| `system` | Light or dark, following `prefers-color-scheme`. |

`system` is the only one defined inside media queries, which is what lets it track the OS while the other four are absolute choices.

## Overriding

`content/theme.css` is loaded after `globals.css` and is not inside a cascade layer, so it wins over both the defaults and Tailwind's own utilities without any specificity tricks.

Change one token everywhere:

```css
:root { --primary: #ff0080; }
```

Change it for one built-in palette:

```css
.theme-light { --primary: #ec4899; --primary-muted: #fce7f3; }
```

## Adding a palette

Two steps. Declare the tokens:

```css
.theme-ocean {
  --bg: #0c1e2e;
  --shell-bg: #0f2638;
  --fg: #e0f2fe;
  --primary: #38bdf8;
  --primary-muted: #082f49;
  --muted: #7dd3fc;
  --warning: #fbbf24;
  --border: #155e75;
  --card: #0f2638;
  --card-hover: #143049;
  --code-bg: #08172a;
  --selection: #0369a1;
}
```

Then list it in `site.config.ts`. Providing `themes` replaces the built-in list entirely, so include every palette you want offered:

```ts
themes: [
  { id: 'light',  label: 'light',  icon: 'Sun',     dark: false },
  { id: 'dark',   label: 'dark',   icon: 'Moon',    dark: true  },
  { id: 'ocean',  label: 'ocean',  icon: 'Waves',   dark: true  },
  { id: 'system', label: 'system', icon: 'Monitor' },
],
```

`icon` is a PascalCase Lucide name and defaults to `Palette`. `label` is looked up under the `theme.*` message namespace, so `label: 'ocean'` with a `theme.ocean` key in `content/i18n/<locale>.json` gets you a translated name. Without a matching key the literal string is used, which means `label: 'Ocean Blue'` works too if you never plan to translate it.

### Always declare `dark`

`dark` tells the browser what kind of canvas your palette paints on, and it feeds three things: the `color-scheme` CSS property, the `data-polarity` attribute on `<html>`, and the `<meta name="color-scheme">` tag.

Leave it out and the theme is treated as "follow the OS", which is right for a `system` entry and wrong for anything else. Two visible consequences on a dark palette without it:

The browser paints its own canvas before your render-blocking stylesheet arrives, and with no `color-scheme` it picks white. On a cold mobile load that is a white flash before your dark theme appears.

Syntax highlighting and inverted logos key off `[data-polarity='dark']`, not off theme names, so a custom dark palette that never declares `dark: true` gets light code blocks on a near-black background.

## How the flash is avoided

Three mechanisms, in the order the browser encounters them.

A `<meta name="color-scheme">` tag carries the configured default theme's polarity. It needs no execution, so the parser honours it immediately, before any stylesheet has loaded. It can only hold one static value, since this may be a static export.

A blocking inline script in `<head>` reads the stored theme from `localStorage`, then stamps the `theme-*` class, the `color-scheme` inline style and the `data-polarity` attribute on `<html>`. It runs before first paint. A returning reader whose stored theme differs from the configured default is corrected here.

The React provider takes over at hydration and keeps all three in step from then on.

The polarity attribute is stamped by both the script and the provider, not just the provider, because the polarity-keyed rules live in the render-blocking stylesheet. An attribute arriving only at hydration would paint one frame of light code blocks first.

## A single theme

Configure exactly one entry and the theme control disappears rather than surviving as a button that cycles back to the value you already have. The same rule applies to the language switcher on a single-locale site.
