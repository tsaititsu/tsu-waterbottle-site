type PageHeroProps = {
  eyebrow: string
  title: string
  description: string
  contentClassName?: string
  centered?: boolean
  sectionClassName?: string
}

export function PageHero({ eyebrow, title, description, contentClassName = 'section-shell', centered = false, sectionClassName = 'py-12 md:py-16' }: PageHeroProps) {
  return (
    <section className={`bg-gradient-to-br from-softPurple via-white to-white ${sectionClassName}`}>
      <div className={`${contentClassName} ${centered ? 'text-center' : ''}`}>
        <p className="text-sm font-semibold text-darkGold">{eyebrow}</p>
        <h1 className="mt-2 font-serifTC text-4xl font-semibold text-deepPurple md:text-5xl">{title}</h1>
        <p className={`mt-5 max-w-2xl text-lg leading-8 text-textMuted ${centered ? 'mx-auto' : ''}`}>{description}</p>
      </div>
    </section>
  )
}
