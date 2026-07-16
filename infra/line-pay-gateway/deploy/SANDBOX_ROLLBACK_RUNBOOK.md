# LINE Pay Gateway Sandbox Rollback Runbook

## 目的與限制

此流程只把 Sandbox Gateway 回復到主機上已存在、已審核的上一個 image tag／commit。它不刪除資料、logs、image、Droplet、Reserved IP、DNS、TLS、LINE Pay 後台設定或 Vercel 設定。

以下情況使用 rollback：

- 新 image 無法啟動或 health 失敗。
- Gateway HMAC 行為與已審核版本不符。
- 固定 operation／Sandbox upstream 驗證失敗。
- Caddy 可連到 localhost，但 Gateway 回應異常。

若已發生可疑 secret 洩漏、未授權付款或 Production 流量，先停止流量並走安全事件流程，不要只靠 image rollback。

## 1. 執行前檢查

確認：

- 網站 LINE Pay 入口仍關閉。
- 沒有進行中的 Sandbox 付款。
- 已知道目前 image tag 與上一個已審核 tag。
- 上一個 image 已存在本機。
- env file 仍是 root owner、mode 600、Sandbox。
- localhost port、固定出口與 Caddy 狀態已記錄。

唯讀指令：

```bash
cd /opt/line-pay-gateway/repository/infra/line-pay-gateway
sudo docker compose -f deploy/compose.yaml ps
sudo docker image ls line-pay-fixed-ip-gateway
sudo stat -c '%U:%G %a %n' /etc/line-pay-gateway/gateway.env
cat /opt/line-pay-gateway/DEPLOYED_IMAGE_TAG
```

不要顯示 env file 內容。

停止條件：

- 無法確認上一個 tag。
- 上一個 image 不存在。
- env file 權限或 Sandbox 環境無法確認。
- 有未完成付款或需要資料庫操作。

## 2. 先做 dry-run

```bash
deploy/scripts/rollback.sh --previous-tag <PREVIOUS_AUDITED_TAG>
```

成功標準：

- 顯示 rollback 目標與會執行的有限範圍。
- 明確顯示 dry-run。
- 沒有 container 或檔案被修改。

失敗時：停止，不加 `--execute`。

回復方式：dry-run 無修改，不需回復。

## 3. 保存故障版本 logs

`rollback.sh --execute` 會先把目前 Gateway logs 保存到：

```text
/var/log/line-pay-gateway/pre-rollback-YYYYMMDDTHHMMSSZ.log
```

人工確認：

- 目錄只有 root 可寫。
- log 內容沒有 secret、完整簽章、authorization headers、payload 或個資。

若發現敏感資訊：

- 停止一般 rollback。
- 限制 log 存取。
- 輪替所有可能暴露的 Gateway secret。
- 不把 log 上傳到未授權服務。

## 4. 執行互動式 rollback

```bash
sudo \
  GATEWAY_ENV_FILE=/etc/line-pay-gateway/gateway.env \
  GATEWAY_BIND_PORT=3000 \
  deploy/scripts/rollback.sh \
    --previous-tag <PREVIOUS_AUDITED_TAG> \
    --execute
```

script 會要求人工輸入完整 previous tag。確認後只會：

1. 保存目前 Gateway logs。
2. `docker compose stop gateway`。
3. 使用本機既有 previous image 執行 `up -d --no-build --no-deps gateway`。
4. 驗證 localhost health。
5. health 成功後更新 `DEPLOYED_IMAGE_TAG`。

script 不會：

- build 或 pull 新 image。
- `docker compose down`。
- 刪除 container、image、volume 或 logs。
- 修改 env、Caddy、DNS、Reserved IP、Droplet、LINE Pay 或 Vercel。

成功標準：

- localhost health 通過。
- `DEPLOYED_IMAGE_TAG` 是上一個 tag。
- Gateway 仍只綁 `127.0.0.1:3000`。

失敗時：

- script 退出非 0。
- 停止外部 HMAC 測試。
- 保留所有 container 與 logs，不執行 cleanup。

## 5. Rollback 後驗證

依序執行：

```bash
deploy/scripts/verify-health.sh http://127.0.0.1:3000/health
deploy/scripts/verify-egress.sh 165.245.144.110
deploy/scripts/verify-tls.sh <GATEWAY_DOMAIN>
sudo docker compose -f deploy/compose.yaml ps
sudo docker compose -f deploy/compose.yaml logs --no-color gateway
```

成功標準：

- localhost health 正常。
- egress 是 `165.245.144.110`。
- TLS／HTTP redirect 正常。
- logs 沒有秘密。

失敗時：

- 不切網站流量。
- 不嘗試 Production。
- 由人工比較 Caddy、host network、env 權限與 image digest。

## 6. 若上一個 image 也失敗

停止自動操作並收集：

- `docker compose ps`
- container health 狀態。
- 遮蔽後的 Gateway allowlist logs。
- `ss -ltn`
- `df -h`
- 固定出口檢查結果。
- Caddy service status。
- 目前與上一個完整 commit SHA。

不要：

- 刪除 container、image 或 `/var/lib/docker`。
- 刪除 Droplet 或 Reserved IP。
- 修改 LINE Pay 後台。
- 修改 Vercel Production。
- 把 transport 改為 direct 當作無審核 fallback。

## 7. 回復新版本前

修正必須回到 Git：

1. 建立獨立修正分支與高風險 Draft PR。
2. 重跑 Gateway tests、網站 LINE Pay tests、Docker／Compose checks。
3. 人工審核。
4. 用新完整 commit SHA build 新 image。
5. 重新依 Sandbox deploy runbook 部署。

不得在主機 checkout 中直接修改 TypeScript、Compose 或 Caddy example 後當成正式修正。

## 8. Rollback 紀錄

記錄但不包含 secret：

- rollback 時間與操作者。
- 原 image tag／commit。
- 回復 image tag／commit。
- 觸發原因。
- logs 保存路徑。
- health／egress／TLS 結果。
- 後續修正 PR。

## 9. 永久退場不是 rollback

永久停止 LINE Pay 必須另外人工執行：

1. 關閉網站 LINE Pay 入口。
2. 停止背景對帳與補單。
3. 撤銷網站與 Gateway secrets。
4. 停用 LINE Pay Channel 或 IP 白名單。
5. 停止 Gateway container。
6. 刪除 Droplet。
7. 刪除 Reserved IP，不可只解除綁定。
8. 移除 DNS。
9. 移除 TLS、監控與告警。
10. 確認 DigitalOcean 不再持續計費。

`rollback.sh` 永遠不執行這些退場動作。
