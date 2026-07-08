# LINE Pay Fixed IP Proxy Cost Guard SOP

本文件只整理 AWS Lightsail / DigitalOcean 固定 IP payment proxy 的成本防呆與刪除 SOP。  
本輪不建立 AWS 資源、不建立 DigitalOcean 資源、不新增 proxy 專案、不改程式邏輯、不呼叫 LINE Pay API、不部署、不執行 SQL，且不包含任何 key 或 env 真值。

## 一、SOP 目的

這份 SOP 是為了避免建立 AWS Lightsail 或 DigitalOcean 固定 IP proxy 後，忘記刪除資源而持續被收費。

LINE Pay fixed IP payment proxy 若只用於 sandbox / sign-off 測試，應在建立前先記錄預計刪除日期，測試後主動刪除主機、釋放固定 IP，並檢查是否仍有 snapshot、disk、volume、load balancer 或其他殘留資源。

## 二、核心原則

- Stop / Power Off 不等於停止收費。
- AWS Lightsail instance 在 running / stopped 狀態都可能收費，Delete 才停止 instance 費用。
- DigitalOcean Droplet power off 仍會收費，Destroy 才停止 Droplet 費用。
- Static IP / Reserved IP 綁在主機上通常不另收費。
- Static IP / Reserved IP 沒綁主機時可能收費。
- 測試不用時，要刪主機，也要釋放固定 IP。
- 不可只關機就以為不會收費。
- 不可忘記 snapshot / disk / volume / load balancer。
- 不可把 LINE Pay Channel Secret、Supabase service role key、NewebPay HashKey / HashIV 寫進文件或 proxy 設定記錄。

## 三、AWS Lightsail 成本防呆 SOP

### 建立前 checklist

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| 確認只是 sandbox / proxy 測試 |  |  |
| 選最小可用方案 |  |  |
| 設定 Billing Alert / Budget Alert |  |  |
| 紀錄建立日期 |  |  |
| 紀錄預計刪除日期 |  |  |
| 紀錄 instance 名稱 |  |  |
| 紀錄 Static IP 名稱 |  |  |
| 不放 LINE Pay key 到文件 |  |  |
| 不放 Supabase service role key |  |  |
| 不放藍新 HashKey / HashIV |  |  |

建議建立時一併記錄：

- AWS account / region
- Lightsail instance name
- Lightsail Static IP name
- 測試目的
- 預計保留到哪一天
- 負責人

不要記錄：

- LINE Pay Channel Secret
- Supabase service role key
- NewebPay HashKey / HashIV
- TradeInfo / TradeSha
- 真實交易資料
- 個資

### 使用中 checklist

| 項目 | 頻率 | 狀態 | 備註 |
| --- | --- | --- | --- |
| 每次測試後確認 instance 是否仍需要 | 每次測試後 |  |  |
| 檢查 Lightsail console | 每週 |  |  |
| 檢查 Billing / Cost Explorer | 每週 |  |  |
| 確認 Static IP 是否仍 attached | 每週 |  |  |
| 確認沒有多餘 snapshot | 每週 |  |  |
| 確認沒有多餘 disk | 每週 |  |  |
| 確認沒有多餘 load balancer | 每週 |  |  |
| 確認 LINE Pay 白名單是否仍需要該 IP | 每週 |  |  |

使用期間要特別記住：

- Lightsail instance 停止後仍可能繼續計費。
- Static IP detached 後若留在帳號中，可能開始收費。
- Snapshot / disk 也可能持續產生成本。
- 若 proxy 已停用，應確認 Vercel 不再呼叫該 proxy。

### 刪除 SOP

