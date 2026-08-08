import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

const projectRoot = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8")
}

test("正式生成與審稿 instructions 共用同一份底層推演核心", () => {
  const instructions = readSource(
    "src/lib/divination/ziweiCardReadingInstructions.ts",
  )

  assert.match(instructions, /import \{ ZIWEI_CARD_REASONING_SYSTEM_RULES \}/)
  assert.equal(
    instructions.match(/\$\{ZIWEI_CARD_REASONING_SYSTEM_RULES\}/g)?.length,
    2,
  )
})

test("正式心意題第一段由 14 主星契約決定，不再被舊的模糊句覆蓋", () => {
  const engine = readSource(
    "src/lib/divination/ziweiCardReadingEngine.ts",
  )

  assert.match(engine, /import \{ getZiweiLoveMindConclusion \}/)
  assert.match(
    engine,
    /function buildLoveMindConclusion[\s\S]*?getZiweiLoveMindConclusion\(cardName, position\)/,
  )
  assert.match(engine, /const PROMPT_VERSION = "prompt-domain-reasoning-v20260809"/)
})
