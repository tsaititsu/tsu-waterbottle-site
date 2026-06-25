'use client'

import { useState } from 'react'
import { ShoppingCart, Sparkles } from 'lucide-react'
import { useCart } from '@/components/CartContext'
import { spiritualProducts, type SpiritualProduct } from '@/lib/spiritualProducts'

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

function ProductCard({ product }: { product: SpiritualProduct }) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)

  const handleAddToCart = () => {
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
        <p className="mt-2 text-sm leading-7 text-textMuted">{product.description}</p>
        {product.note ? <p className="mt-2 text-sm font-semibold text-darkGold">{product.note}</p> : null}

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
        <div className="section-shell">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {spiritualProducts.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
