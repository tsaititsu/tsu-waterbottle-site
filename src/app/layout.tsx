import type { Metadata, Viewport } from 'next'
import '@/features/ziwei-chart/original-chart.css'
import './globals.css'
import '@/features/ziwei-chart/package/ziwei-chart-package.css'
import { Footer } from '@/components/Footer'
import { FloatingLineButton } from '@/components/FloatingLineButton'
import { CartProvider } from '@/components/CartContext'
import { Header } from '@/components/Header'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from '@/lib/seo/publicMetadata'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tsu-waterbottle.com'),
  title: {
    default: SITE_TITLE,
    template: `%s｜${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      {
        url: '/brand/waterbottle-logo-transparent-cropped.png',
        type: 'image/png'
      }
    ],
    shortcut: '/brand/waterbottle-logo-transparent-cropped.png',
    apple: '/brand/waterbottle-logo-web.png'
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: 'zh_TW',
    type: 'website'
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-Hant" data-scroll-behavior="smooth">
      <body className="font-sansTC text-textDark">
        <CartProvider>
          <Header />
          <main className="site-main">{children}</main>
          <Footer />
          <FloatingLineButton />
          <MobileBottomNav />
        </CartProvider>
      </body>
    </html>
  )
}
