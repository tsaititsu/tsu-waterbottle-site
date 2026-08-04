import assert from 'node:assert/strict'
import {
  classifyZiweiCardQuestion,
  getZiweiCardOpenAiRequestConfig,
} from './ziweiCardReadingEngine'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

test('商品品項問題使用 ziwei-card 經營分類', () => {
  const result = classifyZiweiCardQuestion('水晶市集要準備四種商品還是先精簡品項？')

  assert.equal(result.questionType, '經營銷售')
  assert.equal(result.questionSubcategory, '經營｜商品品項決策')
})

test('網站扣點問題不會落到一般問題', () => {
  const result = classifyZiweiCardQuestion('占卜網站的扣點提示會不會讓客人反感？')

  assert.equal(result.questionType, '網站系統')
  assert.equal(result.questionSubcategory, '經營｜扣點提示')
})

test('法律勝負與朋友轉戀人使用精準細分類', () => {
  assert.equal(
    classifyZiweiCardQuestion('這場訴訟最後我會贏嗎？').questionSubcategory,
    '合約｜法律勝負',
  )
  assert.equal(
    classifyZiweiCardQuestion('朋友有機會變戀人嗎？').questionSubcategory,
    '感情｜朋友轉戀人',
  )
})

test('OpenAI 請求固定使用 Terra max reasoning', () => {
  assert.deepEqual(getZiweiCardOpenAiRequestConfig(), {
    model: 'gpt-5.6-terra',
    reasoning: { effort: 'max' },
  })
})
