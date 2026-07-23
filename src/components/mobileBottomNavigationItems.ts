export type MobileBottomNavigationItemKey =
  | 'home'
  | 'ai-chart'
  | 'ai-divination'
  | 'booking'
  | 'courses'
  | 'account'

type MobileBottomNavigationVisibility = {
  hideConsultationServices: boolean
  hideCoursesServices: boolean
}

export function getMobileBottomNavigationItemKeys({
  hideConsultationServices,
  hideCoursesServices,
}: MobileBottomNavigationVisibility): MobileBottomNavigationItemKey[] {
  const serviceItem: MobileBottomNavigationItemKey | null = !hideConsultationServices
    ? 'booking'
    : hideCoursesServices
      ? null
      : 'courses'

  return [
    'home',
    'ai-chart',
    'ai-divination',
    ...(serviceItem ? [serviceItem] : []),
    'account',
  ]
}
