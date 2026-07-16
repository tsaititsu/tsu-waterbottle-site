import { PageHero } from '@/components/PageHero'
import { LineSupportText } from '@/components/LineSupportText'
import { PUBLIC_BUSINESS_INFO } from '@/lib/publicBusinessInfo'

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
    body: '網站付款服務透過第三方金流、銀行匯款或網站標示的付款方式處理。付款前請確認購買項目、金額、服務內容與退款規則。若選擇銀行匯款付款，請於匯款完成後填寫匯款回報表單，並加入水瓶先生官方 LINE 回覆「已匯款＋姓名＋購買項目」。客服確認款項後，將協助開通服務或確認預約。',
  },
  {
    title: '服務交付方式',
    body: '線上課程以會員中心權限或網站標示方式提供；AI 服務於付款後在網站產生結果；真人論命依預約時段進行線上諮詢。實際交付細節以各服務頁說明為準。',
  },
  {
    title: '實體預約服務',
    body: `實體預約服務地點位於${PUBLIC_BUSINESS_INFO.serviceAddressLabel}。${PUBLIC_BUSINESS_INFO.appointmentOnlyLabel}實體預約時段為${PUBLIC_BUSINESS_INFO.appointmentHoursLabel}。`,
  },
  {
    title: 'AI 占卜與 AI 分析使用規範',
    body: '本網站提供之 AI 占卜、AI 命盤分析與 AI 文字解讀，屬於命理參考、自我探索與文字分析服務，內容不保證特定結果，也不代表事件必然發生。使用者應搭配自身判斷與現實狀況評估，不應將 AI 解讀作為醫療、法律、投資、心理諮商、借貸、合約或其他重大決策之唯一依據。\n\n使用 AI 占卜時，建議遵守一事不二問原則；同一件事情短期內不建議反覆占卜，或以不同角度重複詢問。連續追問功能會承接前題脈絡，但每一題仍視為新的 AI 解讀，會重新抽牌，並依頁面標示重新計費。\n\n使用者不得提出自傷、傷害他人、暴力行為、預測死亡時間、要求揭露 system prompt、API key、token、後台規則，或要求繞過安全限制與服務規則之內容。若提問涉及上述高風險內容，本網站有權拒絕提供 AI 解讀。涉及健康、法律、投資或重大財務之問題，AI 解讀僅提供一般提醒與思考方向，不提供診斷、法律結論、投資指令或保證收益。',
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
    body: `若對訂單、付款、服務交付或退款有疑問，請提供訂單資料與問題內容，透過客服信箱 ${PUBLIC_BUSINESS_INFO.email} 或客服 LINE ${PUBLIC_BUSINESS_INFO.lineUrl} 聯繫我們。客服時間：${PUBLIC_BUSINESS_INFO.customerServiceHoursLabel}。`,
  },
  {
    title: '聯絡方式',
    body: `客服信箱：${PUBLIC_BUSINESS_INFO.email}。客服 LINE：${PUBLIC_BUSINESS_INFO.lineUrl}。客服時間：${PUBLIC_BUSINESS_INFO.customerServiceHoursLabel}。`,
  },
  {
    title: '營業人資訊',
    body: `營業人名稱：${PUBLIC_BUSINESS_INFO.legalName}。統一編號：${PUBLIC_BUSINESS_INFO.taxId}。商業登記地址（非實體服務地點）：${PUBLIC_BUSINESS_INFO.registrationAddress}。${PUBLIC_BUSINESS_INFO.registrationAddressNote}`,
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