1. 停止 LINE Pay 測試。
2. 確認 proxy 不再被 Vercel 呼叫。
3. 移除 LINE Pay 後台白名單中的該 Static IP，或標記待移除。
4. 備份需要的設定，不含 secret 真值。
5. Delete Lightsail instance。
6. Release / Delete Static IP。
7. 刪除不需要的 snapshot。
8. 刪除不需要的 disk。
9. 確認 Lightsail resource list 為空或只剩必要資源。
10. 到 Billing 檢查是否仍有 Lightsail 預估費用。
11. 記錄刪除日期。

刪除後記錄：

| 項目 | 結果 |
| --- | --- |
| 刪除日期 |  |
| Instance 是否已 Delete |  |
| Static IP 是否已 Release / Delete |  |
| Snapshot 是否已刪除 |  |
| Disk 是否已刪除 |  |
| Load balancer 是否已刪除 |  |
| LINE Pay 白名單是否已移除 |  |
| Billing 是否已確認 |  |
| 是否仍有預估費用 |  |
| 處理人 |  |

## 四、DigitalOcean 成本防呆 SOP

### 建立前 checklist

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| 確認只是 sandbox / proxy 測試 |  |  |
| 選最小可用 Droplet |  |  |
| 設定 Billing Alert |  |  |
| 紀錄建立日期 |  |  |
| 紀錄預計 destroy 日期 |  |  |
| 紀錄 Droplet 名稱 |  |  |
| 紀錄 Reserved IP 名稱 |  |  |
| 不放 LINE Pay key 到文件 |  |  |
| 不放 Supabase service role key |  |  |

建議建立時一併記錄：

- DigitalOcean team / project
- Droplet region
- Droplet name
- Reserved IP name
- 測試目的
- 預計保留到哪一天
- 負責人

不要記錄：

- LINE Pay Channel Secret
- Supabase service role key
- NewebPay HashKey / HashIV
- TradeInfo / TradeSha
- 真實交易資料
- 個資

### 使用中 checklist

| 項目 | 頻率 | 狀態 | 備註 |
| --- | --- | --- | --- |
| 每次測試後確認 Droplet 是否仍需要 | 每次測試後 |  |  |
| 檢查 Droplet list | 每週 |  |  |
| 檢查 Billing | 每週 |  |  |
| 確認 Reserved IP 是否仍 assigned | 每週 |  |  |
| 確認沒有多餘 snapshot | 每週 |  |  |
| 確認沒有多餘 volume | 每週 |  |  |
| 確認沒有多餘 load balancer | 每週 |  |  |
| 確認 LINE Pay 白名單是否仍需要該 IP | 每週 |  |  |

使用期間要特別記住：

- DigitalOcean Droplet power off 後仍會計費。
- Reserved IPv4 若保留但沒有 assigned 到 Droplet，可能開始計費。
- Snapshot / volume / load balancer 也可能持續產生成本。
- 若 proxy 已停用，應確認 Vercel 不再呼叫該 proxy。

### 刪除 SOP

1. 停止 LINE Pay 測試。
2. 確認 proxy 不再被 Vercel 呼叫。
3. 移除 LINE Pay 後台白名單中的該 Reserved IP，或標記待移除。
4. 備份需要的設定，不含 secret 真值。
5. Destroy Droplet。
6. Release / Delete Reserved IP。
7. 刪除不需要的 snapshot。
8. 刪除不需要的 volume。
9. 確認 Droplet resource list 沒有殘留。
10. 到 Billing 檢查是否仍有預估費用。
11. 記錄刪除日期。

刪除後記錄：

| 項目 | 結果 |
| --- | --- |
| 刪除日期 |  |
| Droplet 是否已 Destroy |  |
| Reserved IP 是否已 Release / Delete |  |
| Snapshot 是否已刪除 |  |
| Volume 是否已刪除 |  |
| Load balancer 是否已刪除 |  |
| LINE Pay 白名單是否已移除 |  |
| Billing 是否已確認 |  |
| 是否仍有預估費用 |  |
| 處理人 |  |

