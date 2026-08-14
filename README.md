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
  widgets.yaml             #   頁首資訊小工具（問候 / 搜尋 / 日期 / 天氣 / VPS 資源）
  bookmarks.yaml           #   快速連結（後台 / 程式碼 / 文件）
  custom.js                #   頁首補當前城市；底部資訊卡（匯率/世界時鐘/預報/HN）
  custom.css               #   custom.js 的樣式
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

## mangan-log 路由（取代 Coolify）

mangan-log（Manganle Health Tracker，React + Vite PWA）原本用 Coolify 部署在 duckdns，
現改為 build 成靜態檔走 Caddy，與其他服務一致。

**界線**：這個 repo 只負責**路由**——`sites/mangan-log.caddy` 把
`mangan-log.garyhsieh-proj.com` 反向代理到 VPS 上的靜態檔 `/srv/mangan-log`。
**build 與部署**跟著 app 走，在 mangan-log 自己的 repo：

```bash
# 於 mangan-log 專案目錄
VPS=root@你的VPS npm run deploy
```

它會 build 出 `dist/` 並 scp 到 VPS `/srv/mangan-log`。細節見該 repo 的 `deploy.sh`。

VPS 端一次性：放好 `sites/mangan-log.caddy` → `caddy validate` → `reload`；
Cloudflare 加 `mangan-log.garyhsieh-proj.com` A 記錄（灰雲）。確認新網域可用後，
即可在 Coolify 刪掉舊 app；若 Coolify 已無其他負載，可整套退役。

## home 頁面登入（basic_auth）

`sites/home.caddy` 用 `basic_auth` 保護整頁，密碼 hash 由環境變數
`HOME_AUTH_HASH` 帶入（不寫進版控）。在 VPS 上一次性設定：

```bash
# 1. 產生密碼 hash（會輸出 $2a$... 一長串，複製它）
caddy hash-password --plaintext '你的密碼'

# 2. 寫進 Caddy 的環境檔（值照貼，$ 不必跳脫）
echo 'HOME_AUTH_HASH=貼上剛才的hash' | sudo tee /etc/caddy/caddy.env

# 3. 讓 caddy.service 讀這個環境檔
sudo systemctl edit caddy      # 在編輯區加入：
#   [Service]
#   EnvironmentFile=/etc/caddy/caddy.env
sudo systemctl daemon-reload

# 4. 驗證 + 套用（手動 validate 前先 export，否則佔位符是空的）
export HOME_AUTH_HASH=貼上剛才的hash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

之後開 `home.garyhsieh-proj.com` 會跳出登入框（帳號 `gary` + 你設的密碼），
瀏覽器記住後就不用每次輸入。想改帳號/多帳號，改 `sites/home.caddy` 的 `basic_auth` 區塊。

> 想省事也可以把 hash 直接寫進 `sites/home.caddy`（取代 `{$HOME_AUTH_HASH}`），
> 但那樣 hash 會進 git——**公開 repo 請務必用強密碼，或維持環境變數作法**。

## 修改設定

改完 `homepage-config/*.yaml` 後，Homepage 會自動重讀，多數情況不需重啟容器；
若沒生效再 `docker compose restart homepage`。
