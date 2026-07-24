export type AdminModuleSection = 'readonly' | 'tool' | 'unavailable'
export type AdminModuleAvailability = 'readonly' | 'tool' | 'unavailable'

export type AdminModuleDefinition = {
  key: string
  label: string
  description: string
  href: string | null
  section: AdminModuleSection
  availability: AdminModuleAvailability
  iconKey: string
  matchingPaths: readonly string[]
}

export const ADMIN_MODULES: readonly AdminModuleDefinition[] = [
  {
    key: 'bookings',
    label: '預約紀錄',
    description: '查看最近載入的預約紀錄、狀態分類與未來／過去篩選。',
    href: '/admin/bookings',
    section: 'readonly',
    availability: 'readonly',
    iconKey: 'calendar-search',
    matchingPaths: ['/admin/bookings'],
  },
  {
    key: 'product-orders',
    label: '商品訂單',
    description: '查看商品摘要、金額及既有訂單／付款／物流狀態。',
    href: '/admin/product-orders',
    section: 'readonly',
    availability: 'readonly',
    iconKey: 'package-search',
    matchingPaths: ['/admin/product-orders'],
  },
  {
    key: 'members',
    label: '會員名錄',
    description: '查看 profiles 的基本會員資料；不讀取登入提供者或角色 metadata。',
    href: '/admin/members',
    section: 'readonly',
    availability: 'readonly',
    iconKey: 'users-search',
    matchingPaths: ['/admin/members'],
  },
  {
    key: 'bank-transfers',
    label: '歷史匯款回報',
    description: '查閱已停止流程的歷史回報；不提供審核、退款或改狀態。',
    href: '/admin/bank-transfers',
    section: 'readonly',
    availability: 'readonly',
    iconKey: 'banknote-search',
    matchingPaths: ['/admin/bank-transfers'],
  },
  {
    key: 'booking-slots',
    label: '預約時段工具',
    description: '既有的預約時段資料寫入工具；本次只整合入口，不擴充流程。',
    href: '/admin/booking-slots',
    section: 'tool',
    availability: 'tool',
    iconKey: 'calendar-cog',
    matchingPaths: ['/admin/booking-slots'],
  },
  ...[
    ['payment-operations', '金流營運中心'],
    ['ai-chart-operations', 'AI 命盤營運中心'],
    ['divination-operations', '占卜營運中心'],
    ['refund-operations', '退款／取消／補單'],
    ['webhook-reconciliation', 'Webhook 重送與對帳'],
    ['member-roles', '會員角色管理'],
    ['audit-log', '稽核紀錄'],
  ].map(([key, label]) => ({
    key,
    label,
    description: '尚未啟用，不提供按鈕、API 或操作入口。',
    href: null,
    section: 'unavailable' as const,
    availability: 'unavailable' as const,
    iconKey: 'lock',
    matchingPaths: [`/admin/${key}`],
  })),
]

export function getAdminModulesBySection(section: AdminModuleSection) {
  return ADMIN_MODULES.filter((module) => module.section === section)
}

export function isAdminModuleActive(
  module: AdminModuleDefinition,
  pathname: string,
) {
  return module.matchingPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}
