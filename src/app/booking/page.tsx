import { BookingForm } from '@/components/BookingForm'
import { PageHero } from '@/components/PageHero'

export default function BookingPage() {
  return (
    <>
      <PageHero
        eyebrow="真人預約"
        title="水瓶先生論命預約"
        description="由老師一對一協助你看懂命盤、感情、事業、財運與流年方向。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell">
          <BookingForm />
        </div>
      </section>
    </>
  )
}
