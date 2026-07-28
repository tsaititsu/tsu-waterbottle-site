import type { Metadata } from 'next'
import { PageHero } from '@/components/PageHero'
import { PUBLIC_BUSINESS_INFO } from '@/lib/publicBusinessInfo'
import { createPublicMetadata, PUBLIC_PAGE_METADATA } from '@/lib/seo/publicMetadata'

export const metadata: Metadata = createPublicMetadata(PUBLIC_PAGE_METADATA.contact)

function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 rounded-xl bg-softPurple px-4 py-3 md:grid-cols-[200px_1fr]">
      <p className="font-semibold text-deepPurple">{label}</p>
      <div className="min-w-0 break-words text-textMuted">{children}</div>
    </div>
  )
}

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="聯絡我們" description="如有訂單、付款、課程或預約相關問題，請透過以下客服資訊聯繫。" />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-6">
          <section className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8">
            <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">客服資訊</h2>
            <div className="mt-5 grid gap-4">
              <ContactRow label="客服信箱">
                <a className="font-semibold text-deepPurple underline underline-offset-4" href={`mailto:${PUBLIC_BUSINESS_INFO.email}`}>
                  {PUBLIC_BUSINESS_INFO.email}
                </a>
              </ContactRow>
              <ContactRow label="客服 LINE">
                <a className="font-semibold text-deepPurple underline underline-offset-4" href={PUBLIC_BUSINESS_INFO.lineUrl} rel="noopener noreferrer" target="_blank">
                  加入 LINE 官方帳號
                </a>
              </ContactRow>
              <ContactRow label="客服時間">{PUBLIC_BUSINESS_INFO.customerServiceHoursLabel}</ContactRow>
            </div>
            <p className="mt-6 leading-7 text-textMuted">
              來信或聯繫客服時，建議提供會員帳號、訂單編號、付款時間與問題描述，方便客服協助查詢。
            </p>
          </section>

          <section className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8">
            <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">實體預約服務</h2>
            <div className="mt-5 grid gap-4">
              <ContactRow label="實體預約服務地點">{PUBLIC_BUSINESS_INFO.serviceAddressLabel}</ContactRow>
              <ContactRow label="實體預約時段">{PUBLIC_BUSINESS_INFO.appointmentHoursLabel}</ContactRow>
              <ContactRow label="來訪方式">{PUBLIC_BUSINESS_INFO.appointmentOnlyLabel}</ContactRow>
              <ContactRow label="Google Maps">
                <a
                  className="font-semibold text-deepPurple underline underline-offset-4"
                  href={PUBLIC_BUSINESS_INFO.mapsUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  在 Google Maps 查看
                </a>
              </ContactRow>
            </div>
          </section>

          <section className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8">
            <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">商業登記資訊</h2>
            <div className="mt-5 grid gap-4">
              <ContactRow label="營業人名稱">{PUBLIC_BUSINESS_INFO.legalName}</ContactRow>
              <ContactRow label="統一編號">{PUBLIC_BUSINESS_INFO.taxId}</ContactRow>
              <ContactRow label="商業登記地址（非實體服務地點）">
                {PUBLIC_BUSINESS_INFO.registrationAddress}
              </ContactRow>
              <ContactRow label="說明">{PUBLIC_BUSINESS_INFO.registrationAddressNote}</ContactRow>
            </div>
          </section>
        </div>
      </section>
    </>
  )
}
