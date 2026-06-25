'use client'

import { MessageCircle, ShieldCheck, ShoppingCart, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useCart } from '@/components/CartContext'

const DEFAULT_ZIWEI_CARD_URL = 'https://ziwei-card.vercel.app'

type DivinationEntryModuleProps = {
  baseUrl?: string
  campaign?: string
  className?: string
  source?: string
}

function buildDivinationUrl({
  baseUrl = DEFAULT_ZIWEI_CARD_URL,
  campaign = 'official-site',
  source = 'tsu-waterbottle-site'
}: Pick<DivinationEntryModuleProps, 'baseUrl' | 'campaign' | 'source'> = {}) {
  const url = new URL('/reading', baseUrl)
  url.searchParams.set('utm_source', source)
  url.searchParams.set('utm_campaign', campaign)
  return url.toString()
}

export function DivinationEntryModule({
  baseUrl,
  campaign,
  className = '',
  source
}: DivinationEntryModuleProps) {
  const readingUrl = buildDivinationUrl({ baseUrl, campaign, source })
  const { addItem } = useCart()
  const [message, setMessage] = useState('')
  const [hasAcceptedNotice, setHasAcceptedNotice] = useState(false)

  const noticeError = '請先閱讀並勾選同意 AI 占卜服務說明、付款與退款規則及服務條款。'

  const validateNotice = () => {
    if (hasAcceptedNotice) {
      setMessage('')
      return true
    }

    setMessage(noticeError)
    return false
  }

  return (
    <section className={`rounded-2xl border border-gold/50 bg-softPurple p-6 shadow-soft ${className}`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-lightGold px-3 py-1 text-xs font-semibold text-darkGold">
            <Sparkles size={14} />
            水瓶先生紫微牌卡
          </span>
          <h2 className="mt-4 font-serifTC text-3xl font-semibold text-deepPurple">
            前往紫微牌卡占卜
          </h2>
          <p className="mt-3 leading-7 text-textMuted">
            占卜會在獨立系統完成。LINE 登入、點數扣除、抽牌、解讀與紀錄都保留在原占卜網站，正式網站目前只作為入口。
          </p>

          <div className="mt-5 rounded-2xl border border-borderSoft bg-white p-4">
            <details className="group">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start gap-3 text-sm leading-7 text-textMuted">
                  <input
                    checked={hasAcceptedNotice}
                    className="mt-1 size-4 rounded border-borderSoft text-deepPurple focus:ring-deepPurple"
                    onChange={(event) => {
                      setHasAcceptedNotice(event.target.checked)
                      if (event.target.checked) setMessage('')
                    }}
                    onClick={(event) => event.stopPropagation()}
                    type="checkbox"
                  />
                  <span>
                    我已詳細閱讀並同意《AI 占卜服務說明》、《付款與退款規則》及《服務條款》，並了解此服務為付款後產生占卜結果之數位內容服務。
                    <span className="ml-1 font-semibold text-darkGold underline underline-offset-4 group-open:hidden">點我查看</span>
                    <span className="ml-1 hidden font-semibold text-darkGold underline underline-offset-4 group-open:inline">收合內容</span>
                  </span>
                </div>
              </summary>

              <div className="mt-4 max-h-72 space-y-5 overflow-y-auto rounded-lg bg-softPurple/60 p-4 text-sm leading-7 text-textMuted">
                <div>
                  <p className="font-semibold text-deepPurple">AI 占卜服務說明</p>
                  <ul className="mt-2 grid gap-1">
                    <li>服務名稱：紫微牌卡占卜單次</li>
                    <li>價格：NT$50 / 次</li>
                    <li>服務內容：針對單一問題提供牌卡指引與文字解析</li>
                    <li>交付方式：付款後於網站產生占卜結果</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-deepPurple">付款與退款規則</p>
                  <ul className="mt-2 grid gap-2">
                    <li>本服務為數位內容服務。</li>
                    <li>使用者完成付款後，系統會依照使用者提問與抽牌結果產生占卜解讀。</li>
                    <li>付款完成並產生占卜結果後，因服務已開始提供，原則上不接受取消或退款。</li>
                    <li>若因系統異常導致付款成功但沒有產生占卜結果，可聯繫水瓶先生官方 LINE 協助處理。</li>
                    <li>若使用者提問內容不清楚、問題方向不明確，或因個人理解不同導致結果不符合期待，恕不提供退款。</li>
                    <li>使用者送出付款前，應自行確認提問內容與服務項目。</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-deepPurple">服務條款</p>
                  <ul className="mt-2 grid gap-2">
                    <li>AI 占卜內容僅供命理與牌卡參考，不作為醫療、法律、投資、重大人生決策之唯一依據。</li>
                    <li>占卜結果不保證特定事件一定發生，也不保證感情、財務、工作或其他結果必然符合期待。</li>
                    <li>使用者應自行判斷與承擔實際行動結果。</li>
                    <li>占卜問題應以與使用者本人有實際關聯的人事物為主。</li>
                    <li>若有占卜資料、付款或系統問題，可聯繫水瓶先生官方 LINE。</li>
                  </ul>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className="grid gap-3 md:min-w-[210px]">
          <a
            className="focus-ring inline-flex min-h-14 items-center justify-center rounded-xl bg-deepPurple px-6 py-3 text-base font-semibold text-white transition hover:bg-purpleMain"
            href={readingUrl}
            onClick={(event) => {
              if (!validateNotice()) event.preventDefault()
            }}
            rel="noopener noreferrer"
            target="_blank"
          >
            前往占卜
          </a>

          <button
            type="button"
            className="focus-ring inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-[#d9b8ec] bg-white px-6 py-3 text-base font-semibold text-deepPurple transition hover:bg-softPurple"
            onClick={() => {
              if (!validateNotice()) return

              addItem({
                id: 'ai_divination_single',
                type: 'divination',
                itemName: '紫微牌卡占卜單次',
                amount: 50,
                quantity: 1
              })
              setMessage('已加入購物車')
            }}
          >
            <ShoppingCart size={20} />
            加入購物車
          </button>

          {message ? <p className="text-sm font-semibold text-deepPurple">{message}</p> : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3 text-sm leading-6 text-textMuted md:grid-cols-3">
        <div className="rounded-xl border border-borderSoft bg-white/75 p-4">
          <ShieldCheck className="mb-3 text-deepPurple" size={22} />
          不在正式網站存放占卜問題、解答、會員點數或 LINE Token。
        </div>
        <div className="rounded-xl border border-borderSoft bg-white/75 p-4">
          <MessageCircle className="mb-3 text-deepPurple" size={22} />
          客人遇到登入、扣點或占卜問題，仍回到占卜系統內處理。
        </div>
        <div className="rounded-xl border border-borderSoft bg-white/75 p-4">
          <Sparkles className="mb-3 text-deepPurple" size={22} />
          目前不搬功能、不合併資料、不碰扣點流程。
        </div>
      </div>
    </section>
  )
}
