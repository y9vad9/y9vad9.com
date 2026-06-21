import type { NavigationConfig } from '@config/navigation'

/**
 * Top navigation for the landing page. Edit freely — the framework will
 * not overwrite this file on `git pull upstream` (see `.gitattributes`).
 *
 * - Hrefs are site-relative (`/notes`, `#projects`). The active locale
 *   prefix is added automatically.
 * - To add per-language labels, add a `byLocale` entry whose key matches
 *   a locale code from `site.config.ts:locales.supported`.
 * - To drop or add a group/item, just edit the arrays below.
 */
export const navigation: NavigationConfig = {
  default: [
    {
      label: 'Notes',
      items: [{ label: 'View all notes', href: '/notes' }],
    },
    {
      label: 'Work',
      items: [
        { label: 'Experience', href: '#work-experience' },
        { label: 'Projects', href: '#projects' },
      ],
    },
    {
      label: 'About',
      items: [{ label: 'Summary', href: '#summary' }],
    },
  ],

  byLocale: {
    de: [
      {
        label: 'Notizen',
        items: [{ label: 'Alle Notizen', href: '/notes' }],
      },
      {
        label: 'Beruf',
        items: [
          { label: 'Berufserfahrung', href: '#work-experience' },
          { label: 'Projekte', href: '#projects' },
        ],
      },
      {
        label: 'Über',
        items: [{ label: 'Zusammenfassung', href: '#summary' }],
      },
    ],
    uk: [
      {
        label: 'Нотатки',
        items: [{ label: 'Усі нотатки', href: '/notes' }],
      },
      {
        label: 'Робота',
        items: [
          { label: 'Досвід', href: '#work-experience' },
          { label: 'Проєкти', href: '#projects' },
        ],
      },
      {
        label: 'Про мене',
        items: [{ label: 'Стисло', href: '#summary' }],
      },
    ],
  },
}
