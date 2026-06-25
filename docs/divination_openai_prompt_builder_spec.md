# 紫微牌卡占卜 OpenAI Prompt Builder 規格

## 1. 背景

正式網站目前已完成紫微牌卡占卜的 mock 與付款 gate 規格基礎：

```text
POST /api/divination/readings/create mock route
POST /api/divination/interpret mock route
mock payment gate
structured interpretation response
divination_readings SQL 草稿
NewebPay start route 規格
NewebPay notify ai_divination 分支規格
正式 interpret API payment gate 規格
```

目前尚未完成：

```text
production 執行 divination_readings SQL
正式 NewebPay 占卜付款
notify 實際支援 ai_divination
interpret API 正式查 payments + divination_readings
正式 OpenAI prompt builder
正式 OpenAI API 呼叫
```

本文件只定義未來正式 OpenAI prompt builder 與 structured output 的設計方向，不代表目前已實作。

## 2. Prompt Builder 目標

未來建議新增 helper：

```text
src/lib/divination/buildDivinationPrompt.ts
```

用途：

```text
根據 server 端查出的 reading、card、position、牌義資料，組出穩定、可控、可測試的 OpenAI prompt。
```

正式 prompt builder 不應依賴前端送來的牌義。

正式資料來源應該只來自 server 端：

```text
divination_readings.question
divination_readings.draw_mode
divination_readings.card_id
divination_readings.position
src/lib/divination/cards.ts
```

這樣可以避免前端偽造牌義、偽造正反位或繞過正式 payment gate。

## 3. Prompt Builder 輸入資料

未來 prompt builder 的 input type 草稿：

```ts
type BuildDivinationPromptInput = {
  question: string
  drawMode: "manual" | "auto"
  card: {
    id: string
    name: string
    huaqi: string
    element: string
    core: string
    uprightMeaning: string
    reversedMeaning: string
    advice: {
      upright: string
      reversed: string
    }
  }
  position: "upright" | "reversed"
}
```

欄位說明：

- `question`：使用者本次問題。
- `drawMode`：手動抽牌 / 自動抽牌。
- `card`：server 端從 `cards.ts` 查出的牌卡資料。
- `position`：正位 / 反位。
- 牌義與建議必須由 server 端決定，不可使用前端傳來的牌義文字。

## 4. Prompt Builder 輸出格式

建議輸出：

```ts
type BuildDivinationPromptResult = {
  instructions: string
  input: string
}
```

建議採用 `instructions + input`，而不是 `systemPrompt + userPrompt`，原因：

- `instructions` 更清楚代表固定規則、語氣、限制、安全邊界。
- `input` 更清楚代表本次問題、牌卡資料、正反位、牌義資料。
- 未來如果 OpenAI SDK 寫法或訊息格式調整，仍可把 `instructions` 映射到 system/developer 類型，把 `input` 映射到 user 類型。

設計方向：

```text
instructions：固定規則、語氣、限制、安全邊界
input：本次問題、牌卡資料、正反位、牌義資料
```

## 5. 解讀語氣與定位

紫微牌卡 AI 解讀語氣應該是：

```text
溫和
清楚
具體
不恐嚇
不絕對化
不神棍化
不做醫療 / 法律 / 投資保證
不保證結果一定發生
```

可使用：

```text
「這張牌提醒你……」
「比較像是在說……」
「可以留意……」
「建議你先……」
```

避免：

```text
「一定會」
「必定失敗」
「你絕對不能」
「保證復合」
「保證賺錢」
「會死亡」
```

定位上，AI 是紫微牌卡解讀助理，不是醫師、律師、投資顧問，也不是能百分百知道他人想法或未來結果的角色。

## 6. 解讀內容結構

正式 AI 回傳結構應維持目前前端已支援的 structured interpretation：

```ts
{
  summary: string
  cardMessage: string
  situationAnalysis: string
  advice: string
  reminder: string
}
```

欄位用途：

- `summary`：一句話總結本次解讀。
- `cardMessage`：牌卡本身帶出的核心訊息。
- `situationAnalysis`：根據使用者問題與牌義做情境分析。
- `advice`：具體可執行建議。
- `reminder`：提醒與界線，不做絕對預言。

## 7. Structured Output Schema 草稿

未來 OpenAI structured output JSON schema 草稿：

