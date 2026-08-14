# TODO

擱著、之後再補的項目。

---

## 行事曆 widget（等自寫的行事曆 app 支援 ICS 後再接）

**現況**：Homepage 有原生 `calendar` widget，吃 iCal/ICS 訂閱網址。自寫的行事曆 app
目前**不支援 ICS 匯出**，所以先擱著。等 app 加好 ICS 端點，再回來接 widget。

### app 支援 ICS 後，接 widget 的步驟
1. app 端提供 ICS 端點（帶祕密 token），輸出 `Content-Type: text/calendar`。
2. `homepage-config/widgets.yaml` 加 calendar widget，URL 用 `{{HOMEPAGE_VAR_ICAL_URL}}` 佔位：
   ```yaml
   - calendar:
       firstDayInWeek: monday
       view: agenda
       maxEvents: 8
       integrations:
         - type: ical
           url: "{{HOMEPAGE_VAR_ICAL_URL}}"
           name: 個人
           color: blue
   ```
3. `docker-compose.yml` 讓 homepage 讀 `.env`（加 `env_file: - .env` 或
   `environment: HOMEPAGE_VAR_ICAL_URL: ${HOMEPAGE_VAR_ICAL_URL:-}`）；
   VPS 的 `.env`（gitignored）放 `HOMEPAGE_VAR_ICAL_URL=<你的ICS祕密網址>`。
   ⚠️ ICS 祕密網址 = 可讀你整本行事曆，**不能進 git**，一定走 env 注入。
4. `docker compose restart homepage`。

### 給 AI 加 ICS 匯出端點的 prompt（之後連同 app 程式碼一起貼給 AI）

```
你要在我現有的行事曆 app 加一個 iCalendar (ICS) 匯出端點。我會附上相關程式碼，請依此規格實作。

目標：新增一個唯讀 HTTP 端點，把事件輸出成符合 RFC 5545 的 iCalendar feed，
讓外部客戶端（Homepage 儀表板、Google 日曆、Apple 日曆、Outlook）能訂閱。

需求：
1. 端點：GET /calendar.ics（依我 app 的路由慣例調整）。
   回應標頭 Content-Type: text/calendar; charset=utf-8。
2. 存取控制：feed 會外洩事件內容，用不可猜的 token 保護，例如
   /calendar.ics?token=<random> 或 /calendar/<token>.ics；缺/錯 token 回 401/403。
   token 由設定檔或環境變數帶入，不要寫死。
3. 輸出單一 VCALENDAR，每個事件一個 VEVENT：
   - VCALENDAR：VERSION:2.0、PRODID:-//<app名>//TW、CALSCALE:GREGORIAN，
     可加 X-WR-CALNAME:<行事曆名稱>。
   - VEVENT：UID（穩定唯一、不隨時間變，用事件 DB id + 網域後綴，如 123@myapp）、
     DTSTAMP（UTC 現在時間，格式 YYYYMMDDTHHMMSSZ）、DTSTART、DTEND（或 DURATION）、
     SUMMARY（標題）。有的話補 DESCRIPTION、LOCATION、URL、LAST-MODIFIED。
4. 日期時間正確性（最關鍵）：
   - 定時事件：輸出 UTC（DTSTART:20260815T090000Z），把儲存時間轉成 UTC 最簡單安全；
     或用本地時間 + 明確 TZID 並附對應 VTIMEZONE 區塊。
   - 全天事件：用 DATE 型別 DTSTART;VALUE=DATE:20260815、DTEND;VALUE=DATE:20260816
     （DTEND 為隔天、不含）。
5. 文字跳脫（RFC 5545）：SUMMARY/DESCRIPTION/LOCATION 內，
   反斜線 \ → \\、逗號 , → \,、分號 ; → \;、換行 → \n；控制字元去除或跳脫。
6. 換行：行間用 CRLF（\r\n）。超過 75 octets 的行要做 line folding（續行以一個空格開頭）。
7. 週期事件：若 app 有支援重複，輸出 RRULE（例外用 EXDATE），不要展開成每一筆；
   沒有就略過。
8. 範圍/效能：預設輸出「過去約 30 天 ~ 未來約 1 年」的事件（可設定），別倒整本歷史。
9. 快取：可即時計算，但設短快取標頭（Cache-Control: max-age=300）。
10. 即使 0 筆事件也要回一個合法（無 VEVENT 的）VCALENDAR。

交付：
- 依我 app 技術棧與慣例實作的端點/路由。
- 一個把「事件物件 → VEVENT」的序列化 helper（含正確跳脫與日期格式）。
- token 的設定方式。
- 一份原始 ICS 範例輸出（含 1 個定時事件 + 1 個全天事件）讓我目視檢查。

請用 icalendar.org 之類的驗證器或用日曆客戶端訂閱來驗證輸出，
並說明你對我資料模型做了哪些假設。
```

**接回 Homepage 時**：把上面「接 widget 的步驟」做完即可。也可以叫我來接。
