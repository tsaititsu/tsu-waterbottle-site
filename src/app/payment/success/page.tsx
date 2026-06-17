import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

export default function PaymentSuccessPage() {
  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-2xl rounded-[28px] border border-borderSoft bg-white p-8 text-center shadow-soft">
        <CheckCircle2 className="mx-auto text-gold" size={54} />
        <h1 className="mt-5 font-serifTC text-3xl font-semibold text-deepPurple">付款成功</h1>
        <p className="mt-4 leading-7 text-textMuted">已建立付款紀錄，並保存到會員中心。</p>
        <Link className="focus-ring mt-7 inline-flex rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white" href="/account">
          查看會員中心
        </Link>
      </div>
    </section>
  )
}
