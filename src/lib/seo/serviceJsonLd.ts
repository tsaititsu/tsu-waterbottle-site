import { serializeJsonLd } from './homepageJsonLd'
import { PUBLIC_PAGE_METADATA } from './publicMetadata'

const SITE_URL = 'https://tsu-waterbottle.com'
const ORGANIZATION_ID = `${SITE_URL}/#organization`

export const AI_CHART_SERVICE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  '@id': `${SITE_URL}/ai-chart#service`,
  name: '紫微命盤分析',
  serviceType: 'AI 紫微命盤分析',
  description: PUBLIC_PAGE_METADATA.aiChart.description,
  url: `${SITE_URL}/ai-chart`,
  mainEntityOfPage: `${SITE_URL}/ai-chart`,
  provider: {
    '@id': ORGANIZATION_ID,
  },
  offers: {
    '@type': 'Offer',
    name: 'AI 命盤分析',
    price: 100,
    priceCurrency: 'TWD',
    url: `${SITE_URL}/ai-chart`,
  },
} as const

export const AI_DIVINATION_SERVICE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  '@id': `${SITE_URL}/ai-divination#service`,
  name: '紫微牌卡占卜',
  serviceType: '紫微牌卡占卜與 AI 解讀',
  description: PUBLIC_PAGE_METADATA.aiDivination.description,
  url: `${SITE_URL}/ai-divination`,
  mainEntityOfPage: `${SITE_URL}/ai-divination`,
  provider: {
    '@id': ORGANIZATION_ID,
  },
  offers: {
    '@type': 'Offer',
    name: '紫微牌卡 AI 解讀',
    price: 50,
    priceCurrency: 'TWD',
    url: `${SITE_URL}/ai-divination`,
  },
} as const

export const BOOKING_SERVICE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  '@id': `${SITE_URL}/booking#service`,
  name: '水瓶先生論命預約',
  serviceType: '一對一紫微斗數論命',
  description: PUBLIC_PAGE_METADATA.booking.description,
  url: `${SITE_URL}/booking`,
  mainEntityOfPage: `${SITE_URL}/booking`,
  provider: {
    '@id': ORGANIZATION_ID,
  },
} as const

export { serializeJsonLd }
