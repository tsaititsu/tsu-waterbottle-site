# 紫微占卜 LINE 內建瀏覽器付款提醒

## 目的

紫微占卜使用者若在手機 LINE 內建瀏覽器進入付款階段，付款按鈕上方會顯示提示，建議先從右上角選單改用預設瀏覽器開啟，以提高付款與返回本次解讀頁的穩定性。

## 顯示規則

- 只針對手機 LINE 內建瀏覽器。
- 只在紫微占卜已進入可付款階段時顯示。
- iPhone Safari、Android Chrome、桌面瀏覽器不顯示。
- 紫微占卜結果頁與「我的占卜紀錄」不顯示。
- 提示不阻擋正式 NT$50 付款，也不阻擋管理員 NT$1 測試付款。
- 系統不會自動跳轉外部瀏覽器，也不要求使用者勾選確認。

這是瀏覽器使用提醒，不代表支援或啟用 LINE Pay。

## 本包範圍

- 未修改 NewebPay、Apple Pay、付款 payload、NotifyURL 或 ReturnURL。
- 未修改 paid gate、解讀續跑或 OpenAI 呼叫。
- 未套用到商品、課程或預約流程。

## 驗證環境

- `390×844`：LINE iPhone user agent。
- `390×844`：iPhone Safari user agent。
- `430×932`：LINE Android user agent。

瀏覽器測試停在付款按鈕前，使用 mock 回應進入付款階段，未建立真實 payment，未呼叫 NewebPay 或 OpenAI。
