import Link from 'next/link'

export default function BookingCheckoutPage() {
  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-2xl rounded-[28px] border border-borderSoft bg-white p-8 text-center shadow-soft">
        <p className="text-sm font-semibold text-darkGold">Mock Checkout</p>
        <h1 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple">預約付款流程</h1>
        <p className="mt-4 leading-7 text-textMuted">目前付款流程使用頁面內的 mock 付款彈窗。正式金流串接時，這裡會改成金流結帳頁。</p>
        <Link className="focus-ring mt-7 inline-flex rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white" href="/booking">
          回到預約頁
        </Link>
      </div>
    </section>
  )
}
