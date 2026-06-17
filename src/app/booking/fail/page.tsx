import Link from 'next/link'

export default function BookingFailPage() {
  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-2xl rounded-[28px] border border-borderSoft bg-white p-8 text-center shadow-soft">
        <h1 className="font-serifTC text-3xl font-semibold text-deepPurple">預約未完成</h1>
        <p className="mt-4 leading-7 text-textMuted">付款或預約確認未完成，尚未建立正式預約。</p>
        <Link className="focus-ring mt-7 inline-flex rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white" href="/booking">
          回到預約頁
        </Link>
      </div>
    </section>
  )
}
