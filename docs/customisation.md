# Customisation

Everything under `content/` belongs to the site, not the template. `.gitattributes` marks the whole directory `merge=ours`, so your version wins when both you and upstream have changed the same file. [Upgrading](upgrading.md) explains what that protects and where it stops.

| Path | What it owns |
|:---|:---|
| `content/landing.tsx` | Composition of the portfolio home page. |
| `content/footer.tsx` | The landing page footer. |
| `content/navigation.ts` | Header menus, per locale. |
| `content/noteView.tsx` | Your markup above and below a note body. |
| `content/garden/<locale>.md` | The opening paragraph of the note index. |
| `content/theme.css` | Palettes and design tokens. |
| `content/i18n/<locale>.json` | String overrides and your own strings. |
| `content/notes/<locale>/` | The notes themselves. |

Two of these files import from `src/`, which is worth understanding before you edit them. `merge=ours` means you stop receiving upstream changes to `landing.tsx` and `footer.tsx`, so when a component's props change your copy drifts and you find out at `tsc` rather than at a merge conflict. That is the better failure of the two, but it is still a failure you have to handle.

## The landing page

`content/landing.tsx` exports one async server component, `LandingBody`, and it owns every high-level decision: which sections exist, in what order, what they are called, how many entries each shows.

The components it imports are deliberately small. `WorkItem` renders one job, not the work history. `SectionHeading` renders a heading, not a section with a heading. Keeping the primitives at that grain is what lets this file stay expressive.

Common edits:

| Goal | Edit |
|:---|:---|
| Hide a section | Delete its `<Section>` block. |
| Reorder sections | Move the blocks. |
| Show fewer entries | `.slice(0, 3)` on the array. |
| Drop a heading | Remove the `<SectionHeading>` line. |
| Untie a heading from its link | Remove the `href` prop. |
| Tint a section | `<Section className="bg-card">`. |
| Add a section | Write your own JSX. |

The hero is composed from `HeroSection`, `HeroAvatar`, `HeroIntro` and `HeroSocials`, so you can replace the avatar with a banner, add a call to action inside the intro, or write your own row of links instead of `HeroSocials`.

It runs on the server, so it can read the filesystem, call `loadSiteConfig(locale)`, query the note repository, or await anything else.

## The footer

`content/footer.tsx` exports `FooterBody`. It ships as a client component reading one translated string, which means you can use hooks in it. Make it a server component instead if you would rather.

## Header navigation

`content/navigation.ts` exports a `NavigationConfig`:

```ts
export const navigation: NavigationConfig = {
  default: [
    { label: 'Writing', items: [{ label: 'View all notes', href: '/notes' }] },
    {
      label: 'Work',
      items: [
        { label: 'Experience', href: '#work-experience' },
        { label: 'Projects', href: '#projects' },
      ],
    },
  ],
  byLocale: {
    de: [ /* the same structure, German labels */ ],
  },
}
```

A group with exactly one item renders as a flat link rather than a dropdown. Hrefs are site-relative and the active locale prefix is added for you; absolute URLs are left alone and open in the same tab unless you add `external: true`.

`byLocale` is a full replacement for a locale, not a deep merge, so a locale listed there needs the whole structure. A locale not listed uses `default`.

## Note slots

`content/noteView.tsx` is where you put your own markup around a note body. It exports up to two optional server components:

```tsx
import type { NoteViewProps } from '@lib/content/noteView'

export async function NoteHeaderExtras({ note }: NoteViewProps) {
  if (!note.tags.includes('book')) return null
  return (
    <aside className="mb-6 p-4 rounded-xl border border-border">
      <p className="text-sm text-muted">Reading time {note.readingTimeMinutes} min</p>
    </aside>
  )
}

export async function NoteFooterExtras({ note, locale }: NoteViewProps) {
  return <p className="text-xs text-muted">Cite: /{locale}/notes/{note.slug}</p>
}
```

Both receive the whole `Note` plus the locale, so a book-note card, a spoiler block, a "cite this" widget or a translation banner is ordinary JSX in your own file rather than a config schema someone had to anticipate. Exporting one and not the other is fine.

They are server components, the same as `content/landing.tsx`, because the note article is already async and server-rendered. There is no boundary to cross: read the filesystem, import framework components, call `loadSiteConfig`.

The file ships empty. A template shipping an example here would put its own markup on every fork's notes.

## The garden intro

`content/garden/<locale>.md` renders at the top of that locale's note index, above the pinned notes. It is ordinary Markdown: links, emphasis, lists and images all work, wiki links resolve against your notes, and relative image paths resolve against `content/garden/`.

It is deliberately not a note. Living under `content/notes/` would enrol it in the note list, the mention graph, the search index and the tab system, four places that would each need an exclusion. Nobody wants a "Welcome" node in their knowledge graph.

There is no default, and a locale without a file shows no intro at all.

The same file also supplies the index's meta description: the first prose paragraph, with headings, quotes and list blocks skipped, Markdown stripped, and a clip at 160 characters on a word boundary. Write the intro and the description takes care of itself.

## Themes and strings

`content/theme.css` and `content/i18n/` are covered in [Theming](theming.md) and [Localisation](localisation.md).

The short version: `theme.css` is loaded last and unlayered, so it overrides Tailwind utilities and `@theme` tokens without specificity games. `content/i18n/<locale>.json` deep-merges over `messages/<locale>.json`, and new keys are additive, so it is also where strings your own `content/` code needs should live.

`messages/` itself is framework-owned. Editing it works until the next upstream sync, at which point you get a conflict on a file you were never meant to hold.
