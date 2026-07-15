import { ImageResponse } from 'next/og'
import { getDefaultShareImageElement } from '@/lib/seo/defaultShareImage'

export const alt = 'WATERBOTTLE 紫微命理'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function TwitterImage() {
  return new ImageResponse(await getDefaultShareImageElement(), size)
}
