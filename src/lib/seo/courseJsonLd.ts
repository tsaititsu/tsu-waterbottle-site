import { courseCatalog } from '../courses'
import { PUBLIC_PAGE_METADATA } from './publicMetadata'

const COURSES_URL = 'https://tsu-waterbottle.com/courses'
const ORGANIZATION_ID = 'https://tsu-waterbottle.com/#organization'

function getCourseUrl(courseId: string) {
  return `${COURSES_URL}#course-${courseId}`
}

const COURSE_PROVIDER = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: PUBLIC_PAGE_METADATA.home.title,
  url: 'https://tsu-waterbottle.com/',
} as const

export const COURSE_LIST_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  '@id': `${COURSES_URL}#course-list`,
  name: '紫微斗數三階段課程',
  url: COURSES_URL,
  numberOfItems: courseCatalog.length,
  itemListOrder: 'https://schema.org/ItemListOrderAscending',
  itemListElement: courseCatalog.map((course, index) => {
    const courseUrl = getCourseUrl(course.id)

    return {
      '@type': 'ListItem',
      position: index + 1,
      url: courseUrl,
      item: {
        '@type': 'Course',
        '@id': courseUrl,
        url: courseUrl,
        name: course.title,
        description: course.description,
        inLanguage: 'zh-TW',
        provider: COURSE_PROVIDER,
      },
    }
  }),
} as const
