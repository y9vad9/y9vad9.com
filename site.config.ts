import type { SiteConfig } from '@config/site'

export const config: SiteConfig = {
  owner: {
    name: 'Vadym Yaroshchuk',
    handle: 'y9vad9',
    profileImage: '/images/hero.webp',
    bio: 'I am a Software Engineer and software design enthusiast based in Munich. My main focus is system design and the Kotlin ecosystem, where I enjoy solving the structural puzzles that others often overlook. I use this space to explore how to build software that lasts — focusing on clear contracts, intentional design, and code that speaks for itself.',
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
    description: 'Software Engineer & software design enthusiast in Munich. Exploring system design and the Kotlin ecosystem to build software that lasts with clear contracts.',
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
        role: 'Web (JS/TS) Software Engineer • Apprenticeship',
        period: 'September 2025 — Present',
        url: '',
        logo: '/images/jochen-schweizer-mydays-group-logo.webp?dark-invert',
      },
      {
        company: 'Ajax Systems',
        role: 'Android Software Engineer',
        period: 'January 2023 — April 2023',
        url: '',
        logo: '/images/ajax-systems-logo.webp?dark-invert',
      },
    ],

    projects: [
      {
        name: 'Cadento',
        description: 'Multiplatform productivity application built with Kotlin, Compose, Coroutines and Ktor.',
        url: 'notes/projects#cadento',
      },
      {
        name: 'Krawler',
        description: 'Kotlin-powered Club Manager Bot for Brawl Stars (Telegram & Discord)',
        url: 'notes/projects#krawler',
      },
    ],

    education: [
      {
        institution: 'Open International University of Human Development "Ukraine"',
        degree: "Bachelor's in Software Engineering",
        period: 'September 2022 — June 2026',
        logo: '/images/OIUHD-Ukraine-logo.webp',
        url: 'notes/education#open-international-university-of-human-development-ukraine',
      },
      {
        institution: 'College of Kyiv International University',
        degree: 'Incomplete Professional Junior Bachelor in "Computer Science"',
        period: 'September 2020 — June 2022',
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
