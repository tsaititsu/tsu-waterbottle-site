import type { ReactNode } from 'react'

export default function AdminDetailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-borderSoft bg-white p-5 shadow-soft md:p-6">
      <h2 className="font-serifTC text-xl font-semibold text-deepPurple">{title}</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

export function AdminDetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#faf7ff] p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-textMuted">{label}</dt>
      <dd className="mt-2 break-words text-sm leading-7 text-textDark">{value || '未提供'}</dd>
    </div>
  )
}
