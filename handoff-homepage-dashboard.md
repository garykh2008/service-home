# 專案交接：Homepage 導航頁 (home.garyhsieh-proj.com)

## 背景

VPS 上服務越來越多，正在從 duckdns 網域遷移到正式網域
`garyhsieh-proj.com`（Cloudflare 管理 DNS，A 記錄需設「僅限 DNS／灰色雲朵」，
否則 Caddy 簽 HTTPS 憑證會失敗）。反向代理用 Caddy，設定拆成多檔管理。

## 現有服務與網域對應

| 服務 | 新網域 | 後端 | 備註 |
|---|---|---|---|
| VPS Dashboard | dashboard.garyhsieh-proj.com | localhost:3001 | 專案在 `D:\code\vps-dashboard`，效能/Docker/檔案管理，深度操作面板 |
| Quick Portal | portal.garyhsieh-proj.com | localhost:5001 | 跨裝置快速傳送門 |
| DevHub | devhub.garyhsieh-proj.com | localhost:5000 | 原本用裸 IP:port 對外開放，已收回只允許 localhost |
| 繪本庫 | library.garyhsieh-proj.com | 127.0.0.1:3100 | |
| 定期通知 (routine-notify) | routine.garyhsieh-proj.com | 靜態檔 `/srv/routine-web` | Caddy 層有 basic_auth |
| ntfy | notify.garyhsieh-proj.com | 127.0.0.1:18080 | 已開 `enable-login`，訂閱清單存伺服器端帳號，登入可跨裝置同步 |
| Supabase (mangan-log) | supabase.garyhsieh-proj.com | localhost:8000 | self-hosted，`.env` 裡的 `API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL` 待確認是否已同步改成新網域 |

舊的 duckdns 網域（`gary-digitalocean.duckdns.org` 等）仍保留在
`sites/legacy-duckdns.caddy` 作為過渡期備援，尚未全部驗證完畢前不要刪除。

## Caddy 設定結構（多檔）

```
/etc/caddy/Caddyfile          # 主檔，內容只有 import sites/*.caddy
/etc/caddy/sites/*.caddy      # 每個服務一個檔案
```

部署流程：改完檔案後 `sudo caddy validate --config /etc/caddy/Caddyfile`，
確認無誤後用 `sudo systemctl reload caddy`（不要用 restart，reload 不中斷連線）。

## 本次任務：建立 home.garyhsieh-proj.com 導航頁

選定工具：**Homepage**（https://gethomepage.dev/），理由是 YAML 設定檔可版控、
內建健康狀態檢查（HTTP/ping）、可讀 Docker label 自動偵測容器。

### 待完成項目

1. 部署 Homepage 容器：

```yaml
# docker-compose.yml
services:
  homepage:
    image: ghcr.io/gethomepage/homepage:latest
    container_name: homepage
    ports:
      - 127.0.0.1:3050:3000
    volumes:
      - ./homepage-config:/app/config
      - /var/run/docker.sock:/var/run/docker.sock:ro
    restart: unless-stopped
```

2. 設定 `homepage-config/services.yaml`，把上表所有服務列成卡片，
   每張卡片帶 `href` 和 `siteMonitor`（同一個網址即可，用來做健康檢查燈號）。

3. 新增 Caddy 設定檔 `sites/home.caddy`：

```
home.garyhsieh-proj.com {
	reverse_proxy 127.0.0.1:3050
}
```

4. Cloudflare 加一筆 `home.garyhsieh-proj.com` 的 A 記錄（灰色雲朵）指向 VPS IP。

5. 部署、`caddy validate` → `reload`，實際打開網址測試每張卡片的連結與健康狀態燈號是否正確。

### 重要邊界說明

Homepage 定位是「淺層服務入口大廳」，只做連結＋狀態燈號，**不要**在裡面重做
VPS Dashboard（`D:\code\vps-dashboard`）已經有的深度功能（效能監控、Docker
容器操作、檔案管理）。兩者是互補關係，不是重複——Homepage 可以視需要用
docker.sock 顯示容器清單當作「一眼看有沒有掛掉」的摘要，但實際操作（重啟容器、
看 log、瀏覽檔案）仍然通過 VPS Dashboard 進行。
