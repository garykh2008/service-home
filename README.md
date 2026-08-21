# service-home

VPS 主控台 **home.garyhsieh-proj.com**，用 [Glance](https://github.com/glanceapp/glance)
建置：服務啟動器 + 健康監控 + 資訊面板（新聞/行情/世界時鐘/待辦）合一頁。定位是
「淺層入口」：連結 + 狀態燈號，深度操作（效能監控、Docker 容器操作、檔案管理）
仍走 [VPS Dashboard](https://dashboard.garyhsieh-proj.com)。

> 原本用 [Homepage](https://gethomepage.dev/) + 手刻的 custom.js 資訊面板，
> 2026-08 評估後改用 Glance 整合成一頁（不想再多開一個分頁/網域）。

## 結構

```
docker-compose.yml           # glance + uptime-kuma 容器
glance-config/glance.yml     # Glance 全部設定：主題、服務監控、新聞、行情、書籤、待辦…
sites/home.caddy             # Caddy 反向代理（home，basic_auth 保護，接到 glance）
sites/status.caddy           # Caddy 反向代理（Uptime Kuma 後台）
sites/report.caddy           # Caddy 反向代理（Report 檢視，basic_auth 保護，接到 :8787）
sites/docs.caddy             # Caddy 反向代理（API 文件生成器，basic_auth 保護，接到 :8090）
```

## 部署

1. 啟動容器：

   ```bash
   docker compose up -d --remove-orphans
   ```

2. 佈署 Caddy 設定（複製到 VPS 的 `/etc/caddy/sites/`），驗證後 reload：

   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

3. Cloudflare 新增 `home.garyhsieh-proj.com` A 記錄，**灰色雲朵（僅限 DNS）**，
   指向 VPS IP，否則 Caddy 簽 HTTPS 憑證會失敗。

4. 打開 https://home.garyhsieh-proj.com（basic_auth 登入見下方）檢查各 widget。

## 收錄的服務（Glance「服務健康」monitor）

服務變多後（2026-08）拆成兩份獨立清單：Home 頁留生活/個人用的，開發/維運類的
移到獨立的「工作」分頁。

| 服務 | 分頁 | 網域 | 備註 |
|---|---|---|---|
| 繪本庫 | Home | library.garyhsieh-proj.com | |
| mangan-log | Home | mangan-log.garyhsieh-proj.com | |
| DayLink Calendar | Home | daylink-calendar.vercel.app | Vercel 託管，不在 VPS 上 |
| ShareSettle | Home | sharesettle.vercel.app | Vercel 託管，不在 VPS 上 |
| VPS Dashboard | Home | dashboard.garyhsieh-proj.com | |
| 定期通知 | Home | routine.garyhsieh-proj.com | 自己有 basic_auth，用 `alt-status-codes: [401]` 視為正常 |
| ntfy | Home | notify.garyhsieh-proj.com | |
| Supabase | Home | supabase.garyhsieh-proj.com | kong 要求 apikey，同樣用 `alt-status-codes: [401]` |
| Quick Portal | 工作 | portal.garyhsieh-proj.com | |
| DevHub | 工作 | devhub.garyhsieh-proj.com | |
| Report 檢視 | 工作 | report.garyhsieh-proj.com | 自己有 basic_auth，用 `alt-status-codes: [401]` 視為正常 |
| API 文件生成器 | 工作 | docs.garyhsieh-proj.com | 服務本身在 `/root/APIDocGenerator`（獨立 repo），基本邏輯同 Report 檢視 |

舊的 duckdns 網域在過渡期由 `sites/legacy-duckdns.caddy`（在 VPS 上）備援，
全部驗證完畢前不要刪除。

> 深度容器狀態（CPU/記憶體、重啟、看 log）不在這頁做，走 VPS Dashboard。
> `routine`/`supabase` 目前只驗證「有回應」，不是真的通過認證檢查；
> 想要精確一點可以幫 `monitor` 那兩筆加 `basic-auth:` / 標頭，見 glance.yml 內註解。

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

## 監控引擎：Uptime Kuma

`uptime-kuma` 容器（綁 `127.0.0.1:3051`，資料存 named volume）是**背景監控引擎**：
歷史曲線、正常運行率、以及**掛掉自動推播到 ntfy**都是它在做。Glance 首頁的
「服務健康」monitor widget 是**即時檢查**（做啟動器 + 一眼看有沒有掛），兩者互補、
各自獨立運作，不是同一件事。

一次性設定：

1. VPS 啟動：`docker compose up -d`。
2. Caddy：`cp sites/status.caddy /etc/caddy/sites/` → validate → reload；
   Cloudflare 加 `status.garyhsieh-proj.com` A 記錄（灰雲）。
3. 開 `https://status.garyhsieh-proj.com` → 建管理員帳號 → 為每個服務新增 Monitor。
4. 設定通知（設定 → 通知 → 新增 ntfy），套用到所有監測器 → 服務掛掉會推播到手機。

## Glance 設定（`glance-config/glance.yml`）

一個 YAML 檔管全部，四個分頁：

**Home**
- **左欄**：`search`(DDG)、`clock`(SF/新竹世界時鐘)、`weather`(新竹天氣，固定地點)。
- **中欄**：`markets`(USD/TWD、TWD/JPY 匯率)、`to-do`(待辦，內建儲存)。
- **右欄**：`monitor`(服務健康，個人/生活用服務)、`server-stats`(VPS CPU/記憶體)、
  `bookmarks`(快速連結)。

**工作**：`monitor`(服務健康，Gary 認定的工作用服務：Quick Portal、DevHub、
Report 檢視、API 文件生成器)。跟 Home 的服務健康是兩份獨立清單——2026-08
服務數量變多後拆開，哪個服務歸哪頁純粹按 Gary 的分類，不是照技術性質分，
見上方服務表格哪個歸哪邊。

**News**
- **左欄**：`hacker-news`。
- **中/右欄**：`rss`(中央社科技、The Verge)。

**影片**：`videos` widget（grid-cards 排版），追蹤特定 YouTube 頻道的更新，
獨立分頁避免擠在 News 頁下面。

主題色對齊原本 Homepage 的 slate 深色 + sky 強調色（`theme:` 區塊；**`light: false`
必須明確寫**，不然整組主題會被 Glance 判定不完整而退回內建預設）。

**目前沒有的**（Glance 沒有原生對應，想要再手動補）：倒數計時、自由便條/scratchpad——
可以考慮用 Glance 的 `html` widget 手刻一個簡易版，或維持不做。

改完 `glance-config/glance.yml` 通常不需重建容器，改完存檔即生效；
沒生效再 `docker compose restart glance`。

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

## report 頁面登入（basic_auth）

`sites/report.caddy` 把 `report.garyhsieh-proj.com` 反代到 VPS 內部服務 `127.0.0.1:8787`
（該服務本身沒對外開網域，只綁 host 的 loopback），同樣用 `basic_auth` 保護，
密碼 hash 走獨立的環境變數 `REPORT_AUTH_HASH`（跟 home 的帳密分開，可以設不同密碼）。

一次性設定（`caddy.env` 已存在的話直接補一行，不用整個重來）：

```bash
caddy hash-password --plaintext '你的密碼'
echo 'REPORT_AUTH_HASH=貼上剛才的hash' | sudo tee -a /etc/caddy/caddy.env

export REPORT_AUTH_HASH=貼上剛才的hash   # 手動 validate 前先 export
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

別忘了 Cloudflare 新增 `report.garyhsieh-proj.com` A 記錄（灰色雲朵，僅限 DNS），
否則 Caddy 簽 HTTPS 憑證會失敗。

## docs 頁面登入（basic_auth）

`sites/docs.caddy` 把 `docs.garyhsieh-proj.com` 反代到 API 文件生成器
（`/root/APIDocGenerator`，獨立 repo，只綁 `127.0.0.1:8090`；該服務本身也有
`APIDOC_PASSWORD` 機制，但目前留空，完全靠 Caddy 這層 basic_auth 做保護）。
密碼 hash 走獨立的環境變數 `DOCS_AUTH_HASH`，設定方式同 report：

```bash
caddy hash-password --plaintext '你的密碼'
echo 'DOCS_AUTH_HASH=貼上剛才的hash' | sudo tee -a /etc/caddy/caddy.env

export DOCS_AUTH_HASH=貼上剛才的hash   # 手動 validate 前先 export
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

同樣別忘了 Cloudflare 新增 `docs.garyhsieh-proj.com` A 記錄（灰色雲朵，僅限 DNS）。
