'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useCart } from '@/components/CartContext'

const typeLabel: Record<string, string> = {
  divination: '占卜',
  consultation: '論命',
  course: '課程',
  booking: '論命',
  spiritual_product: '開運商品',
  other: '其他'
}

const postOfficeShippingStorageKey = 'waterbottle-post-office-shipping-info'

type PostOfficeShippingInfo = {
  recipientName: string
  recipientPhone: string
  postalCode: string
  city: string
  district: string
  address: string
  note: string
}

const emptyPostOfficeShippingInfo: PostOfficeShippingInfo = {
  recipientName: '',
  recipientPhone: '',
  postalCode: '',
  city: '',
  district: '',
  address: '',
  note: '',
}

export default function CartPage() {
  const { items, isLoaded, removeItem, totalAmount, totalQuantity } = useCart()
  const [spiritualProductsAccepted, setSpiritualProductsAccepted] = useState(false)
  const [postOfficeShippingInfo, setPostOfficeShippingInfo] = useState<PostOfficeShippingInfo>(emptyPostOfficeShippingInfo)
  const [checkoutError, setCheckoutError] = useState('')

  const formattedTotal = useMemo(() => `NT$${totalAmount.toLocaleString('zh-TW')}`, [totalAmount])
  const hasSpiritualProduct = items.some((item) => item.type === 'spiritual_product')

  const updatePostOfficeShippingInfo = (key: keyof PostOfficeShippingInfo, value: string) => {
    setPostOfficeShippingInfo((current) => ({
      ...current,
      [key]: value,
    }))
    setCheckoutError('')
  }

  const getTrimmedShippingInfo = () => ({
    recipientName: postOfficeShippingInfo.recipientName.trim(),
    recipientPhone: postOfficeShippingInfo.recipientPhone.trim(),
    postalCode: postOfficeShippingInfo.postalCode.trim(),
    city: postOfficeShippingInfo.city.trim(),
    district: postOfficeShippingInfo.district.trim(),
    address: postOfficeShippingInfo.address.trim(),
    note: postOfficeShippingInfo.note.trim(),
  })

  const handleCheckoutClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!hasSpiritualProduct) return

    const shippingInfo = getTrimmedShippingInfo()
    const isShippingInfoComplete =
      Boolean(shippingInfo.recipientName) &&
      Boolean(shippingInfo.recipientPhone) &&
      Boolean(shippingInfo.postalCode) &&
      Boolean(shippingInfo.city) &&
      Boolean(shippingInfo.district) &&
      Boolean(shippingInfo.address)

    if (!isShippingInfoComplete) {
      event.preventDefault()
      setCheckoutError('請完整填寫郵局寄送資料。')
      return
    }

    if (!spiritualProductsAccepted) {
      event.preventDefault()
      setCheckoutError('請先勾選同意開運商品購買須知與退換貨政策，再前往結帳。')
      return
    }

    try {
      window.localStorage.setItem(
        postOfficeShippingStorageKey,
        JSON.stringify({
          shipping_method: 'post_office',
          shipping_info: shippingInfo,
        }),
      )
    } catch {
      // If local storage is unavailable, keep the current checkout path unchanged.
    }
  }

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
              <p className="mt-2 text-textMuted">可先在其他未隱藏服務加入商品。</p>
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

              {hasSpiritualProduct ? (
                <section className="mt-6 rounded-2xl border border-borderSoft bg-softPurple p-5">
                  <p className="font-serifTC text-xl font-semibold text-deepPurple">開運商品購買確認</p>

                  <div className="mt-4 grid gap-4">
                    <div className="rounded-xl border border-borderSoft bg-white p-4">
                      <p className="font-serifTC text-xl font-semibold text-deepPurple">郵局寄送資料</p>
                      <p className="mt-2 text-sm leading-6 text-textMuted">
                        開運商品為實體商品，請填寫收件資料。訂單成立後，水瓶先生會依此資料安排郵局寄送。
                      </p>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-textDark">收件人姓名 *</span>
                          <input
                            className="focus-ring rounded-lg border border-borderSoft px-4 py-3"
                            onChange={(event) => updatePostOfficeShippingInfo('recipientName', event.target.value)}
                            value={postOfficeShippingInfo.recipientName}
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-textDark">收件人電話 *</span>
                          <input
                            className="focus-ring rounded-lg border border-borderSoft px-4 py-3"
                            onChange={(event) => updatePostOfficeShippingInfo('recipientPhone', event.target.value)}
                            value={postOfficeShippingInfo.recipientPhone}
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-textDark">郵遞區號 *</span>
                          <input
                            className="focus-ring rounded-lg border border-borderSoft px-4 py-3"
                            inputMode="numeric"
                            onChange={(event) => updatePostOfficeShippingInfo('postalCode', event.target.value)}
                            value={postOfficeShippingInfo.postalCode}
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-textDark">縣市 *</span>
                          <input
                            className="focus-ring rounded-lg border border-borderSoft px-4 py-3"
                            onChange={(event) => updatePostOfficeShippingInfo('city', event.target.value)}
                            value={postOfficeShippingInfo.city}
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-textDark">區域 *</span>
                          <input
                            className="focus-ring rounded-lg border border-borderSoft px-4 py-3"
                            onChange={(event) => updatePostOfficeShippingInfo('district', event.target.value)}
                            value={postOfficeShippingInfo.district}
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-textDark">詳細地址 *</span>
                          <input
                            className="focus-ring rounded-lg border border-borderSoft px-4 py-3"
                            onChange={(event) => updatePostOfficeShippingInfo('address', event.target.value)}
                            value={postOfficeShippingInfo.address}
                          />
                        </label>
                        <label className="grid gap-2 md:col-span-2">
                          <span className="text-sm font-semibold text-textDark">備註</span>
                          <textarea
                            className="focus-ring min-h-24 rounded-lg border border-borderSoft px-4 py-3"
                            onChange={(event) => updatePostOfficeShippingInfo('note', event.target.value)}
                            value={postOfficeShippingInfo.note}
                          />
                        </label>
                      </div>
                    </div>

                    <details className="rounded-xl border border-borderSoft bg-white p-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                        <span className="font-semibold text-deepPurple">開運商品購買須知</span>
                        <span className="rounded-full bg-softPurple px-3 py-1 text-xs font-semibold text-darkGold">點我查看</span>
                      </summary>
                      <div className="mt-4 space-y-4 text-sm leading-7 text-textMuted">
                        <p>以下商品為民俗信仰與祈福用品，僅供參考與心靈支持，不保證特定結果，亦不具醫療或治療效果。</p>
                        <div>
                          <p className="font-semibold text-deepPurple">商品使用與保存提醒</p>
                          <ol className="mt-2 grid gap-2">
                            <li>1. 符咒商品請保持乾燥、乾淨，避免碰水、受潮、髒污或任意折損。</li>
                            <li>2. 若需對折，請以印章朝外的方式整齊對折。</li>
                            <li>3. 商品用途屬民俗信仰祈福與心靈支持，無法取代醫療、法律、投資或其他專業建議。</li>
                            <li>4. 購買前請確認商品名稱、價格、用途、有效期限與注意事項。</li>
                            <li>5. 聚寶盆價格僅包含開光手法，不包含聚寶盆本體、符咒及相關材料費用，材料費需另計。</li>
                          </ol>
                        </div>
                      </div>
                    </details>

                    <details className="rounded-xl border border-borderSoft bg-white p-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                        <span className="font-semibold text-deepPurple">開運商品退換貨政策</span>
                        <span className="rounded-full bg-softPurple px-3 py-1 text-xs font-semibold text-darkGold">點我查看</span>
                      </summary>
                      <div className="mt-4 space-y-5 text-sm leading-7 text-textMuted">
                        <p>
                          為保障雙方權益，收到商品後，請先確認外包裝是否完整，並建議於開箱時全程錄影。開箱錄影主要用於確認商品是否有缺件、毀損、寄錯或運送過程異常，若後續需要申請退換貨，可作為雙方判斷依據。
                        </p>
                        <div>
                          <p className="font-semibold text-deepPurple">一、可申請退換貨情形</p>
                          <p className="mt-1">收到商品後，如有商品寄錯、缺件、運送過程明顯毀損，或商品與訂單內容明顯不符，請於收到商品後 7 日內與客服聯繫，並提供訂單資料、照片與開箱錄影。</p>
                        </div>
                        <div>
                          <p className="font-semibold text-deepPurple">二、不可退換貨情形</p>
                          <p className="mt-1">商品已使用、配戴、燒化、安置、碰水、受潮、髒污、破損、任意折損、保存不當，或已依個人需求處理、開光、過爐、安置或完成客製化程序者，恕不接受退換。</p>
                        </div>
                        <div>
                          <p className="font-semibold text-deepPurple">三、聚寶盆注意事項</p>
                          <p className="mt-1">聚寶盆標示價格僅包含開光手法，不包含聚寶盆本體、符咒及相關材料費用。材料費、器物費與其他客製需求，將依實際準備內容另行確認。</p>
                        </div>
                        <div>
                          <p className="font-semibold text-deepPurple">四、開箱錄影提醒</p>
                          <p className="mt-1">建議從未拆封外包裝開始拍攝，拍到包裹單號、外箱狀態、拆封過程、商品本體、配件、說明資料與全部內容物，影片請保持連續不要剪接。</p>
                        </div>
                        <p>開運商品屬民俗信仰與祈福用品，僅供參考與心靈支持，不保證特定結果，亦不具醫療、治療、法律、投資或其他專業建議效果。</p>
                      </div>
                    </details>

                    <label className="flex items-start gap-3 rounded-xl border border-borderSoft bg-white p-4 text-sm leading-7 text-textMuted">
                      <input
                        checked={spiritualProductsAccepted}
                        className="mt-1 size-4 rounded border-borderSoft text-deepPurple focus:ring-deepPurple"
                        onChange={(event) => {
                          setSpiritualProductsAccepted(event.target.checked)
                          if (event.target.checked) setCheckoutError('')
                        }}
                        type="checkbox"
                      />
                      <span>
                        我已詳細閱讀並了解《開運商品購買須知》與《開運商品退換貨政策》，並知道此類商品屬民俗信仰與祈福用品，不保證特定結果，亦不具醫療或治療效果。
                      </span>
                    </label>
                  </div>
                </section>
              ) : null}

              {checkoutError ? <p className="mt-4 text-sm font-semibold text-deepPurple">{checkoutError}</p> : null}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-borderSoft pt-6">
                <div>
                  <p className="text-sm text-textMuted">小計（{totalQuantity} 件）</p>
                  <p className="mt-1 font-serifTC text-2xl font-semibold text-deepPurple">{formattedTotal}</p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/bank-transfer"
                    onClick={handleCheckoutClick}
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
