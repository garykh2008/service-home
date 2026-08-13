# service-home

VPS 服務導航頁 **home.garyhsieh-proj.com**，用 [Homepage](https://gethomepage.dev/)
建置。定位是「淺層服務入口大廳」：只做連結 + 狀態燈號，深度操作（效能監控、
Docker 容器操作、檔案管理）仍走 [VPS Dashboard](https://dashboard.garyhsieh-proj.com)。

## 結構

```
docker-compose.yml          # Homepage 容器（綁 127.0.0.1:3050，對外走 Caddy）
homepage-config/            # 掛載進容器的 /app/config，YAML 皆版控
  settings.yaml             #   標題、主題、群組排列
  services.yaml             #   服務卡片（href + siteMonitor 健康檢查）
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

## 修改設定

改完 `homepage-config/*.yaml` 後，Homepage 會自動重讀，多數情況不需重啟容器；
若沒生效再 `docker compose restart homepage`。
