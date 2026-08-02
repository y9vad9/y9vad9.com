import type { SiteConfig } from '@config/site'

export const config: SiteConfig = {
  owner: {
    name: 'Вадим Ярощук',
    handle: 'y9vad9',
    profileImage: '/images/hero.webp',
    bio: 'Я — інженер-програміст із Мюнхена, і найбільше мене цікавить проєктування ПЗ: системний дизайн та екосистема Kotlin. Люблю розплутувати структурні головоломки, які зазвичай обходять стороною. Тут розбираюся, як робити програмне забезпечення, що витримує час, — із чіткими контрактами, продуманим дизайном і кодом, який говорить сам за себе.',
    socials: [
      { platform: 'telegram', url: 'https://t.me/y9vad9' },
      { platform: 'linkedin', url: 'https://linkedin.com/in/y9vad9' },
      { platform: 'github', url: 'https://github.com/y9vad9' },
      { platform: 'instagram', url: 'https://instagram.com/y9vad9' },
      { platform: 'twitter', url: 'https://x.com/y9vad9' },
      { platform: 'threads', url: 'https://www.threads.net/@y9vad9' },
    ],
  },

  locales: {
    primary: 'en',
    supported: ['en', 'de', 'uk'],
  },

  defaultTheme: 'system',
  mode: 'static',

  pwa: {
    name: 'Вадим Ярощук',
    shortName: 'y9vad9',
    description: 'Інженер-програміст із Мюнхена, який живе проєктуванням ПЗ. Пишу про системний дизайн та екосистему Kotlin — про те, як робити програмне забезпечення, що витримує час, із чіткими контрактами.',
  },

  navigation: {
    featuredNotes: ['contract-violation-handling', 'semantic-typing', 'package-naming-problem'],
    workExperienceNote: 'experience',
    projectsNote: 'projects',
    educationNote: 'education',
    summaryNote: 'summary',
  },

  home: {
    workExperience: [
      {
        company: 'Jochen Schweizer mydays Group',
        role: 'Веб-розробник (JS/TS) • Стажування',
        period: 'Вересень 2025 — дотепер',
        url: 'notes/experience#jochen-schweizer-mydays-group',
        logo: '/images/jochen-schweizer-mydays-group-logo.webp?dark-invert',
      },
      {
        company: 'Ajax Systems',
        role: 'Android-розробник',
        period: 'Січень 2023 — Квітень 2023',
        url: 'notes/experience#ajax-systems',
        logo: '/images/ajax-systems-logo.webp?dark-invert',
      },
    ],

    projects: [
      {
        name: 'Cadento',
        description: 'Мультиплатформовий застосунок для продуктивності на Kotlin, Compose, Coroutines та Ktor.',
        url: 'notes/projects#cadento',
      },
      {
        name: 'Krawler',
        description: 'Бот-менеджер клубів для Brawl Stars на Kotlin (Telegram та Discord).',
        url: 'notes/projects#krawler',
      },
    ],

    education: [
      {
        institution: 'Відкритий міжнародний університет розвитку людини «Україна»',
        degree: 'Бакалавр з інженерії програмного забезпечення',
        period: 'Вересень 2022 — Червень 2026',
        logo: '/images/OIUHD-Ukraine-logo.webp',
        url: 'notes/education#open-international-university-of-human-development-ukraine',
      },
      {
        institution: 'Коледж Київського міжнародного університету',
        degree: "Незавершений фаховий молодший бакалавр з комп'ютерних наук",
        period: 'Вересень 2020 — Червень 2022',
        logo: '/images/KyMU-logo.webp',
        url: 'notes/education#college-of-kyiv-international-university',
      },
    ],
  },

  comments: {
    provider: 'giscus',
    repo: 'y9vad9/y9vad9.com',
    repoId: 'R_kgDOTBG89w',
    category: 'Announcements',
    categoryId: 'DIC_kwDOTBG8984C_nHl',
  },

  seo: {
    siteUrl: 'https://y9vad9.com',
    noindexPaths: ['/notes/graph'],
  },

  // The built-in `rss` action copies the feed URL. This site has a note
  // that explains feeds and lists every language's, which is a better
  // destination than a URL on the clipboard.
  garden: {
    actions: ['graph', 'random', { label: 'RSS-стрічки', href: 'notes/rss', icon: 'rss' }],
  },
}
