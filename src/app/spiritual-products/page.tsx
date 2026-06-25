'use client'

import { useState } from 'react'
import { ShoppingCart, Sparkles } from 'lucide-react'
import { useCart } from '@/components/CartContext'
import { spiritualProducts, type SpiritualProduct } from '@/lib/spiritualProducts'

const careNotes = [
  '符咒請保持乾淨、乾燥，避免碰水、受潮或沾染髒污。',
  '請勿任意揉折、撕毀或放置於不潔之處。',
  '若需要對折，請以印章朝外的方式整齊對折，不可亂折。',
  '隨身攜帶型符咒，建議放在皮夾、包包內層或乾淨的夾鏈袋中。',
  '若符咒破損、受潮或不慎弄髒，建議先停止使用，並與客服聯繫確認後續處理方式。',
  '使用火化類符咒時，請注意通風與用火安全，並遠離易燃物。',
]

function ProductImage({ product }: { product: SpiritualProduct }) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-[#d9cce8] bg-softPurple text-sm font-semibold text-textMuted">
        圖片準備中
      </div>
    )
  }

  return (
    <img
      src={product.image}
      alt={product.name}
      className="aspect-[4/3] w-full rounded-xl object-cover"
      onError={() => setHasError(true)}
    />
  )
}

function ProductCard({
  product,
  purchaseNoticeAccepted,
  onRequirePurchaseNotice,
}: {
  product: SpiritualProduct
  purchaseNoticeAccepted: boolean
  onRequirePurchaseNotice: () => void
}) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)

  const handleAddToCart = () => {
    if (!purchaseNoticeAccepted) {
      onRequirePurchaseNotice()
      return
    }

    addItem({
      type: 'spiritual_product',
      id: product.slug,
      itemName: product.name,
      amount: product.priceTwd,
      quantity: 1,
    })
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1800)
  }

  return (
    <article className="flex h-full flex-col rounded-2xl border border-borderSoft bg-white p-4 shadow-soft">
      <ProductImage product={product} />

      <div className="mt-5 flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-softPurple px-3 py-1 text-xs font-semibold text-deepPurple">{product.category}</span>
          <span className="rounded-full bg-[#fff7e5] px-3 py-1 text-xs font-semibold text-darkGold">有效期限：{product.validity}</span>
        </div>

        <h2 className="mt-4 font-serifTC text-2xl font-semibold text-deepPurple">{product.name}</h2>
        <div className="mt-3 grid gap-3 text-sm leading-7 text-textMuted">
          <p>
            <span className="font-semibold text-deepPurple">祈願方向：</span>
            {product.description}
          </p>
          {product.usage ? (
            <p>
              <span className="font-semibold text-deepPurple">使用建議：</span>
              {product.usage}
            </p>
          ) : null}
          {product.note ? (
            <p>
              <span className="font-semibold text-darkGold">注意事項：</span>
              {product.note}
            </p>
          ) : null}
        </div>

        <div className="mt-auto pt-5">
          <p className="font-serifTC text-2xl font-semibold text-textDark">NT${product.priceTwd.toLocaleString('zh-TW')}</p>
          <button
            type="button"
            onClick={handleAddToCart}
            className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-deepPurple px-4 py-3 font-semibold text-white transition hover:bg-purpleMain"
          >
            <ShoppingCart size={18} />
            {added ? '已加入購物車' : '加入購物車'}
          </button>
        </div>
      </div>
    </article>
  )
}

