# AI 命盤 D1 推理素材 v1

## 目前狀態

本目錄已完成版本化素材納管與 Server 端完整性驗證，尚未接入網站 Runtime。

- Manifest validator：已建立
- 素材完整性驗證：已建立
- Manifest SHA 版本鎖定：已建立
- Runtime loader：只有 disabled guard，尚未啟用
- OpenAI Responses adapter core：已建立
- 模型 contract：鎖定 `gpt-5.6-sol`
- Structured Output transport：已建立
- `store: false`：強制
- Timeout：已建立
- 固定安全錯誤碼：已建立
- Runtime 接線：未建立
- D1 正式 Schema：未建立
- Prompt 組裝：未建立
- Background job：未建立
- Production：未啟用

Manifest 與 16 份素材會在 Server 端驗證原始位元組 SHA-256。
`draft` 與 `reference_only` 素材不能被 Runtime 啟用，目前所有
`runtimeEnabled` 仍為 `false`。

本階段不會讀取或回傳 Prompt 全文給任何 Route。

Responses adapter 尚未被 Route、Report、付款或 Supabase 流程引用。
測試只使用 mock fetch，沒有測試會呼叫 OpenAI；目前也不會讀取或
傳送本目錄的 D1 素材。所有 `runtimeEnabled` 仍為 `false`。

Adapter 使用原生 REST fetch 解析原始 `output` array，不依賴 SDK-only
的頂層 `output_text`。後續必須先建立 D1 階段 Schema 與 Prompt 組裝，
才能進行受控 Preview 測試。

## 功能邊界

第一版只做 D1 本命人格推理。

不包含：

- D2 大限
- 流年
- 具體年份事件
- 紫微牌卡占卜

## 模型決策

未來 AI 命盤模型：

- `gpt-5.6-sol`
- 環境變數：`OPENAI_AI_CHART_MODEL`

此設定與紫微牌卡的 `OPENAI_DIVINATION_MODEL` 完全分離。

來源文件原有的 GPT-5.5 文字保留原文，不代表 Runtime 模型設定。

## 規格優先級

1. `spec/primary/20_D1_本命人格推理總控流程.md`
2. `spec/primary/21_D1_OpenAI多次呼叫編排規格.md`
3. `prompt/0_主控.md`
4. `prompt/1_五步任務卡.md`
5. `quality/2_風格與品管.md`

`22_D1_各呼叫輸入輸出Schema_工作版.md` 仍是工作版，
不得直接視為正式 Runtime Schema。

`23_Codex_D1多呼叫實作任務包.md` 只供工程實作參考。

`3_網站API管線設計.md` 保留背景 job、前端進度、
品管與產品交付設計，不作為唯一編排規格。

## 明確排除

本版本未納入：

- A2 v1.0／v1.1 待老師確認資料
- 歷史 SOP
- 舊正式基準版
- 其他工作版或待確認知識
- 真實會員、出生或付款資料

## Runtime 啟用

本 PR 中所有素材均為：

`runtimeEnabled: false`

後續完成 Structured Outputs、Prompt 組裝測試與金標回歸後，
才能另外啟用。

## 素材更新流程

未來若要更新任一素材，必須：

1. 另開人工審查 PR。
2. 更新素材。
3. 更新 manifest 內對應的素材 SHA-256。
4. 更新程式鎖定的 manifest SHA-256。
5. 重跑完整性驗證與金標回歸。

Vercel Serverless 是否包含素材檔案，需在未來 Runtime 接入 PR
透過 Preview 實際驗證；本 PR 不宣稱已完成部署打包接入。
