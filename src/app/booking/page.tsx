import { BookingForm } from '@/components/BookingForm'
import { PageHero } from '@/components/PageHero'
import { AddConsultationToCartButton } from '@/components/AddConsultationToCartButton'

const serviceRows = [
  '服務名稱：水瓶先生論命',
  '服務型態：一對一線上紫微斗數諮詢',
  '服務時間：60 分鐘',
  '價格：NT$3,600 / 1 小時',
  '諮詢方式：LINE 通話或 Zoom',
  '預約方式：付款後依網站可預約時段完成預約，或由客服協助確認時段。',
  '最長可預約時間：可預約未來 90 天內之諮詢時段。',
  '是否訂閱制：否。',
  '是否儲值式：否。',
  '改期：如需更改預約時間，請最晚於預約時間前一天告知，以便為您妥善安排。',
  '取消：預約時間三天前取消，將全額退費；若於預約時間三天內取消，恕不退費，但可更改時間，請提前告知。',
  '遲到：為保障其他客戶權益，請務必準時赴約，遲到時間將照常計算，不另行補償。',
]

export default function BookingPage() {
  return (
    <>
      <PageHero
        eyebrow="真人預約"
        title="水瓶先生論命預約"
        description="由老師一對一協助你看懂命盤、感情、事業、財運與流年方向。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-8">
          <section className="rounded-2xl border border-borderSoft bg-softPurple p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-darkGold">Service Notice</p>
            <h2 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple">真人論命服務說明</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {serviceRows.map((row) => (
                <div key={row} className="rounded-xl bg-white px-4 py-3">
                  <p className="leading-7 text-textMuted">{row}</p>
                </div>
              ))}
            </div>
          </section>
          <AddConsultationToCartButton />
          <BookingForm />
        </div>
      </section>
    </>
  )
}
