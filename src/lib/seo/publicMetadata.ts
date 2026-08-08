import type { Metadata } from 'next'
import { AI_CHART_REPORT_PRICE_LABEL } from '@/lib/ai-chart/pricing'
import { DIVINATION_READING_PRICE_LABEL } from '@/lib/divination/pricing'

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
    title: `紫微命盤分析 ${AI_CHART_REPORT_PRICE_LABEL}`,
    description: `輸入出生資料，建立紫微命盤並取得 AI 命盤分析，單次分析 ${AI_CHART_REPORT_PRICE_LABEL}。`,
    path: '/ai-chart',
  },
  aiDivination: {
    title: `紫微牌卡占卜 ${DIVINATION_READING_PRICE_LABEL}`,
    description: `輸入你的問題並抽取紫微牌卡，AI 即時提供深度解讀；抽牌免費，AI 解讀每次 ${DIVINATION_READING_PRICE_LABEL}。`,
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
  contact: {
    title: '聯絡我們',
    description: '如有訂單、付款、課程或預約相關問題，請透過客服信箱或官方 LINE 聯繫 WATERBOTTLE。',
    path: '/contact',
  },
  consumerRights: {
    title: '消費者權益說明',
    description: '查看 WATERBOTTLE 服務購買、付款紀錄、退款方式、客服聯絡與爭議處理等消費者權益資訊。',
    path: '/consumer-rights',
  },
  privacy: {
    title: '隱私權政策',
    description: '了解 WATERBOTTLE 如何蒐集、使用、保存及保護會員、訂單與服務所需資料。',
    path: '/privacy',
  },
  refundPolicy: {
    title: '退款政策',
    description: '查看 WATERBOTTLE 各項服務的取消、改期、退款申請方式與退款處理時間。',
    path: '/refund-policy',
  },
  terms: {
    title: '服務條款',
    description: '使用 WATERBOTTLE 網站與紫微命理服務前，請先閱讀服務內容、付款、使用規範與免責聲明。',
    path: '/terms',
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
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: 'WATERBOTTLE 紫微命理',
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: ['/twitter-image'],
    },
  }
}
