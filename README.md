# service-home

VPS 服務導航頁 **home.garyhsieh-proj.com**，用 [Homepage](https://gethomepage.dev/)
建置。定位是「淺層服務入口大廳」：只做連結 + 狀態燈號，深度操作（效能監控、
Docker 容器操作、檔案管理）仍走 [VPS Dashboard](https://dashboard.garyhsieh-proj.com)。

## 結構

```
docker-compose.yml          # Homepage 容器（綁 127.0.0.1:3050，對外走 Caddy）
homepage-config/            # 掛載進容器的 /app/config，YAML 皆版控
  settings.yaml             #   標題、主題、群組排列
  services.yaml             #   服務卡片（href + siteMonitor + 容器狀態）
  docker.yaml              #   docker.sock 連線，供卡片顯示容器狀態摘要
sites/home.caddy            # Caddy 反向代理設定，部署到 /etc/caddy/sites/
```

## 部署

1. 啟動容器：

   ```bash
   docker compose up -d
   ```

2. 佈署 Caddy 設定（複製到 VPS 的 `/etc/caddy/sites/`），驗證後 reload：

   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

3. Cloudflare 新增 `home.garyhsieh-proj.com` A 記錄，**灰色雲朵（僅限 DNS）**，
   指向 VPS IP，否則 Caddy 簽 HTTPS 憑證會失敗。

4. 打開 https://home.garyhsieh-proj.com 檢查每張卡片的連結與狀態燈號。

## 收錄的服務

| 服務 | 網域 | 後端 |
|---|---|---|
| VPS Dashboard | dashboard.garyhsieh-proj.com | localhost:3001 |
| Quick Portal | portal.garyhsieh-proj.com | localhost:5001 |
| DevHub | devhub.garyhsieh-proj.com | localhost:5000 |
| 繪本庫 | library.garyhsieh-proj.com | 127.0.0.1:3100 |
| 定期通知 | routine.garyhsieh-proj.com | 靜態檔（Caddy basic_auth） |
| ntfy | notify.garyhsieh-proj.com | 127.0.0.1:18080 |
| Supabase | supabase.garyhsieh-proj.com | localhost:8000 |

舊的 duckdns 網域在過渡期由 `sites/legacy-duckdns.caddy`（在 VPS 上）備援，
全部驗證完畢前不要刪除。

## 容器狀態摘要

卡片透過唯讀掛載的 `docker.sock` 顯示容器上/下線與 CPU/記憶體，只做「一眼看有沒有
掛掉」。`services.yaml` 裡的 `container:` 名稱為推測值，部署前先在 VPS 核對：

```bash
docker ps --format '{{.Names}}'
```

名稱對不上時 Homepage 只會不顯示狀態、不報錯。非容器服務（如 routine 靜態檔）不掛
`container`。深度操作（重啟、看 log）仍走 VPS Dashboard。

## mangan-log 部署（取代 Coolify）

mangan-log（Manganle Health Tracker，React + Vite PWA，原始碼 `D:\code\mangan-log`）
原本用 Coolify 部署在 duckdns，現改為與其他服務一致：build 成靜態檔，走 Caddy。

前置一次性設定：

1. 在 `D:\code\mangan-log\.env.production` 填入（此檔已被該 repo gitignore）：

   ```
   VITE_SUPABASE_URL=https://supabase.garyhsieh-proj.com
   VITE_SUPABASE_ANON_KEY=<沿用原 Coolify env 的 anon key>
   ```

2. VPS 放好 `sites/mangan-log.caddy`，Cloudflare 加 `mangan-log.garyhsieh-proj.com`
   A 記錄（灰雲）。

之後每次更新，一行搞定（Windows Git Bash 或 Linux 皆可）：

```bash
VPS=root@你的VPS bash scripts/deploy-mangan-log.sh
```

腳本會 `npm ci && npm run build`（自動載入 `.env.production`）再把 `dist/` 送到 VPS
`/srv/mangan-log`。確認新網域可用後，即可在 Coolify 刪掉舊 app；若 Coolify 已無其他
負載，可整套退役。

> ⚠️ `VITE_SUPABASE_URL` 是 build 期寫死的：Supabase 換網域一定要重跑此腳本重建。

## 修改設定

改完 `homepage-config/*.yaml` 後，Homepage 會自動重讀，多數情況不需重啟容器；
若沒生效再 `docker compose restart homepage`。
