import { PageHero } from '@/components/PageHero'
import { LineSupportText } from '@/components/LineSupportText'
import { shouldHideConsultationServices, shouldHideCoursesServices } from '@/lib/siteVisibility'

function getSections() {
  const hideConsultationServices = shouldHideConsultationServices()
  const hideCoursesServices = shouldHideCoursesServices()

  return [
    {
      title: '付款前請確認服務內容',
      body: '購買前請確認服務名稱、價格、服務型態、交付方式、使用期限、是否預約制、是否訂閱制與退款規則。',
    },
    {
      title: '購買後如何取得服務',
      body: hideConsultationServices && hideCoursesServices
        ? 'AI 服務會於網站產生結果。若選擇銀行匯款付款，請於匯款完成後填寫匯款回報表單，並加入水瓶先生官方 LINE 回覆「已匯款＋姓名＋購買項目」。客服確認款項後，將協助處理服務或付款查詢。'
        : '線上課程會於會員中心提供課程權限；AI 服務會於網站產生結果；真人論命需依可預約時段完成預約並依約定方式進行諮詢。若選擇銀行匯款付款，請於匯款完成後填寫匯款回報表單，並加入水瓶先生官方 LINE 回覆「已匯款＋姓名＋購買項目」。客服確認款項後，將協助開通服務或確認預約。',
    },
    {
      title: '訂單與付款紀錄查詢',
      body: hideConsultationServices && hideCoursesServices
        ? '使用者可登入會員中心查看付款紀錄。若需查詢訂單或付款紀錄，請提供訂單資訊聯繫客服。'
        : '使用者可登入會員中心查看課程購買狀態。若需查詢付款或預約紀錄，請提供訂單資訊聯繫客服。',
    },
    {
      title: '取消、改期、退款方式',
      body: '各服務取消、改期與退款規則請參考退款政策頁。如需退款或改期，請透過客服信箱 water.bottle.fortune.teller@gmail.com 或客服 LINE https://lin.ee/6Tpje1P 聯繫我們。',
    },
    {
      title: '客服聯絡方式',
      body: '客服信箱：water.bottle.fortune.teller@gmail.com；客服 LINE：https://lin.ee/6Tpje1P；客服時間：09:00–18:00。',
    },
    {
      title: '爭議處理方式',
      body: '若對服務內容、付款結果或退款處理有疑問，請先聯繫客服並提供相關資料。雙方將依網站公告、交易紀錄與相關法令誠信處理。',
    },
    {
      title: '營業人資訊',
      body: '營業人名稱：水瓶先生工作室。統一編號：61010005。商業登記地址：彰化縣田尾鄉饒平村東平巷167號1樓。',
    },
  ]
}

export default function ConsumerRightsPage() {
  const sections = getSections()

  return (
    <>
      <PageHero eyebrow="Consumer Rights" title="消費者權益說明" description="購買前後的重要資訊與問題處理方式。" />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-5 md:grid-cols-2">
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
