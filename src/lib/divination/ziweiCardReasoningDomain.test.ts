import assert from "node:assert/strict"
import { test } from "node:test"
import {
  ZIWEI_CARD_REASONING_SYSTEM_RULES,
  getZiweiLoveMindConclusion,
  ziweiLoveMindConclusions,
} from "./ziweiCardReasoningDomain"

const fourteenMajorStars = [
  "紫微星",
  "天機星",
  "太陽星",
  "武曲星",
  "天同星",
  "廉貞星",
  "天府星",
  "太陰星",
  "貪狼星",
  "巨門星",
  "天相星",
  "天梁星",
  "七殺星",
  "破軍星",
] as const

test("14 主星都有心意題正反位結論，反位直接回答沒有心", () => {
  assert.deepEqual(Object.keys(ziweiLoveMindConclusions), fourteenMajorStars)

  for (const star of fourteenMajorStars) {
    assert.ok(ziweiLoveMindConclusions[star].upright.length > 20)
    assert.match(ziweiLoveMindConclusions[star].reversed, /^沒有心。/)
    assert.doesNotMatch(ziweiLoveMindConclusions[star].reversed, /不是完全沒心|其實有心|仍然有心/)
  }
})

test("已確認的五顆五行屬水星曜心意規則不被泛用模板軟化", () => {
  assert.match(getZiweiLoveMindConclusion("天同星", "正位"), /^有心。.*舒服.*陪伴.*承擔/)
  assert.match(getZiweiLoveMindConclusion("天同星", "反位"), /^沒有心。.*相處.*不.*輕鬆/)

  assert.match(getZiweiLoveMindConclusion("天相星", "正位"), /^目前看不出明確有心。.*禮貌.*照顧/)
  assert.match(getZiweiLoveMindConclusion("天相星", "反位"), /^沒有心。.*處理清楚.*公平/)

  assert.match(getZiweiLoveMindConclusion("太陰星", "正位"), /^有心。.*藏得比較深.*默默.*比較慢/)
  assert.match(getZiweiLoveMindConclusion("太陰星", "反位"), /^沒有心。.*不夠真實或穩定.*安全感/)

  assert.match(getZiweiLoveMindConclusion("巨門星", "正位"), /^偏向有心。.*沒有.*表現.*主動開口/)
  assert.match(getZiweiLoveMindConclusion("巨門星", "反位"), /^沒有心。.*誤解.*資訊不對等.*可信/)

  assert.match(getZiweiLoveMindConclusion("破軍星", "正位"), /^偏向有心。.*改變關係.*新的階段/)
  assert.match(getZiweiLoveMindConclusion("破軍星", "反位"), /^沒有心。.*方向.*不一致.*重新建立/)
})

test("推演核心包含直接回答、三層原因、宮位內部化與特殊星曜邊界", () => {
  assert.match(ZIWEI_CARD_REASONING_SYSTEM_RULES, /先直接回答使用者明確問的結果/)
  assert.match(ZIWEI_CARD_REASONING_SYSTEM_RULES, /對方、提問者、事情本身/)
  assert.match(ZIWEI_CARD_REASONING_SYSTEM_RULES, /三種可能.*同時成立/)
  assert.match(ZIWEI_CARD_REASONING_SYSTEM_RULES, /宮位.*內部.*不可.*顯示給使用者/)
  assert.match(ZIWEI_CARD_REASONING_SYSTEM_RULES, /五行屬水的星曜/)
  assert.match(ZIWEI_CARD_REASONING_SYSTEM_RULES, /武曲、天府、太陰/)
  assert.match(ZIWEI_CARD_REASONING_SYSTEM_RULES, /廉貞.*外靈.*整體運勢不順.*反位/)
  assert.match(ZIWEI_CARD_REASONING_SYSTEM_RULES, /只有天梁正位.*祈求神明/)
  assert.match(ZIWEI_CARD_REASONING_SYSTEM_RULES, /七殺.*不是主管/)
  for (const star of fourteenMajorStars) {
    assert.match(ZIWEI_CARD_REASONING_SYSTEM_RULES, new RegExp(`${star}正位`))
    assert.match(ZIWEI_CARD_REASONING_SYSTEM_RULES, new RegExp(`${star}反位：沒有心。`))
  }
})
