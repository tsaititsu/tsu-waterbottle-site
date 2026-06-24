'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useCart } from '@/components/CartContext'

const typeLabel: Record<string, string> = {
  divination: '占卜',
  consultation: '論命',
  course: '課程',
  booking: '論命',
  other: '其他'
}

export default function CartPage() {
  const { items, isLoaded, removeItem, totalAmount, totalQuantity } = useCart()

  const formattedTotal = useMemo(() => `NT$${totalAmount.toLocaleString('zh-TW')}`, [totalAmount])

  return (
    <div className="bg-white py-12 md:py-16">
      <div className="section-shell grid gap-7">
        <section className="rounded-2xl border border-borderSoft bg-softPurple p-6 md:p-8">
          <p className="text-sm font-semibold text-darkGold">購物車</p>
          <h1 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple">購物車內容</h1>
          <p className="mt-2 max-w-2xl text-textMuted">目前購物車為審核展示用途，保留未付款的服務項目。</p>
        </section>

        <section className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8">
          {!isLoaded ? <p className="text-textMuted">載入中...</p> : null}

          {isLoaded && items.length === 0 ? (
            <div className="rounded-xl border border-[#eedec1] bg-softPurple p-6 text-center">
              <p className="font-semibold text-deepPurple">購物車目前沒有未付款項目</p>
              <p className="mt-2 text-textMuted">可先在占卜或論命頁面加入服務。</p>
            </div>
          ) : null}

          {isLoaded && items.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-borderSoft text-textMuted">
                      <th className="py-3 pr-4">項目名稱</th>
                      <th className="py-3 pr-4">類型</th>
                      <th className="py-3 pr-4">金額</th>
                      <th className="py-3 pr-4">數量</th>
                      <th className="py-3 pr-4">狀態</th>
                      <th className="py-3 pr-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={`${item.type}-${item.id}`} className="border-b border-borderSoft/70">
                        <td className="py-4 pr-4 font-semibold text-textDark">{item.itemName}</td>
                        <td className="py-4 pr-4">{typeLabel[item.type] ?? item.type}</td>
                        <td className="py-4 pr-4">NT${item.amount.toLocaleString('zh-TW')}</td>
                        <td className="py-4 pr-4">{item.quantity}</td>
                        <td className="py-4 pr-4">未付款</td>
                        <td className="py-4">
                          <button
                            type="button"
                            className="rounded-lg border border-borderSoft px-3 py-2 text-sm font-semibold text-deepPurple hover:bg-softPurple"
                            onClick={() => removeItem(item.id)}
                          >
                            刪除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-borderSoft pt-6">
                <div>
                  <p className="text-sm text-textMuted">小計（{totalQuantity} 件）</p>
                  <p className="mt-1 font-serifTC text-2xl font-semibold text-deepPurple">{formattedTotal}</p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/bank-transfer"
                    className="focus-ring rounded-xl bg-[#3d0d74] px-5 py-3 font-semibold text-white"
                  >
                    前往結帳
                  </Link>
                  <Link href="/" className="focus-ring rounded-xl border border-borderSoft px-5 py-3 font-semibold text-textDark">
                    繼續逛逛
                  </Link>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
