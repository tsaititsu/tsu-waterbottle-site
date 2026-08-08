import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

const projectRoot = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8")
}

test("付款前提醒框清楚說明尚未收費，並提供修改或繼續兩個操作", () => {
  const source = readSource(
    "src/components/divination/DivinationQuestionAdvisoryDialog.tsx",
  )

  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
  assert.match(source, /目前尚未抽牌，也不會收取費用/)
  assert.match(source, />\s*修改問題\s*</)
  assert.match(source, />\s*仍要繼續抽牌\s*</)
  assert.match(source, /disabled=\{disabled\}/)
})

test("提問流程收到提醒時不前往抽牌頁，確認繼續後才重送原問題", () => {
  const source = readSource(
    "src/components/divination/DivinationLocalPreview.tsx",
  )

  assert.match(source, /"questionAdvisory" in data/)
  assert.match(source, /setPendingQuestionSubmission\(payload\)/)
  assert.match(source, /setQuestionAdvisory\(session\.questionAdvisory\)/)
  assert.match(source, /proceedDespiteQuestionAdvisory: input\.proceedDespiteQuestionAdvisory/)
  assert.match(
    source,
    /handleQuestionSubmit\(pendingQuestionSubmission, \{\s*proceedDespiteQuestionAdvisory: true,\s*\}\)/,
  )
  assert.match(source, /<DivinationQuestionAdvisoryDialog/)
})

test("提醒框顯示時不殘留已要前往抽牌頁的誤導訊息", () => {
  const source = readSource(
    "src/components/divination/DivinationQuestionForm.tsx",
  )

  assert.doesNotMatch(source, /正在建立占卜紀錄並前往自動抽牌頁/)
  assert.doesNotMatch(source, /已收到問題，正在確認是否可以進入抽牌流程/)
})
