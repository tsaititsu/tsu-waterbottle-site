# AI 命盤 D1 推理素材 v1

## 目前狀態

本目錄只完成版本化素材納管，尚未接入網站 Runtime。

- Runtime loader：未建立
- OpenAI adapter：未建立
- Structured Output runtime schema：未建立
- Background job：未建立
- Production：未啟用

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

後續完成 loader、validator、Structured Outputs、
Prompt 組裝測試與金標回歸後，才能另外啟用。
