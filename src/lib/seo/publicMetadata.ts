import type { Metadata } from 'next'

export const SITE_NAME = 'WATERBOTTLE'
export const SITE_TITLE = 'WATERBOTTLE 紫微命理'
export const SITE_DESCRIPTION = '紫微命盤分析、紫微牌卡占卜、水瓶先生論命預約與紫微課程服務。'

type PublicMetadataInput = {
  title: string
  description: string
  path: `/${string}`
  absoluteTitle?: boolean
}

export const PUBLIC_PAGE_METADATA = {
  home: {
    title: SITE_TITLE,
    description: '紫微命盤分析、紫微牌卡占卜、水瓶先生論命預約、紫微課程與開運商品服務。',
    path: '/',
    absoluteTitle: true,
  },
  aiChart: {
    title: '紫微命盤分析 NT$100',
    description: '輸入出生資料，建立紫微命盤並取得 AI 命盤分析，單次分析 NT$100。',
    path: '/ai-chart',
  },
  aiDivination: {
    title: '紫微牌卡占卜 NT$50',
    description: '輸入你的問題並抽取紫微牌卡，AI 即時提供深度解讀；抽牌免費，AI 解讀每次 NT$50。',
    path: '/ai-divination',
  },
  booking: {
    title: '水瓶先生論命預約',
    description: '預約水瓶先生一對一紫微斗數論命，查看可預約時段、服務流程與預約資訊。',
    path: '/booking',
  },
  courses: {
    title: '紫微斗數課程',
    description: '查看 WATERBOTTLE 紫微斗數課程內容、上課方式、開課資訊與報名方式。',
    path: '/courses',
  },
  spiritualProducts: {
    title: '開運商品',
    description: '查看 WATERBOTTLE 開運商品介紹、價格、購買須知與配送資訊。',
    path: '/spiritual-products',
  },
} as const satisfies Record<string, PublicMetadataInput>

export function createPublicMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: PublicMetadataInput): Metadata {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Public metadata path must be a local absolute path')
  }

  const socialTitle = absoluteTitle ? title : `${title}｜${SITE_TITLE}`

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: socialTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: 'zh_TW',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: socialTitle,
      description,
    },
  }
}
