import assert from "node:assert/strict"
import { test } from "node:test"
import {
  evaluateDivinationQuestion,
  type DivinationRecentQuestion,
} from "./questionAdvisory"

const now = new Date("2026-08-09T00:00:00.000Z")

function evaluate(
  question: string,
  recentQuestions: DivinationRecentQuestion[] = [],
) {
  return evaluateDivinationQuestion({ question, recentQuestions, now })
}

test("精確時間題在抽牌前提醒，但已提供單一日期範圍時可以直接詢問", () => {
  const unsupported = evaluate("我什麼時候可以找到工作？")
  const supported = evaluate("我在八月底前能找到工作嗎？")

  assert.equal(unsupported.needsConfirmation, true)
  assert.deepEqual(unsupported.reasons, ["precise_time"])
  assert.match(unsupported.message, /無法直接判斷精確時間/)
  assert.match(unsupported.message, /尚未抽牌，也不會收取費用/)

  assert.equal(supported.needsConfirmation, false)
  assert.deepEqual(supported.reasons, [])
})

test("多選項排序題提醒分開抽牌，同一對象的多個相關問題不誤擋", () => {
  const comparison = evaluate("A 工作和 B 工作哪個比較好？")
  const relatedQuestions = evaluate("他現在對我有沒有心，也會不會主動聯絡我？")

  assert.equal(comparison.needsConfirmation, true)
  assert.deepEqual(comparison.reasons, ["multiple_options"])
  assert.match(comparison.message, /無法用一張牌替多個選項排序/)
  assert.match(comparison.message, /分別抽牌/)

  assert.equal(relatedQuestions.needsConfirmation, false)
})

test("三個月內同一核心問題即使換句話說仍提醒", () => {
  const result = evaluate("他喜歡我嗎？", [
    {
      question: "他對我有沒有心？",
      createdAt: "2026-07-01T08:00:00.000Z",
    },
  ])

  assert.equal(result.needsConfirmation, true)
  assert.deepEqual(result.reasons, ["repeat_question"])
  assert.match(result.message, /三個月內不建議重複詢問相同問題/)
})

test("超過三個月或問題明確提到新的關鍵變化時不跳重複提醒", () => {
  const olderQuestion = evaluate("他喜歡我嗎？", [
    {
      question: "他對我有沒有心？",
      createdAt: "2026-05-08T23:59:59.000Z",
    },
  ])
  const changedSituation = evaluate("他昨天主動聯絡我，現在對我有沒有心？", [
    {
      question: "他對我有沒有心？",
      createdAt: "2026-07-01T08:00:00.000Z",
    },
  ])

  assert.equal(olderQuestion.needsConfirmation, false)
  assert.equal(changedSituation.needsConfirmation, false)
})

test("多候選日期同時保留時間與多選項兩項提醒", () => {
  const result = evaluate("八月還是九月比較容易找到工作？")

  assert.equal(result.needsConfirmation, true)
  assert.deepEqual(result.reasons, ["precise_time", "multiple_options"])
  assert.match(result.message, /每個日期或選項拆成獨立問題/)
})
