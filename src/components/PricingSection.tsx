import { shouldHideConsultationServices } from '@/lib/siteVisibility'
import { pricingPlans } from '@/lib/mockData'
import { ActionButton } from './ActionButton'

export function PricingSection() {
  const visiblePlans = pricingPlans.filter((plan) => {
    if (plan.itemType === 'booking' && shouldHideConsultationServices()) return false
    return true
  })

  return (
    <section className="bg-white py-12 md:py-20">
      <div className="section-shell">
        <h2 className="font-serifTC text-3xl font-semibold text-deepPurple">熱門方案</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visiblePlans.map((plan) => (
            <article key={plan.title} className={`relative rounded-2xl border bg-white p-6 shadow-soft ${plan.featured ? 'border-gold' : 'border-borderSoft'}`}>
              {plan.badge && <span className="absolute right-5 top-5 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white">{plan.badge}</span>}
              <h3 className="font-serifTC text-2xl font-semibold text-deepPurple">{plan.title}</h3>
              <p className="mt-3 min-h-14 leading-7 text-textMuted">{plan.description}</p>
              <p className="mt-5 text-3xl font-semibold text-deepPurple">{plan.priceLabel}</p>
              <ActionButton
                itemType={plan.itemType}
                itemName={plan.title}
                amount={plan.price}
                className="focus-ring mt-6 w-full rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white"
              >
                {plan.cta}
              </ActionButton>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
