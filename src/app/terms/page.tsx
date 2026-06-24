import { PageHero } from '@/components/PageHero'
import { LineSupportText } from '@/components/LineSupportText'

const sections = [
  {
    title: '服務項目',
    body: '水瓶先生提供紫微斗數線上課程、AI 命盤分析、紫微牌卡占卜與真人論命預約等服務。各服務的內容、價格、交付方式與限制，依網站頁面揭露為準。',
  },
  {
    title: '會員帳號',
    body: '使用部分服務前需登入會員。請妥善保管帳號登入方式，並確認所填寫的聯絡資訊正確，以利查詢訂單、課程權限與服務通知。',
  },
  {
    title: '付款方式',
    body: '網站付款服務透過第三方金流或網站標示的付款方式處理。付款前請確認購買項目、金額、服務內容與退款規則。',
  },
  {
    title: '服務交付方式',
    body: '線上課程以會員中心權限或網站標示方式提供；AI 服務於付款後在網站產生結果；真人論命依預約時段進行線上諮詢。實際交付細節以各服務頁說明為準。',
  },
  {
    title: '使用者責任',
    body: '使用者應提供正確資料，並不得冒用他人身分、干擾網站服務、盜用課程內容或以違反法令、公序良俗的方式使用本網站。',
  },
  {
    title: '禁止事項',
    body: '未經同意不得轉售、翻錄、散布課程或服務內容，也不得嘗試繞過付款、權限或系統安全機制。',
  },
  {
    title: '服務變更',
    body: '本網站可能依營運需求調整服務內容、價格、頁面說明或使用規則。重大變更將盡可能於網站公告。',
  },
  {
    title: '免責聲明',
    body: '紫微斗數、占卜與命盤分析內容屬於個人參考與自我探索用途，不保證特定結果，也不取代法律、醫療、投資或其他專業意見。',
  },
  {
    title: '爭議處理',
    body: '若對訂單、付款、服務交付或退款有疑問，請提供訂單資料與問題內容，透過客服信箱 water.bottle.fortune.teller@gmail.com 或客服 LINE https://lin.ee/6Tpje1P 聯繫我們。客服時間：09:00–19:00。',
  },
  {
    title: '聯絡方式',
    body: '客服信箱：water.bottle.fortune.teller@gmail.com。客服 LINE：https://lin.ee/6Tpje1P。客服時間：09:00–19:00。',
  },
  {
    title: '營業人資訊',
    body: '營業人名稱：水瓶先生工作室。統一編號：61010005。商業登記地址：彰化縣田尾鄉饒平村東平巷167號1樓。',
  },
]

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Terms" title="服務條款" description="使用水瓶先生網站與服務前，請先閱讀以下基本服務規範。" />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
              <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">{section.title}</h2>
              <p className="mt-3 leading-8 text-textMuted">
                <LineSupportText text={section.body} />
              </p>
            </section>
          ))}
        </div>
      </section>
    </>
  )
}
