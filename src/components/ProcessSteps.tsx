import { processSteps } from '@/lib/mockData'

export function ProcessSteps() {
  return (
    <section className="bg-bgGray py-12 md:py-20">
      <div className="section-shell">
        <h2 className="text-center font-serifTC text-3xl font-semibold text-deepPurple">使用流程</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {processSteps.map((step, index) => {
            const Icon = step.icon
            return (
              <article key={step.title} className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-deepPurple text-sm font-semibold text-white">{index + 1}</div>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-softPurple text-purpleMain">
                    <Icon size={20} />
                  </div>
                </div>
                <h3 className="font-serifTC text-xl font-semibold text-deepPurple">{step.title}</h3>
                <p className="mt-2 text-textMuted">{step.description}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
