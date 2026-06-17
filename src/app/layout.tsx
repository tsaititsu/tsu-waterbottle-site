import type { Metadata } from 'next'
import '@/features/ziwei-chart/original-chart.css'
import './globals.css'
import '@/features/ziwei-chart/package/ziwei-chart-package.css'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { MobileBottomNav } from '@/components/MobileBottomNav'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tsu-waterbottle.com'),
  title: 'WATERBOTTLE 紫微命理',
  description: '紫微命盤分析、紫微牌卡占卜、水瓶先生論命預約與紫微課程服務。',
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'WATERBOTTLE 紫微命理',
    description: '紫微命盤分析、紫微牌卡占卜、水瓶先生論命預約與紫微課程服務。',
    url: '/',
    siteName: 'WATERBOTTLE',
    locale: 'zh_TW',
    type: 'website'
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-Hant" data-scroll-behavior="smooth">
      <body className="font-sansTC text-textDark">
        <Header />
        <main className="pb-20 md:pb-0">{children}</main>
        <Footer />
        <MobileBottomNav />
      </body>
    </html>
  )
}
