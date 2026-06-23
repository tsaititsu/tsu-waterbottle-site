export type CourseId = 'basic' | 'advanced' | 'master'

export type CourseInfo = {
  id: CourseId
  title: string
  subtitle: string
  description: string
  price: number
  level: number
  prerequisiteCourseId: CourseId | null
  contents: string[]
}

export const courseIds: CourseId[] = ['basic', 'advanced', 'master']

export const courseCatalog: CourseInfo[] = [
  {
    id: 'basic',
    title: '初級班',
    subtitle: '小白專區',
    description: '適合完全不懂紫微斗數的人，從基礎觀念、十二宮、十四主星、四化與流年大限入門開始學。',
    price: 9800,
    level: 1,
    prerequisiteCourseId: null,
    contents: [
      '紫微斗數基礎概念',
      '十二宮基本概念',
      '十四主星入門',
      '命盤基本結構',
      '三方四正',
      '六吉星、四煞星',
      '四化基礎',
      '流年與大限入門',
    ],
  },
  {
    id: 'advanced',
    title: '進階班',
    subtitle: '進階的解盤技巧',
    description: '學習夫妻宮、官祿宮、財帛宮、僕役宮、田宅宮、暗合連動與進階解盤技巧。',
    price: 9800,
    level: 2,
    prerequisiteCourseId: 'basic',
    contents: [
      '夫妻宮',
      '官祿宮',
      '財帛宮',
      '僕役宮',
      '田宅宮',
      '暗合連動',
      '進階解盤技巧',
      '實戰案例拆解',
    ],
  },
  {
    id: 'master',
    title: '高階班',
    subtitle: '飛化與占卜技巧',
    description: '學習福德宮、疾厄宮、高階占卜技巧、飛化技巧與實戰案例拆解。',
    price: 9800,
    level: 3,
    prerequisiteCourseId: 'advanced',
    contents: ['福德宮', '疾厄宮', '高階占卜技巧', '飛化技巧', '實戰案例拆解'],
  },
]

export function isCourseId(value: unknown): value is CourseId {
  return typeof value === 'string' && courseIds.includes(value as CourseId)
}

export function getCourseById(courseId: CourseId) {
  return courseCatalog.find((course) => course.id === courseId)
}

export function canBuyCourse(courseId: CourseId, purchasedCourseIds: CourseId[]) {
  if (courseId === 'basic') return true
  if (courseId === 'advanced') return purchasedCourseIds.includes('basic')
  if (courseId === 'master') return purchasedCourseIds.includes('advanced')
  return false
}

export function getCourseLockedReason(courseId: CourseId, purchasedCourseIds: CourseId[]) {
  if (courseId === 'advanced' && !purchasedCourseIds.includes('basic')) {
    return '請先購買初級班'
  }
  if (courseId === 'master' && !purchasedCourseIds.includes('advanced')) {
    return '請先購買進階班'
  }
  return null
}

export function formatCoursePrice(price: number) {
  return `NT$${price.toLocaleString('zh-TW')}`
}
