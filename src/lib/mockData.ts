import { BookOpen, CalendarDays, Compass, CreditCard, FileText, MoonStar, Sparkles, UserRound } from 'lucide-react'

export const serviceCards = [
  {
    title: '紫微命盤分析',
    description: '輸入生日，產生紫微命盤報告',
    badge: '付費使用',
    cta: '立即分析',
    href: '/ai-chart',
    icon: FileText
  },
  {
    title: '紫微牌卡占卜',
    description: '輸入問題，取得占卜指引',
    badge: '付費使用',
    cta: '立即占卜',
    href: '/ai-divination',
    icon: Sparkles
  },
  {
    title: '水瓶先生論命',
    description: '預約老師一對一深度諮詢',
    badge: '付費預約',
    cta: '立即預約',
    href: '/booking',
    icon: UserRound
  },
  {
    title: '紫微斗數課程',
    description: '從零開始學會看命盤',
    badge: '即將開課',
    cta: '查看課程',
    href: '/courses',
    icon: BookOpen
  }
]

export const processSteps = [
  { title: '登入會員', description: 'LINE / Google Email', icon: UserRound },
  { title: '選擇服務', description: '選擇想使用的命理服務', icon: Compass },
  { title: '完成付款', description: '多種付款方式安全付款', icon: CreditCard },
  { title: '查看結果', description: '立即取得專屬結果', icon: MoonStar }
]

export const pricingPlans = [
  {
    itemType: 'ai-divination',
    title: '紫微牌卡占卜單次',
    description: '針對單一問題提供指引與建議',
    price: 50,
    priceLabel: 'NT$50 / 次',
    cta: '立即占卜',
    href: '/ai-divination',
    featured: false,
    badge: ''
  },
  {
    itemType: 'ai-chart',
    title: '紫微命盤完整分析',
    description: '完整解析命盤個性分析',
    price: 100,
    priceLabel: 'NT$100 / 份',
    cta: '立即分析',
    href: '/ai-chart',
    featured: true,
    badge: '最受歡迎'
  },
  {
    itemType: 'booking',
    title: '水瓶先生論命',
    description: '老師一對一深度諮詢 60 分鐘',
    price: 3600,
    priceLabel: 'NT$3,600 / 1 小時',
    cta: '立即預約',
    href: '/booking',
    featured: false,
    badge: ''
  }
] as const

export const accountStats = [
  { title: '我的命盤', value: '已儲存 3 張命盤' },
  { title: '命盤分析報告', value: '已購買 2 份報告' },
  { title: '紫微牌卡占卜紀錄', value: '已完成 5 次占卜' },
  { title: '真人預約', value: '下一次預約：2026/08/18' },
  { title: '我的課程', value: '已加入候補名單' },
  { title: '付款紀錄', value: '查看所有付款紀錄' }
]

export const courseItems = [
  '初級班｜小白專區',
  '進階班｜進階的解盤技巧',
  '高階班｜飛化與占卜技巧'
]

export const bookingSlots = [
  '2026/07/03 14:00',
  '2026/07/07 20:00',
  '2026/07/12 10:30',
  '2026/07/18 16:00'
]

export const memberBenefits = ['我的命盤', '命盤分析報告', '紫微牌卡占卜紀錄', '真人預約', '我的課程', '付款紀錄']
