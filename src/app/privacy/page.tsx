import { PageHero } from '@/components/PageHero'
import { LineSupportText } from '@/components/LineSupportText'

const sections = [
  {
    title: '蒐集資料類型',
    items: ['會員登入識別資料', '訂單與付款紀錄', '課程購買與觀看權限紀錄', '預約資料', '使用者於命盤或占卜服務中主動填寫的資料'],
  },
  {
    title: '使用目的',
    items: ['提供會員登入與帳務管理', '處理付款、訂單與服務交付', '維護課程權限與預約紀錄', '提供客服查詢與問題處理', '改善網站服務與安全性'],
  },
  {
    title: '第三方服務',
    items: [
      'Google / LINE 登入服務：用於會員登入與身分識別',
      '藍新金流付款服務：用於處理付款、付款結果與交易通知',
      'Supabase 資料庫與會員服務：用於保存會員、訂單、課程權限與服務紀錄',
      'Resend 電子郵件服務：用於寄送必要通知',
      'Google Calendar 預約排程服務：用於真人論命預約排程',
      'Vercel 網站部署服務：用於網站託管與部署',
    ],
  },
  {
    title: '資料保存',
    items: ['訂單、付款與服務紀錄會依營運、客服與法令需求保存', '不再需要或依法可刪除的資料，將依合理方式刪除或匿名化', '如需查詢、更正或刪除個人資料，請透過客服信箱或客服 LINE 聯繫我們處理'],
  },
  {
    title: '資料安全',
    items: ['本網站會以合理技術與管理措施保護資料安全', '金流金鑰與系統密鑰不會放在公開前端頁面', '請使用者妥善保管自己的登入方式'],
  },
  {
    title: '使用者權利',
    items: ['使用者可聯絡客服查詢與更正個人資料', '如需刪除或停止使用個人資料，請提供帳號與訂單資訊以便確認身分', '依法令或交易保存需求仍需保留的資料，將依相關規定處理'],
  },
  {
    title: '聯絡方式',
    items: ['客服信箱：water.bottle.fortune.teller@gmail.com', '客服 LINE：https://lin.ee/6Tpje1P', '客服時間：09:00–18:00'],
  },
  {
    title: '營業人資訊',
    items: ['營業人名稱：水瓶先生工作室', '統一編號：61010005', '商業登記地址：彰化縣田尾鄉饒平村東平巷167號1樓'],
  },
]

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Privacy" title="隱私權政策" description="說明本網站如何蒐集、使用與保護服務所需資料。" />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
              <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">{section.title}</h2>
              <ul className="mt-4 grid gap-3 leading-7 text-textMuted">
                {section.items.map((item) => (
                  <li key={item} className="rounded-xl bg-softPurple px-4 py-3">
                    <LineSupportText text={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </>
  )
}
