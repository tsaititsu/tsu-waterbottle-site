import { CheckCircle2 } from 'lucide-react'
import { memberBenefits } from '@/lib/mockData'

export function MemberBenefits() {
  return (
    <section className="bg-white py-12 md:py-20">
      <div className="section-shell">
        <h2 className="font-serifTC text-3xl font-semibold text-deepPurple">登入會員後可以保存</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {memberBenefits.map((benefit) => (
            <div key={benefit} className="flex items-center gap-3 rounded-xl border border-borderSoft bg-white p-4 shadow-soft">
              <CheckCircle2 className="text-gold" size={20} />
              <span className="font-semibold text-textDark">{benefit}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
