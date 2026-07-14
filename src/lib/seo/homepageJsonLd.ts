import { PUBLIC_PAGE_METADATA } from './publicMetadata'

const HOMEPAGE_URL = 'https://tsu-waterbottle.com/'
const ORGANIZATION_ID = 'https://tsu-waterbottle.com/#organization'
const WEBSITE_ID = 'https://tsu-waterbottle.com/#website'

export const HOMEPAGE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: PUBLIC_PAGE_METADATA.home.title,
      url: HOMEPAGE_URL,
      description: PUBLIC_PAGE_METADATA.home.description,
      logo: {
        '@type': 'ImageObject',
        url: 'https://tsu-waterbottle.com/brand/waterbottle-logo-web.png',
        width: 512,
        height: 512,
      },
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      url: HOMEPAGE_URL,
      name: PUBLIC_PAGE_METADATA.home.title,
      inLanguage: 'zh-TW',
      publisher: {
        '@id': ORGANIZATION_ID,
      },
    },
  ],
} as const

export function serializeJsonLd(value: unknown): string {
  const serialized = JSON.stringify(value)

  if (serialized === undefined) {
    throw new TypeError('JSON-LD value must be serializable')
  }

  return serialized.replace(/</g, '\\u003c')
}
