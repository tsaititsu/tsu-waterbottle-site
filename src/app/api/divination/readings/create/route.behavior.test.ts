import assert from "node:assert/strict"
import { test } from "node:test"
import { decideDivinationQuestionSubmission } from "./handler"

const now = new Date("2026-08-09T00:00:00.000Z")

test("不適用題型在建立占卜紀錄前回傳付款前提醒", () => {
  const decision = decideDivinationQuestionSubmission({
    question: "我什麼時候可以找到工作？",
    now,
  })

  assert.equal(decision.action, "show_advisory")
  assert.deepEqual(decision.advisory.reasons, ["precise_time"])
})

test("使用者確認仍要繼續後才建立占卜紀錄，並保留知情原因", () => {
  const decision = decideDivinationQuestionSubmission({
    question: "我什麼時候可以找到工作？",
    proceedDespiteQuestionAdvisory: true,
    now,
  })

  assert.equal(decision.action, "proceed")
  assert.deepEqual(decision.acknowledgedReasons, ["precise_time"])
})

test("目前分頁的三個月內相同問題會提醒，有新變化時直接建立", () => {
  const followUpContext = {
    isFollowUp: true,
    threadId: "synthetic-thread",
    parentReadingId: "synthetic-reading",
    previousReadings: [
      {
        readingId: "synthetic-reading",
        question: "他對我有沒有心？",
        answerSummary: "synthetic-answer",
        createdAt: "2026-07-01T08:00:00.000Z",
      },
    ],
  }

  const repeatedDecision = decideDivinationQuestionSubmission({
    question: "他喜歡我嗎？",
    followUpContext,
    now,
  })
  const changedDecision = decideDivinationQuestionSubmission({
    question: "他昨天主動聯絡我，現在對我有沒有心？",
    followUpContext,
    now,
  })

  assert.equal(repeatedDecision.action, "show_advisory")
  assert.deepEqual(repeatedDecision.advisory.reasons, ["repeat_question"])
  assert.equal(changedDecision.action, "proceed")
  assert.deepEqual(changedDecision.acknowledgedReasons, [])
})
