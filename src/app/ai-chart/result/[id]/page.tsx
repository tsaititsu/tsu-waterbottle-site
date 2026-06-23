'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Download } from 'lucide-react'
import { getMockRecordById } from '@/lib/mockPayment'
import { createZiweiGptPayload, type ZiweiGptPayload } from '@/features/ziwei-chart/package'
import { OriginalZiweiChartView } from '@/features/ziwei-chart/components/OriginalZiweiChartView'

const analysisParagraphs = [
  '你的命盤個性分析會以命宮、主要星曜與整體格局為核心，整理出你的思考模式、行動節奏與人際互動傾向。',
  '這份示意報告先保留完整結果頁結構；後續串接正式命盤引擎後，會依照實際出生資料產生對應的命盤與個性解析。',
  '已付款的分析紀錄會保存在會員中心，之後可直接回來查看，不需要重複付款。'
]

export default function AiChartResultPage() {
  const params = useParams<{ id: string }>()
  const record = getMockRecordById(params.id)
  let payload: ZiweiGptPayload | null = null
  let chartError = ''

  if (record?.chartInput) {
    try {
      payload = createZiweiGptPayload(record.chartInput)
    } catch (error) {
      chartError = error instanceof Error ? error.message : '命盤產生失敗'
    }
  }

  const downloadReport = () => {
    const content = [
      record?.title ?? '紫微命盤完整分析｜完整解析命盤個性分析',
      record?.chartInput ? `陽曆：${record.chartInput.solarDate}` : '',
      payload ? `農曆：${payload.chart.birthInfo.lunarDate}` : '',
      payload ? `五行局：${payload.chart.fiveElementsClass}` : '',
      '',
      '個性分析',
      ...analysisParagraphs.map((text) => `- ${text}`)
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${record?.title ?? 'ziwei-chart-report'}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="bg-white py-12 md:py-16">
      <div className="section-shell grid max-w-5xl gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-darkGold">紫微命盤分析結果</p>
            <h1 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple md:text-4xl">
              {record?.title ?? '紫微命盤完整分析｜完整解析命盤個性分析'}
            </h1>
            <p className="mt-3 text-textMuted">
              {record?.createdAt ? new Date(record.createdAt).toLocaleString('zh-TW') : '已完成分析'}
            </p>
          </div>
          <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-gold bg-white px-5 py-3 font-semibold text-darkGold" onClick={downloadReport} type="button">
            <Download size={18} />
            下載命盤報告
          </button>
        </div>

        <article className="rounded-[28px] border border-borderSoft bg-softPurple p-5 shadow-soft md:p-8">
          <h2 className="mb-5 font-serifTC text-2xl font-semibold text-deepPurple">完整命盤</h2>
          {payload ? (
            <div className="rounded-[24px] border border-white/70 bg-white/70 p-2">
              <OriginalZiweiChartView chart={payload.chart} />
            </div>
          ) : (
            <div className="rounded-2xl border border-borderSoft bg-white p-6 text-textMuted">
              {chartError ? `命盤產生失敗：${chartError}` : '這筆舊紀錄沒有出生資料，請重新新增命盤後再分析。'}
            </div>
          )}
        </article>

        <article className="rounded-[28px] border border-borderSoft bg-white p-6 shadow-soft md:p-8">
          <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">個性分析</h2>
          <div className="mt-5 grid gap-4 text-lg leading-8 text-textMuted">
            {analysisParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link className="focus-ring rounded-lg bg-deepPurple px-5 py-3 text-center font-semibold text-white" href="/account">
            回會員中心查看紀錄
          </Link>
          <Link className="focus-ring rounded-lg border border-borderSoft px-5 py-3 text-center font-semibold text-deepPurple" href="/ai-chart">
            新增另一張命盤
          </Link>
        </div>
      </div>
    </section>
  )
}
