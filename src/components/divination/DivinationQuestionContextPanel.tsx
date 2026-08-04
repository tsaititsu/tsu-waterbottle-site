import type {
  DivinationFollowUpDisplayReading,
  DivinationPosition,
  DivinationPreviousReadingSummary,
} from "@/lib/divination/types"
import { DIVINATION_READING_PRICE_LABEL } from "@/lib/divination/pricing"

type DivinationQuestionContextPanelProps = {
  isFollowUp: boolean
  followUpReading?: DivinationPreviousReadingSummary
  displayReading?: DivinationFollowUpDisplayReading
}

const positionLabels: Record<DivinationPosition, string> = {
  upright: "正位",
  reversed: "反位",
}

export function DivinationQuestionContextPanel({
  isFollowUp,
  followUpReading,
  displayReading,
}: DivinationQuestionContextPanelProps) {
  const hasFollowUpReading = isFollowUp && Boolean(followUpReading)
  const question = hasFollowUpReading
    ? `上一題｜「${followUpReading?.question || "正在讀取上一題問題"}」`
    : isFollowUp
      ? "上一題｜正在讀取追問情境"
      : "填寫一個清楚的問題，聚焦目前最想理解的情境。"
  const card = hasFollowUpReading
    ? `抽到｜${followUpReading?.cardName || "紫微牌卡"}${
        followUpReading?.position ? `｜${positionLabels[followUpReading.position]}` : ""
      }`
    : isFollowUp
      ? "抽到｜正在讀取上一題牌卡"
      : "抽牌方式｜手動抽牌或自動抽牌"

  return (
    <article
      className="grid grid-rows-[1.5rem_4rem_1.75rem_3.5rem_auto] gap-2 rounded-2xl border border-purple-100 bg-white p-5 shadow-soft"
      data-context-state={hasFollowUpReading ? "follow-up" : isFollowUp ? "loading" : "initial"}
      data-testid="divination-question-context-panel"
    >
      <p className="truncate text-sm font-semibold tracking-[0.18em] text-darkGold">
        {hasFollowUpReading ? "正在延續上一題追問" : isFollowUp ? "正在準備追問情境" : "第一步"}
      </p>
      <p className="line-clamp-2 overflow-hidden leading-7 text-textMuted" data-context-row="question">
        {question}
      </p>
      <p className="truncate leading-7 text-textMuted" data-context-row="card">
        {card}
      </p>
      <p className="line-clamp-2 overflow-hidden leading-7 text-textMuted">
        {isFollowUp
          ? `請輸入這次想追問的問題。下一步仍會重新抽牌，AI 解讀每次 ${DIVINATION_READING_PRICE_LABEL}。`
          : `選擇手動或自動抽牌。抽牌本身不收費，開始 AI 解讀時每次 ${DIVINATION_READING_PRICE_LABEL}。`}
      </p>
      <details className="rounded-xl border border-purple-100 bg-softPurple/60 px-4 py-3">
        <summary className="cursor-pointer truncate text-sm font-semibold text-deepPurple">
          {displayReading ? "查看上一題題目與解答" : "追問時可在這裡查看上一題完整解答"}
        </summary>
        {displayReading ? (
          <div className="mt-4 grid gap-4 leading-7 text-textMuted">
            <div>
              <p className="font-semibold text-deepPurple">上一題問題：</p>
              <p>「{displayReading.question}」</p>
            </div>
            <div>
              <p className="font-semibold text-deepPurple">抽到：</p>
              <p>
                {displayReading.cardName || "紫微牌卡"}
                {displayReading.position ? `｜${positionLabels[displayReading.position]}` : ""}
              </p>
            </div>
            <div>
              <p className="font-semibold text-deepPurple">上一題解答：</p>
              <div className="mt-2 max-h-80 overflow-y-auto whitespace-pre-line rounded-xl bg-white p-4 text-sm leading-7 text-textDark">
                {displayReading.finalAnswer}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-7 text-textMuted">
            完成一次占卜後，可從解答頁延續追問，並在這裡回看上一題內容。
          </p>
        )}
      </details>
    </article>
  )
}
