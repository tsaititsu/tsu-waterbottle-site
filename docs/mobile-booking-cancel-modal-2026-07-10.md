# 手機版取消預約 Modal（2026-07-10）

## 修改目的

會員中心原本使用瀏覽器原生 `prompt` 收集取消原因，再以 `confirm` 二次確認。原生彈窗在 iPhone Safari 與 LINE 內建瀏覽器的版面、鍵盤、焦點與錯誤處理體驗不一致，因此改為站內「取消預約」Modal。

## 站內互動

- Modal 顯示預約日期、預約時間與服務項目。
- 取消原因不可為空白，送出前會 trim，最多 300 字，與後端取消通知信規則一致。
- 送出中禁止關閉與重複送出。
- API 成功後關閉 Modal 並更新預約列表。
- API 失敗時保留 Modal、取消原因與錯誤提示，使用者不必重新輸入。
- 已取消的預約不再顯示取消按鈕。

## 手機與無障礙

- Modal 寬度保留至少 16px 的畫面邊距，最大高度為 `90dvh`，內容過高時在 Modal 內捲動。
- textarea 使用 16px 字級，避免 iPhone Safari 聚焦時自動放大。
- 底部操作區納入 `safe-area-inset-bottom`，避免 Home Indicator 與手機底部導覽遮擋。
- 支援背景點擊、Escape、focus trap、開啟時聚焦與關閉後焦點復原。
- Dialog 使用 `role="dialog"`、`aria-modal="true"`、標題關聯與 loading 狀態。
- 開啟時鎖定頁面捲動，關閉或元件卸載時恢復原本 body scroll 狀態。

## 業務流程範圍

本包只替換取消預約的前端互動，不修改以下既有流程：

1. Google Calendar 事件取消。
2. 取消通知信寄送。
3. booking 狀態與取消原因更新。
4. 24 小時內不可自行取消的規則。
5. 預約 ownership、付款、時段與資料庫 schema。

前端仍只傳既有的 `bookingId` 與純文字 `cancellationReason`；通知信收件人與內容仍由後端可信任 booking record 推導。

## 驗證尺寸

- 375 x 667
- 390 x 844
- 430 x 932

本機瀏覽器測試使用 mock 預約與攔截 API，不取消 production 預約、不寄信、不執行 SQL。
