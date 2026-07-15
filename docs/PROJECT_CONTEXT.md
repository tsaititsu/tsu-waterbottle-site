# 專案背景：tsu-waterbottle-site

## 1. 專案用途

本網站是水瓶先生的紫微斗數服務平台，可能包含：

- 紫微斗數內容與服務介紹
- 會員登入
- 命盤或分析資料
- 點數與儲值
- 訂單與付款
- 管理功能
- Vercel 部署
- Supabase 資料庫與登入

修改任何涉及會員、點數、付款、命盤資料與管理員功能的程式，都要視為高風險。

## 2. 技術架構

開始任務前，Codex 必須從實際專案確認，不可只依本文件猜測：

- Next.js 版本：從 package.json 確認
- React 版本：從 package.json 確認
- TypeScript：從 tsconfig.json 確認
- 套件管理器：依 lockfile 確認
- Supabase：依依賴與設定檔確認
- 部署平台：Vercel
- Git 遠端：從 git remote 確認

若實際專案與本文件不同，以程式碼與使用者明確指示為準；若需更新本文件，必須由使用者在目前任務中明確授權，Codex 先覆述修改內容與位置並取得確認後才能執行。

## 3. 環境

Production：

- Git 分支：main
- Vercel：Production
- Supabase：Production
- 正式金鑰只存在 Production 後台
- Codex 不得直接修改

Preview：

- Git 分支：codex/*
- Vercel：Preview
- Supabase：Preview Branch 或獨立測試專案
- 不可使用正式 service_role、正式付款或正式資料

Local：

- 僅使用本機或測試環境變數
- 不得放置正式秘密金鑰
- `.env*` 不得提交 Git

## 4. 專案目錄

Codex 開始前應自行查看目前專案結構，並在此補充實際用途：

```text
app/ 或 src/app/       Next.js 頁面與路由
components/            共用元件
lib/                   共用函式與服務
supabase/              Migration、SQL 或 Supabase 設定
public/                靜態資源
docs/                  專案規範與說明
```

不得假設不存在的資料夾。

## 5. 常用指令

Codex 必須先從 package.json 確認實際指令。

可能包含：

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

不存在的指令不可執行，也不可宣稱已通過。

## 6. 高風險區域

- 登入與權限
- 管理員功能
- 會員個資
- 出生資料與命盤資料
- 點數
- 儲值
- 訂單
- 金流
- Webhook
- Supabase RLS
- Migration
- Vercel 環境變數

修改高風險區域前，必須閱讀 `SECURITY_RULES.md`。