export default function SpiritualProductsPage() {
  const [purchaseNoticeAccepted, setPurchaseNoticeAccepted] = useState(false)
  const [purchaseNoticeMessage, setPurchaseNoticeMessage] = useState('')

  const requirePurchaseNotice = () => {
    setPurchaseNoticeMessage('請先勾選同意開運商品購買須知後，再加入購物車。')
  }

  return (
    <div className="bg-white">
      <section className="bg-gradient-to-b from-[#faf7ff] to-white py-12 md:py-16">
        <div className="section-shell">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-[#fff7e5] px-4 py-2 text-sm font-semibold text-darkGold">
              <Sparkles size={16} />
              Spiritual Products
            </p>
            <h1 className="mt-5 font-serifTC text-4xl font-semibold text-deepPurple md:text-5xl">開運商品</h1>
            <p className="mt-4 text-lg leading-8 text-textMuted">
              以下商品為民俗信仰與祈福用品，僅供參考與心靈支持，不保證特定結果，亦不具醫療或治療效果。
            </p>
          </div>
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="section-shell grid gap-8">
          <section className="rounded-2xl border border-borderSoft bg-softPurple p-6 md:p-8">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="font-serifTC text-2xl font-semibold text-deepPurple">開運商品購買須知</span>
                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold text-darkGold shadow-sm transition group-open:bg-lightGold">
                  點我查看
                </span>
              </summary>

              <div className="mt-5 space-y-5 leading-8 text-textMuted">
                <p>以下商品為民俗信仰與祈福用品，僅供參考與心靈支持，不保證特定結果，亦不具醫療或治療效果。</p>

                <div>
                  <h2 className="font-serifTC text-xl font-semibold text-deepPurple">商品使用與保存提醒</h2>
                  <ol className="mt-3 grid gap-3">
                    <li>1. 符咒商品請保持乾燥、乾淨，避免碰水、受潮、髒污或任意折損。</li>
                    <li>2. 若需對折，請以印章朝外的方式整齊對折。</li>
                    <li>3. 商品用途屬民俗信仰祈福與心靈支持，無法取代醫療、法律、投資或其他專業建議。</li>
                    <li>4. 購買前請確認商品名稱、價格、用途、有效期限與注意事項。</li>
                    <li>5. 聚寶盆價格僅包含開光手法，不包含聚寶盆本體、符咒及相關材料費用，材料費需另計。</li>
                  </ol>
                </div>
              </div>
            </details>

            <div className="mt-5 rounded-xl bg-white px-4 py-4">
              <div className="flex items-start gap-3">
                <input
                  id="spiritual-products-purchase-notice"
                  type="checkbox"
                  checked={purchaseNoticeAccepted}
                  onChange={(event) => {
                    setPurchaseNoticeAccepted(event.target.checked)
                    if (event.target.checked) setPurchaseNoticeMessage('')
                  }}
                  className="mt-1 size-4 rounded border-borderSoft text-deepPurple focus:ring-deepPurple"
                />
                <label htmlFor="spiritual-products-purchase-notice" className="text-sm leading-7 text-textMuted">
                  我已詳細閱讀並了解《開運商品購買須知》，並知道此類商品屬民俗信仰與祈福用品，不保證特定結果，亦不具醫療或治療效果。
                </label>
              </div>
              {purchaseNoticeMessage ? (
                <p className="mt-3 rounded-lg bg-softPurple px-4 py-3 text-sm font-semibold text-deepPurple">{purchaseNoticeMessage}</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-borderSoft bg-softPurple p-6 md:p-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div>
                <p className="text-sm font-semibold text-darkGold">符咒介紹</p>
                <h2 className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple">民俗祈福用品說明</h2>
                <p className="mt-4 leading-8 text-textMuted">
                  所有符咒皆由水瓶先生親手製作，完成後會前往雲林北港武德宮過爐。符咒屬於民俗信仰與祈福用品，主要用於安定心念、加強祈願方向與作為日常提醒，不保證特定結果，亦不具醫療、治療或替代專業建議之效果。
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-darkGold">符咒保存與使用注意事項</p>
                <ol className="mt-4 grid gap-3 leading-7 text-textMuted">
                  {careNotes.map((note, index) => (
                    <li key={note} className="flex gap-3">
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-deepPurple">
                        {index + 1}
                      </span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {spiritualProducts.map((product) => (
              <ProductCard
                key={product.slug}
                product={product}
                purchaseNoticeAccepted={purchaseNoticeAccepted}
                onRequirePurchaseNotice={requirePurchaseNotice}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
