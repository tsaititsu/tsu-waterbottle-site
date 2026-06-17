import Link from 'next/link'
import { XCircle } from 'lucide-react'

export default function PaymentFailPage() {
  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-2xl rounded-[28px] border border-borderSoft bg-white p-8 text-center shadow-soft">
        <XCircle className="mx-auto text-darkGold" size={54} />
        <h1 className="mt-5 font-serifTC text-3xl font-semibold text-deepPurple">付款失敗</h1>
        <p className="mt-4 leading-7 text-textMuted">這是 mock 失敗頁，後續串接金流時可接上錯誤原因與重試流程。</p>
        <Link className="focus-ring mt-7 inline-flex rounded-lg border border-gold bg-white px-6 py-3 font-semibold text-darkGold" href="/">
          回到首頁
        </Link>
      </div>
    </section>
  )
}
