import { PageHero } from '@/components/PageHero'

const lineSupportUrl = 'https://lin.ee/6Tpje1P'

const contactItems = [
  ['品牌名稱', '水瓶先生'],
  ['客服信箱', 'water.bottle.fortune.teller@gmail.com'],
  ['客服 LINE', lineSupportUrl],
  ['客服時間', '09:00–19:00'],
  ['營業人名稱', '水瓶先生工作室'],
  ['統一編號', '61010005'],
  ['商業登記地址', '彰化縣田尾鄉饒平村東平巷167號1樓'],
]

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="聯絡我們" description="如有訂單、付款、課程或預約相關問題，請透過以下客服資訊聯繫。" />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell">
          <div className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8">
            <div className="grid gap-4">
              {contactItems.map(([label, value]) => (
                <div key={label} className="grid gap-2 rounded-xl bg-softPurple px-4 py-3 md:grid-cols-[160px_1fr]">
                  <p className="font-semibold text-deepPurple">{label}</p>
                  {label === '客服 LINE' ? (
                    <a className="font-semibold text-deepPurple underline underline-offset-4" href={lineSupportUrl} rel="noopener noreferrer" target="_blank">
                      {value}
                    </a>
                  ) : (
                    <p className="text-textMuted">{value}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-6 leading-7 text-textMuted">
              來信或聯繫客服時，建議提供會員帳號、訂單編號、付款時間與問題描述，方便客服協助查詢。
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
