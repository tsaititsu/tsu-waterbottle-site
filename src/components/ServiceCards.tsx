import Link from 'next/link'
import { serviceCards } from '@/lib/mockData'

function MiniChartIcon() {
  return (
    <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 40 40">
      <rect x="5" y="5" width="30" height="30" rx="3" stroke="currentColor" strokeWidth="2.4" />
      <path d="M15 5v10M25 5v10M5 15h10M25 15h10M5 25h10M25 25h10M15 25v10M25 25v10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M15 15h10v10H15z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="20" cy="20" r="2.2" fill="currentColor" />
    </svg>
  )
}

export function ServiceCards() {
  return (
    <section className="bg-white py-12 md:py-16">
      <div className="section-shell">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-darkGold">Services</p>
            <h2 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple">四大命理服務</h2>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {serviceCards.map((service) => {
            const Icon = service.icon
            const isChartService = service.title === '紫微命盤分析'
            return (
              <article key={service.title} className="rounded-xl border border-borderSoft bg-white p-5 shadow-[0_10px_26px_rgba(31,27,46,0.07)]">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-softPurple to-white text-purpleMain shadow-inner">
                    {isChartService ? <MiniChartIcon /> : <Icon size={25} />}
                  </div>
                  <span className="rounded-full bg-lightGold px-3 py-1 text-xs font-semibold text-darkGold">{service.badge}</span>
                </div>
                <h3 className="font-serifTC text-xl font-semibold text-deepPurple">{service.title}</h3>
                <p className="mt-3 min-h-12 leading-7 text-textMuted">{service.description}</p>
                <Link className="focus-ring mt-5 inline-flex w-full justify-center rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white shadow-[0_8px_18px_rgba(59,15,117,0.18)]" href={service.href}>
                  {service.cta}
                </Link>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
