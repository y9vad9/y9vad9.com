import type { SiteConfig } from '@config/site'

export const config: SiteConfig = {
  owner: {
    name: 'Vadym Yaroshchuk',
    handle: 'y9vad9',
    profileImage: '/images/hero.webp',
    bio: 'Ich bin Softwareentwickler und begeisterter Software-Design-Enthusiast mit Sitz in München. Mein Schwerpunkt liegt auf Systemdesign und dem Kotlin-Ökosystem, wo ich mit Freude die strukturellen Rätsel löse, die andere oft übersehen. Diesen Raum nutze ich, um zu erforschen, wie man Software baut, die Bestand hat — mit klaren Verträgen, bewusstem Design und Code, der für sich selbst spricht.',
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
    name: 'Vadym Yaroshchuk',
    shortName: 'y9vad9',
    description: 'Softwareentwickler und Software-Design-Enthusiast in München. Ich erforsche Systemdesign und das Kotlin-Ökosystem, um Software mit klaren Verträgen zu bauen, die Bestand hat.',
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
        role: 'Web-Softwareentwickler (JS/TS) • Ausbildung',
        period: 'September 2025 — heute',
        url: '',
        logo: '/images/jochen-schweizer-mydays-group-logo.webp?dark-invert',
      },
      {
        company: 'Ajax Systems',
        role: 'Android-Softwareentwickler',
        period: 'Januar 2023 — April 2023',
        url: '',
        logo: '/images/ajax-systems-logo.webp?dark-invert',
      },
    ],

    projects: [
      {
        name: 'Cadento',
        description: 'Plattformübergreifende Produktivitätsanwendung, entwickelt mit Kotlin, Compose, Coroutines und Ktor.',
        url: 'notes/projects#cadento',
      },
      {
        name: 'Krawler',
        description: 'Mit Kotlin entwickelter Club-Manager-Bot für Brawl Stars (Telegram & Discord).',
        url: 'notes/projects#krawler',
      },
    ],

    education: [
      {
        institution: 'Offene Internationale Universität für menschliche Entwicklung „Ukraine“',
        degree: 'Bachelor in Softwaretechnik',
        period: '2022 — 2026',
        logo: '/images/OIUHD-Ukraine-logo.webp',
        url: 'notes/education#open-international-university-of-human-development-ukraine',
      },
      {
        institution: 'College der Internationalen Universität Kiew',
        degree: 'Nicht abgeschlossener Fachbachelor in Informatik',
        period: '2020 — 2022',
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
}
