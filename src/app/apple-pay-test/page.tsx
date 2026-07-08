import type { Metadata } from 'next'
import Link from 'next/link'
import {
  TEMP_PRODUCT_APPLE_PAY_TEST_NOTICE,
  TEMP_PRODUCT_APPLE_PAY_TEST_PRICE,
} from '@/lib/products/productApplePayOneDollarTest'

export const metadata: Metadata = {
  title: 'Apple Pay 1 元商品測試',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ApplePayProductTestPage() {
  return (
    <main className="bg-white py-12 md:py-16">
      <div className="section-shell grid gap-7">
        <section className="rounded-2xl border border-[#f0cf8a] bg-[#fff8e7] p-6 shadow-soft md:p-8">
          <p className="text-sm font-semibold text-darkGold">Temporary Test</p>
          <h1 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple md:text-4xl">
            Apple Pay 1 元商品測試
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-textMuted">{TEMP_PRODUCT_APPLE_PAY_TEST_NOTICE}</p>
          <p className="mt-3 text-sm leading-7 text-textMuted">
            請到商品頁加入 1 件商品，再到購物車使用 Apple Pay 付款。實刷前請確認購物車只有 1 件商品。
          </p>
          <p className="mt-5 font-serifTC text-2xl font-semibold text-deepPurple">
            目前測試價格：NT${TEMP_PRODUCT_APPLE_PAY_TEST_PRICE}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="focus-ring rounded-xl bg-deepPurple px-5 py-3 font-semibold text-white"
              href="/spiritual-products"
            >
              前往開運商品
            </Link>
            <Link
              className="focus-ring rounded-xl border border-borderSoft px-5 py-3 font-semibold text-textDark"
              href="/cart"
            >
              前往購物車
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
