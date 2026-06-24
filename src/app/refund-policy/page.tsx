import { PageHero } from '@/components/PageHero'
import { LineSupportText } from '@/components/LineSupportText'

const sections = [
  {
    title: '線上課程退款規則',
    body: '課程購買前請先確認課程名稱、價格、觀看方式與觀看期限。若課程內容尚未開通或因系統異常無法提供服務，可聯繫客服協助確認退款；已開通並可正常觀看之數位課程內容，原則上不提供退款。',
  },
  {
    title: 'AI 命盤分析退款規則',
    body: 'AI 命盤分析屬付款後產生分析結果的數位服務。分析結果已產生後，原則上不提供退款；若付款成功但系統未產生結果，請聯繫客服協助查詢與處理。',
  },
  {
    title: 'AI 占卜退款規則',
    body: '紫微牌卡占卜屬付款後產生占卜結果的數位服務。占卜結果已產生後，原則上不提供退款；若付款成功但系統未產生結果，請聯繫客服協助查詢與處理。',
  },
  {
    title: '真人論命預約退款與改期規則',
    body: '如需更改預約時間，請最晚於預約時間前一天告知，以便為您妥善安排。預約時間三天前取消，將全額退費；若於預約時間三天內取消，恕不退費，但可更改時間，請提前告知。遲到時間將照常計算，不另行補償。',
  },
  {
    title: '退款申請方式',
    body: '退款或改期申請請透過客服信箱 water.bottle.fortune.teller@gmail.com 或客服 LINE https://lin.ee/6Tpje1P 聯繫我們。客服時間：09:00–19:00。請提供會員帳號、訂單編號、付款時間、服務名稱與申請原因。',
  },
  {
    title: '退款處理時間',
    body: '退款審核通過後，實際入帳時間會依付款方式、金流服務與發卡銀行作業時間而不同；客服會於受理後協助追蹤處理狀態。',
  },
  {
    title: '營業人資訊',
    body: '營業人名稱：水瓶先生工作室。統一編號：61010005。商業登記地址：彰化縣田尾鄉饒平村東平巷167號1樓。',
  },
]

export default function RefundPolicyPage() {
  return (
    <>
      <PageHero eyebrow="Refund" title="退款政策" description="購買前請先確認各項服務的取消、改期與退款規則。" />
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
