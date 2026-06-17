'use client'

import { MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'

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
        </div>

        <a
          className="focus-ring inline-flex min-h-14 items-center justify-center rounded-xl bg-deepPurple px-6 py-3 text-base font-semibold text-white transition hover:bg-purpleMain"
          href={readingUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          前往占卜
        </a>
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