## 五、付款 proxy 暫停 / 關閉 checklist

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| Vercel 是否還在呼叫 proxy |  |  |
| LINE Pay request / confirm 是否已停用 |  |  |
| `NEXT_PUBLIC_ENABLE_LINE_PAY` 是否已關閉 |  |  |
| `LINE_PAY_PROXY_URL` 是否已移除或停用 |  | 若未來有新增此 env，需同步檢查 |
| LINE Pay 後台白名單是否移除該 IP |  |  |
| proxy env 是否已刪除 |  |  |
| Channel Secret 是否需要重新產生 |  | 視情況 |
| 是否還有 pending payment 需要人工確認 |  |  |
| 是否確認 NewebPay 不受影響 |  |  |
| 是否確認藍新 MPG `LINEPAY=1` 未啟用 |  |  |

若仍有 pending payment：

- 不要自動 mark paid。
- 不要自動 mark failed。
- 先查本地 `payments` / `product_orders` 狀態。
- 必要時人工比對 LINE Pay 後台與本地紀錄。
- 不要把未遮蔽 transactionId / orderId / paymentId 貼到文件或聊天室。

## 六、每週成本檢查表

| 日期 | 平台：AWS / DO | instance / droplet 是否存在 | static IP / reserved IP 是否存在 | 是否仍綁定主機 | snapshot 是否存在 | disk / volume 是否存在 | 當月預估費用 | 是否需要保留 | 處理人 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |  |

每週檢查建議：

- 若不需要測試，立即安排刪除。
- 若還要保留，更新預計刪除日期。
- 若有 unassigned Static IP / Reserved IP，立即釋放或確認是否仍必要。
- 若有 snapshot / disk / volume，確認是否要保留。
- 若當月預估費用異常，先暫停測試並盤點資源。

## 七、測試結束後回報格式

```text
LINE Pay fixed IP proxy 測試結束清理回報

- 測試是否結束：是 / 否
- 平台：AWS Lightsail / DigitalOcean
- instance / droplet 是否已刪除：是 / 否
- Static IP / Reserved IP 是否已釋放：是 / 否
- snapshot / disk / volume 是否已刪除：是 / 否
- LINE Pay 白名單是否已移除測試 IP：是 / 否
- Billing 是否已確認：是 / 否
- 是否仍有預估費用：是 / 否
- 是否還有 pending payment 需人工確認：是 / 否
- 備註：
```

回報時不要包含：

- LINE Pay Channel Secret
- production env 真值
- sandbox env 真值
- 未遮蔽 transactionId
- 未遮蔽 orderId
- 未遮蔽 paymentId
- 個資
- 測試卡號
- NewebPay HashKey / HashIV
- TradeInfo / TradeSha

## 八、禁止事項

- 不要只 Stop / Power Off 就以為不收費。
- 不要保留未綁定 Static IP / Reserved IP。
- 不要忘記 snapshot / disk / volume。
- 不要忘記 load balancer 或其他附加資源。
- 不要把 Channel Secret 寫進文件。
- 不要把 Channel Secret 貼到聊天室。
- 不要把 Supabase service role key 放到 proxy。
- 不要把藍新 HashKey / HashIV 放到 proxy。
- 不要啟用藍新 MPG `LINEPAY=1`。
- 不要修改 NewebPay 既有流程。
- 不要讓 proxy 直接 mark paid。
- 不要讓 proxy 直接 sync `product_orders`。
- 不要在成本未確認時進 production sign-off。

## 九、官方參考

- AWS Lightsail FAQ: https://aws.amazon.com/lightsail/faq/
- AWS Lightsail pricing: https://aws.amazon.com/lightsail/pricing/
- AWS Lightsail static IP addresses: https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-static-ip-addresses-in-amazon-lightsail.html
- DigitalOcean Droplet pricing: https://docs.digitalocean.com/products/droplets/details/pricing/
- DigitalOcean Reserved IP pricing: https://docs.digitalocean.com/products/networking/reserved-ips/details/pricing/
