import { ALL_WEEKDAYS, PUBLIC_BUSINESS_INFO } from '../publicBusinessInfo'
import { PUBLIC_PAGE_METADATA } from './publicMetadata'

const HOMEPAGE_URL = 'https://tsu-waterbottle.com/'
const ORGANIZATION_ID = 'https://tsu-waterbottle.com/#organization'
const WEBSITE_ID = 'https://tsu-waterbottle.com/#website'

export const HOMEPAGE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['Organization', 'LocalBusiness'],
      '@id': ORGANIZATION_ID,
      name: PUBLIC_PAGE_METADATA.home.title,
      alternateName: [
        PUBLIC_BUSINESS_INFO.brandName,
        PUBLIC_BUSINESS_INFO.legalName,
        PUBLIC_BUSINESS_INFO.mapsBusinessName,
      ],
      legalName: PUBLIC_BUSINESS_INFO.legalName,
      taxID: PUBLIC_BUSINESS_INFO.taxId,
      url: HOMEPAGE_URL,
      description: PUBLIC_PAGE_METADATA.home.description,
      logo: {
        '@type': 'ImageObject',
        url: 'https://tsu-waterbottle.com/brand/waterbottle-logo-web.png',
        width: 512,
        height: 512,
      },
      email: PUBLIC_BUSINESS_INFO.email,
      address: {
        '@type': 'PostalAddress',
        ...PUBLIC_BUSINESS_INFO.serviceAddress,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: PUBLIC_BUSINESS_INFO.latitude,
        longitude: PUBLIC_BUSINESS_INFO.longitude,
      },
      hasMap: PUBLIC_BUSINESS_INFO.mapsUrl,
      openingHoursSpecification: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ALL_WEEKDAYS,
        opens: '09:00',
        closes: '22:00',
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: PUBLIC_BUSINESS_INFO.email,
        availableLanguage: ['zh-TW'],
        hoursAvailable: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ALL_WEEKDAYS,
          opens: '09:00',
          closes: '18:00',
        },
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