```ts
const divinationInterpretationSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "cardMessage",
    "situationAnalysis",
    "advice",
    "reminder"
  ],
  properties: {
    summary: {
      type: "string",
      description: "一句話總結本次牌卡解讀。"
    },
    cardMessage: {
      type: "string",
      description: "牌卡本身帶出的核心訊息。"
    },
    situationAnalysis: {
      type: "string",
      description: "根據使用者問題、牌卡與正反位做出的情境分析。"
    },
    advice: {
      type: "string",
      description: "給使用者的具體行動建議。"
    },
    reminder: {
      type: "string",
      description: "提醒、界線與非絕對化說明。"
    }
  }
}
```

正式實作時可使用 Responses API 的 structured output / JSON schema 機制，避免前端收到不可預期格式。

## 8. System Prompt 草稿

system / instructions prompt 草稿：

```text
你是水瓶先生紫微牌卡占卜的 AI 解讀助理。
你要根據使用者問題、抽到的紫微牌卡、正反位、牌義資料，產生溫和、清楚、具體的占卜解讀。

規則：
- 不可恐嚇使用者。
- 不可做絕對預言。
- 不可保證感情、金錢、疾病、法律結果。
- 不可提供醫療診斷、法律結論、投資保證。
- 不可宣稱百分百知道他人想法。
- 遇到高風險議題時，應提醒使用者尋求專業協助。
- 回答要具體，但保留彈性與現實界線。
- 輸出必須符合指定 JSON schema。

語氣：
- 溫和、清楚、穩定。
- 可以使用「這張牌提醒你……」、「比較像是在說……」、「可以留意……」、「建議你先……」。
- 避免「一定會」、「必定失敗」、「你絕對不能」、「保證復合」、「保證賺錢」、「會死亡」。
```

## 9. User Prompt 草稿

user / input prompt 草稿：

```text
使用者問題：
{question}

抽牌方式：
{drawModeLabel}

抽到牌卡：
{card.name}

正反位：
{positionLabel}

牌卡資料：
- 化氣：{card.huaqi}
- 五行：{card.element}
- 核心：{card.core}

本次使用的牌義：
{meaning}

本次使用的建議：
{advice}

請依照指定 JSON schema 產生解讀。
```

其中 `meaning` 與 `advice` 必須依正反位由 server 端選出。

## 10. 正位 / 反位處理規則

若 `position = upright`：

```text
使用 uprightMeaning
使用 advice.upright
```

若 `position = reversed`：

```text
使用 reversedMeaning
使用 advice.reversed
```

不要把正位與反位混在一起解讀。

反位處理原則：

```text
反位不是壞牌，而是提醒此能量需要調整。
```

反位回答可以指出阻滯、失衡、延遲或需要修正的地方，但不可恐嚇使用者，也不可直接斷定必然失敗。

## 11. 問題類型處理規則

### 感情問題

可以分析：

```text
互動狀態
溝通模式
自我調整
下一步建議
```

不可保證：

```text
一定復合
對方一定愛你
對方一定出軌
```

### 工作問題

可以分析：

```text
目前阻力
適合策略
合作與溝通
行動方向
```

不可保證：

```text
一定升遷
一定錄取
一定離職
```

### 金錢問題

可以分析：

```text
風險意識
資源配置
保守 / 積極傾向
行動提醒
```

不可提供：

```text
投資標的建議
保證獲利
明確買賣指令
```

### 健康問題

可以給：

```text
壓力提醒
作息提醒
尋求專業醫療建議
```

不可給：

```text
診斷
治療方案
用藥建議
病情保證
```

## 12. 安全與合規提醒

prompt builder 必須避免的內容：

```text
醫療診斷
法律結論
投資保證
恐嚇式預言
死亡預言
詛咒
鼓勵自傷
鼓勵犯罪
侵犯他人隱私
宣稱能百分百知道他人想法
```

遇到高風險問題時：

```text
溫和回應
降低占卜的決定性
提醒尋求專業協助
提供安全、現實的下一步
```

若使用者問題涉及自傷、暴力、重大危機，解讀應優先提供安全提醒與求助方向，不應只照牌義回答。

## 13. OpenAI 呼叫位置

OpenAI 呼叫只應出現在正式版：

```text
POST /api/divination/interpret
```

而且必須在以下流程之後：

```text
驗證 reading
驗證 payment
確認 reading.status = paid
server 端查 cards.ts
建立 prompt
```

不可在這些地方呼叫 OpenAI：

```text
前端 component
NewebPay notify route
NewebPay return route
readings/create route
mock payment gate
```

OpenAI API key、prompt builder 與模型設定都必須只存在 server-side。

## 14. 模型與成本策略

第一版可使用成本較低、速度穩定、支援 structured output 的模型。

模型名稱應集中在 server route 或 config，不要散落在多個檔案。

規格：

