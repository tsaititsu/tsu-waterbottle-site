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
- 已知道目前與上一個已審核的 40 字元小寫完整 commit SHA；短 SHA、branch、`latest` 或任意 release 名稱都不接受。
- 上一個 image 已存在本機。
- env file 仍是 root owner、mode 600、Sandbox。
- 獨立 `proxy.env` 仍是 root:root、mode 600、非 symlink，且只含 Proxy Token。
- localhost port、固定出口與 Caddy 狀態已記錄。

唯讀指令：

```bash
cd /opt/line-pay-gateway/repository/infra/line-pay-gateway
export CURRENT_DEPLOY_SHA="$(cat /opt/line-pay-gateway/DEPLOYED_IMAGE_TAG)"
deploy/scripts/validators.sh \
  release \
  line-pay-fixed-ip-gateway \
  "$CURRENT_DEPLOY_SHA"
sudo \
  GATEWAY_IMAGE_NAME=line-pay-fixed-ip-gateway \
  GATEWAY_IMAGE_TAG="$CURRENT_DEPLOY_SHA" \
  LINE_PAY_GATEWAY_ENV_FILE=/etc/line-pay-gateway/gateway.env \
  LINE_PAY_GATEWAY_PROXY_ENV_FILE=/etc/line-pay-gateway/proxy.env \
  GATEWAY_BIND_PORT=3000 \
  deploy/scripts/compose.sh ps
sudo docker image ls line-pay-fixed-ip-gateway
sudo stat -c '%U:%G %a %n' \
  /etc/line-pay-gateway/gateway.env \
  /etc/line-pay-gateway/proxy.env
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

`<PREVIOUS_AUDITED_TAG>` 必須符合 `^[0-9a-f]{40}$`。Script 以共用 validator 分別驗證固定 image name `line-pay-fixed-ip-gateway` 與完整 SHA，任何短 SHA、branch、`latest`、大寫或額外字尾都會在 Docker 操作前被拒絕。

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

- `/var/log/line-pay-gateway` 不是 symlink，owner／group 是 `root:root`，mode 是 `0750` 或更嚴格的 `0700`。
- 目錄不存在時，script 只會以 `install -d -o root -g root -m 0750` 安全建立；parent 不存在、是 symlink 或不是目錄時 fail closed。
- 每一份 `pre-rollback-*.log` 都由 root 建立，owner／group 是 `root:root`，mode 固定為 `0600`。
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
  GATEWAY_PROXY_ENV_FILE=/etc/line-pay-gateway/proxy.env \
  GATEWAY_BIND_PORT=3000 \
  deploy/scripts/rollback.sh \
    --previous-tag <PREVIOUS_AUDITED_TAG> \
    --execute
```

script 會要求人工輸入完整 previous tag。確認後只會：

1. 驗證或安全建立 root-owned rollback log directory，以 mode `0600` 保存目前 Gateway logs。
2. 經 `deploy/scripts/compose.sh` 執行 `stop gateway`。
3. 使用同一個受保護 wrapper 與本機既有 previous image 執行 `up -d --no-build --no-deps gateway`。
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
deploy/scripts/verify-tls.sh linepay-gateway.tsu-waterbottle.com
sudo \
  GATEWAY_IMAGE_NAME=line-pay-fixed-ip-gateway \
  GATEWAY_IMAGE_TAG="<PREVIOUS_AUDITED_TAG>" \
  LINE_PAY_GATEWAY_ENV_FILE=/etc/line-pay-gateway/gateway.env \
  LINE_PAY_GATEWAY_PROXY_ENV_FILE=/etc/line-pay-gateway/proxy.env \
  GATEWAY_BIND_PORT=3000 \
  deploy/scripts/compose.sh ps
sudo \
  GATEWAY_IMAGE_NAME=line-pay-fixed-ip-gateway \
  GATEWAY_IMAGE_TAG="<PREVIOUS_AUDITED_TAG>" \
  LINE_PAY_GATEWAY_ENV_FILE=/etc/line-pay-gateway/gateway.env \
  LINE_PAY_GATEWAY_PROXY_ENV_FILE=/etc/line-pay-gateway/proxy.env \
  GATEWAY_BIND_PORT=3000 \
  deploy/scripts/compose.sh logs --no-color gateway
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

## 6. Caddy systemd 或 journal guard 失敗時

若有效 ExecStart 驗證失敗、80／443 owner 不符、2019 對外監聽，或新 journal 範圍偵測到 Proxy Token，先保留 localhost Gateway，再回復 Caddyfile 與 systemd drop-in：

```bash
sudo systemctl stop caddy
sudo systemctl disable caddy
sudo cp --archive \
  "$CADDY_BACKUP_DIR/Caddyfile.before" \
  /etc/caddy/Caddyfile
if sudo test -f "$CADDY_BACKUP_DIR/line-pay-gateway.conf.before"; then
  sudo install -o root -g root -m 0644 \
    "$CADDY_BACKUP_DIR/line-pay-gateway.conf.before" \
    /etc/systemd/system/caddy.service.d/line-pay-gateway.conf
elif sudo test -f "$CADDY_BACKUP_DIR/drop-in-was-absent"; then
  sudo unlink /etc/systemd/system/caddy.service.d/line-pay-gateway.conf
else
  echo "無法確認先前 drop-in 狀態；停止並人工確認。"
  exit 1
fi
sudo systemctl daemon-reload
sudo systemctl cat caddy
sudo systemctl is-active caddy
sudo systemctl is-enabled caddy
```

成功標準：

- Caddy 保持 inactive／disabled。
- 80／443／2019 沒有 Caddy listener。
- `127.0.0.1:3000` Gateway 仍 healthy。
- 備份與 journal 保留供安全事件盤點，不顯示任何 env 內容。

若 Proxy Token 曾出現在 journal，這是秘密事件：維持 Caddy 停止、限制 journal 與備份存取，並由有權限人員另行輪替 Proxy Token。不要只重啟 Caddy，也不要把 journal 上傳到未授權服務。

## 7. 若上一個 image 也失敗

停止自動操作並收集：

- `deploy/scripts/compose.sh ps`（提供目前完整 commit SHA）
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

## 8. 回復新版本前

修正必須回到 Git：

1. 建立獨立修正分支與高風險 Draft PR。
2. 重跑 Gateway tests、網站 LINE Pay tests、Docker／Compose checks。
3. 人工審核。
4. 用新完整 commit SHA build 新 image。
5. 重新依 Sandbox deploy runbook 部署。

不得在主機 checkout 中直接修改 TypeScript、Compose 或 Caddy example 後當成正式修正。

## 9. Rollback 紀錄

記錄但不包含 secret：

- rollback 時間與操作者。
- 原 image tag／commit。
- 回復 image tag／commit。
- 觸發原因。
- logs 保存路徑。
- health／egress／TLS 結果。
- Caddyfile 與 systemd drop-in 備份路徑、有效 ExecStart 驗證與 journal guard 結果。
- 後續修正 PR。

## 10. 永久退場不是 rollback

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
