#!/usr/bin/env bash
#
# 把 mangan-log（D:\code\mangan-log）build 成靜態檔並佈署到 VPS /srv/mangan-log。
# 取代原本的 Coolify 部署。在 Windows Git Bash 或 Linux 皆可跑。
#
# 前置：
#   1. D:\code\mangan-log\.env.production 內含
#        VITE_SUPABASE_URL=https://supabase.garyhsieh-proj.com
#        VITE_SUPABASE_ANON_KEY=<anon key>
#      （Vite 於 production build 會自動載入 .env.production）
#   2. 首次部署後，在 VPS 放好 sites/mangan-log.caddy 並 reload Caddy。
#
# 用法：
#   VPS=root@你的VPS bash scripts/deploy-mangan-log.sh
#
set -euo pipefail

# ── 設定（可用環境變數覆寫）──────────────────────────
VPS="${VPS:-root@YOUR_VPS_HOST}"                 # ← 改成你連 VPS 的 ssh 目標
REMOTE_DIR="${REMOTE_DIR:-/srv/mangan-log}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../mangan-log" && pwd)}"
# ─────────────────────────────────────────────────────

if [[ "$VPS" == "root@YOUR_VPS_HOST" ]]; then
	echo "✗ 請先設定 VPS，例如：VPS=root@1.2.3.4 bash scripts/deploy-mangan-log.sh" >&2
	exit 1
fi

echo "▶ 專案目錄：$PROJECT_DIR"
cd "$PROJECT_DIR"

if [[ ! -f .env.production ]]; then
	echo "✗ 找不到 $PROJECT_DIR/.env.production（需含 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）" >&2
	exit 1
fi

echo "▶ 安裝相依並 build"
# 優先用 npm ci（可重現）；lock 與 package.json 漂移時退回 npm install
if ! npm ci; then
	echo "⚠ npm ci 失敗（lock 不同步），改用 npm install（會更新 package-lock.json，記得 commit）" >&2
	npm install
fi
npm run build

echo "▶ 佈署 dist/ → $VPS:$REMOTE_DIR"
ssh "$VPS" "mkdir -p '$REMOTE_DIR' && rm -rf '$REMOTE_DIR'/*"
scp -r dist/* "$VPS:$REMOTE_DIR/"

echo "✔ 完成。首次部署別忘了在 VPS：caddy validate → systemctl reload caddy"