```text
正式模型選擇與價格需在上線前再次確認。
OpenAI 必須在付款 gate 後才呼叫。
```

成本控制原則：

- `reading.status = completed` 時直接回傳既有 interpretation，不重複呼叫 OpenAI。
- `reading.status = interpreting` 時避免重複請求同時觸發。
- OpenAI timeout / rate limit 時應記錄錯誤，交由客服補救，不應讓使用者一直重刷產生成本。

## 15. 錯誤處理策略

需處理：

```text
OpenAI timeout
OpenAI rate limit
OpenAI 回傳格式不符合 schema
JSON parse 失敗
內容過短
內容空白
安全拒答
```

建議處理：

```text
reading.status = failed
error_message 記錄簡短錯誤
不把 stack trace 回傳給前端
前端顯示友善錯誤
已付款但失敗者需有客服補救策略
```

若 OpenAI 回傳不符合 schema，第一版不建議自動無限重試，避免成本失控。可先標記失敗，後台人工處理。

## 16. Prompt Builder Pseudo Code

以下是 pseudo code，不是完整正式程式：

```ts
export function buildDivinationPrompt(
  input: BuildDivinationPromptInput
): BuildDivinationPromptResult {
  const positionLabel = input.position === "upright" ? "正位" : "反位"
  const drawModeLabel = input.drawMode === "manual" ? "手動抽牌" : "自動抽牌"

  const meaning =
    input.position === "upright"
      ? input.card.uprightMeaning
      : input.card.reversedMeaning

  const advice =
    input.position === "upright"
      ? input.card.advice.upright
      : input.card.advice.reversed

  return {
    instructions: `
      你是水瓶先生紫微牌卡占卜的 AI 解讀助理。
      請依據牌卡資料產生溫和、清楚、具體且不絕對化的解讀。
      不可恐嚇，不可保證結果，不可提供醫療、法律、投資的決定性指令。
      輸出必須符合指定 JSON schema。
    `,
    input: `
      使用者問題：
      ${input.question}

      抽牌方式：
      ${drawModeLabel}

      抽到牌卡：
      ${input.card.name}

      正反位：
      ${positionLabel}

      牌卡資料：
      - 化氣：${input.card.huaqi}
      - 五行：${input.card.element}
      - 核心：${input.card.core}

      本次使用的牌義：
      ${meaning}

      本次使用的建議：
      ${advice}
    `
  }
}
```

## 17. OpenAI Responses API Pseudo Code

以下是 pseudo code，不是可直接執行程式：

```ts
const response = await client.responses.create({
  model: MODEL_NAME,
  input: [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: userPrompt
    }
  ],
  text: {
    format: {
      type: "json_schema",
      name: "divination_interpretation",
      strict: true,
      schema: divinationInterpretationSchema
    }
  }
})
```

實際 SDK 寫法需以正式使用的 OpenAI SDK 版本為準。正式實作前應再次確認 SDK 版本、Responses API structured output 寫法與模型支援狀態。

## 18. 測試案例設計

至少應包含以下測試案例：

```text
感情問題 + 正位
感情問題 + 反位
工作問題 + 正位
金錢問題 + 反位
健康 / 高風險問題
```

每個測試應確認：

```text
輸出 JSON schema 正確
沒有恐嚇
沒有保證
建議具體
reminder 有界線
```

建議額外檢查：

- 反位回答是否真的有反位語義，而不是和正位過度相似。
- 金錢問題是否避免明確買賣指令。
- 健康問題是否避免診斷與治療方案。
- 感情問題是否避免保證對方心意。
- 高風險問題是否優先提供安全提醒。

## 19. 與目前 mock interpretation 的差異

### 目前 mock interpretation

```text
server 端用 cards.ts 牌義組合固定文字
不呼叫 OpenAI
不會產生成本
不需 prompt builder
```

### 正式 OpenAI interpretation

```text
通過 payment gate
server 端 build prompt
呼叫 OpenAI
要求 structured output
儲存 interpretation
防止重複產生成本
```

正式 OpenAI interpretation 必須在 `payments + divination_readings` gate 通過後才可執行。

## 20. 目前不可實作原因

目前不可實作原因：

```text
divination_readings SQL 尚未在 production 執行
NewebPay divination start route 尚未實作
notify route 尚未支援 ai_divination
interpret API 尚未正式查 payment gate
金流 / LINE Pay 審核期間不應啟用新付款商品
OpenAI 成本必須等 payment gate 完成後才啟用
```

此外，正式 prompt 與模型成本需要在上線前再次測試與確認。

## 21. 下一步建議

下一步先整理目前所有占卜搬遷規格與實作進度總表，不實作。
