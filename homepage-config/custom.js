// 頁首補當前城市；底部加一排資訊卡：匯率 / 世界時鐘 / 多日預報 / Hacker News。
// Homepage 會自動載入 config 目錄下的 custom.js。
//
// ── 個人設定：改這裡就好 ─────────────────────────────
const GREETING_TEXT = '哈囉，Gary 👋'; // 與 widgets.yaml 的 greeting 一致
const SHOW_CURRENT_CITY = true; // 問候語後補當前城市
const CITY_LANG = 'en'; // 'en'=英文（Sunnyvale）、'zh'=中文（森尼韋爾）

// 世界時鐘（依序顯示）；設 home:true 者附上天氣
const CITIES = [
  { label: 'SF', tz: 'America/Los_Angeles' },
  { label: '新竹', tz: 'Asia/Taipei', lat: 24.791977, lon: 121.015696, home: true },
];
const EXCHANGE = { from: 'USD', to: 'TWD' }; // 匯率
const FORECAST_DAYS = 3; // 多日預報天數（所在地）

// 新聞來源（每個一張卡）；type: 'hn'=Hacker News、'rss'=任意 RSS（經 rss2json 代理）
const NEWS = [
  { title: 'Hacker News', type: 'hn', count: 4 },
  { title: '中央社科技', type: 'rss', url: 'https://feeds.feedburner.com/rsscna/technology', count: 4 },
  { title: 'The Verge', type: 'rss', url: 'https://www.theverge.com/rss/index.xml', count: 4 },
];

// 監控概覽 / 服務延遲：讀 Uptime Kuma 狀態頁。
// 走 home 的同源代理 /kuma（home.caddy 需有 handle_path /kuma/*），避免 CORS。
const KUMA_BASE = '/kuma';
const KUMA_SLUG = 'home';

// 倒數（可多筆）；date 用當地時間 ISO 字串
const COUNTDOWNS = [
  { label: '（範例，改成你的）', date: '2026-12-24T18:00:00' },
];
// ─────────────────────────────────────────────────────

const LOCALE = CITY_LANG === 'zh' ? 'zh-TW' : 'en-US';

function wmoEmoji(code) {
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 57) return '🌦️';
  if (code >= 61 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '🌨️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 85 && code <= 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '';
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

const timeInTz = (tz) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());

async function currentWeather(lat, lon) {
  const d = await fetchJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
  );
  return { temp: Math.round(d.current.temperature_2m), emoji: wmoEmoji(d.current.weather_code) };
}

// IP 定位（免權限視窗，較粗略）；主 ipwho.is，退回 geojs
async function ipLocate() {
  try {
    const j = await fetchJSON('https://ipwho.is/');
    if (j && j.success !== false && j.latitude != null) return { lat: j.latitude, lon: j.longitude };
  } catch (e) {}
  try {
    const j = await fetchJSON('https://get.geojs.io/v1/ip/geo.json');
    if (j && j.latitude != null) return { lat: parseFloat(j.latitude), lon: parseFloat(j.longitude) };
  } catch (e) {}
  return null;
}

// 定位：瀏覽器定位優先（精準，已授權則不跳窗），失敗退回 IP
async function locate() {
  if (navigator.geolocation) {
    try {
      const c = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition((p) => res(p.coords), rej, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 600000,
        })
      );
      return { lat: c.latitude, lon: c.longitude };
    } catch (e) {}
  }
  return ipLocate();
}

async function reverseCity(lat, lon) {
  const d = await fetchJSON(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${CITY_LANG}`
  );
  // locality 較精細（如 Sunnyvale），優先於 city（如 San Jose）
  return d.locality || d.city || d.principalSubdivision || '';
}

let currentCity = null;

// 把「· 📍城市」補到問候語後面
function appendCityToGreeting(city) {
  if (!city) return;
  const nodes = document.querySelectorAll('div, span, p, h1, h2, h3');
  for (const n of nodes) {
    if (n.childElementCount === 0 && n.textContent.trim() === GREETING_TEXT) {
      if (n.querySelector('.here-city')) return;
      const span = document.createElement('span');
      span.className = 'here-city';
      span.textContent = `　·　📍${city}`;
      n.appendChild(span);
      return;
    }
  }
}

// ── 底部資訊卡 ────────────────────────────────────────
// 插在 #footer 之前：footer 一直都在、與分頁無關，所以底部卡片切到任何分頁都常駐，
// 也不會被 min-h-screen 推到頁尾留大縫。
function ensureExtras() {
  const footer = document.getElementById('footer');
  const fallback = document.getElementById('bookmarks') || document.getElementById('layout-groups');
  let root = document.getElementById('extra-widgets');
  if (!root) {
    root = document.createElement('div');
    root.id = 'extra-widgets';
    const newsCards = NEWS.map(
      (n, i) =>
        `<div class="xw-card"><div class="xw-title">${n.title}</div><div class="xw-body xw-news" id="xw-news-${i}">…</div></div>`
    ).join('');
    root.innerHTML = `
      <div class="xw-status" id="xw-status">監控概覽讀取中…</div>
      <div class="xw-card"><div class="xw-title">匯率</div><div class="xw-body" id="xw-exchange">…</div></div>
      <div class="xw-card"><div class="xw-title">世界時鐘</div><div class="xw-body" id="xw-clocks"></div></div>
      <div class="xw-card"><div class="xw-title">${FORECAST_DAYS} 日預報</div><div class="xw-body" id="xw-forecast">…</div></div>
      <div class="xw-card"><div class="xw-title">服務延遲</div><div class="xw-body" id="xw-latency">…</div></div>
      <div class="xw-card"><div class="xw-title">便條</div><textarea id="xw-notes-input" class="xw-notes" placeholder="隨手記…"></textarea></div>
      <div class="xw-card"><div class="xw-title">倒數</div><div class="xw-body" id="xw-countdown">…</div></div>
      ${newsCards}`;
  }
  if (footer && footer.parentNode) {
    if (footer.previousElementSibling !== root) footer.parentNode.insertBefore(root, footer);
  } else if (fallback) {
    if (fallback.nextSibling !== root) fallback.parentNode.insertBefore(root, fallback.nextSibling);
  } else if (!root.parentElement) {
    document.body.appendChild(root); // 保底
  }
  return root;
}

function renderClocks(homeWeather) {
  const box = document.getElementById('xw-clocks');
  if (!box) return;
  box.innerHTML = CITIES.map((c) => {
    const w = c.home && homeWeather ? `　${homeWeather.emoji} ${homeWeather.temp}°` : '';
    return `<div class="xw-row"><span>${c.label}${c.home ? ' 🏠' : ''}</span><span>${timeInTz(c.tz)}${w}</span></div>`;
  }).join('');
}

async function renderExchange() {
  const box = document.getElementById('xw-exchange');
  if (!box) return;
  try {
    const j = await fetchJSON(`https://open.er-api.com/v6/latest/${EXCHANGE.from}`);
    const rate = j.rates[EXCHANGE.to];
    box.innerHTML = `<div class="xw-big">1 ${EXCHANGE.from} = ${rate.toFixed(2)} ${EXCHANGE.to}</div>`;
  } catch (e) {
    box.textContent = '—';
  }
}

async function renderForecast(coords) {
  const box = document.getElementById('xw-forecast');
  if (!box || !coords) return;
  try {
    const d = await fetchJSON(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=${FORECAST_DAYS}`
    );
    box.innerHTML = d.daily.time
      .map((day, i) => {
        const dow = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }).format(new Date(day + 'T00:00'));
        const lo = Math.round(d.daily.temperature_2m_min[i]);
        const hi = Math.round(d.daily.temperature_2m_max[i]);
        return `<div class="xw-row"><span>${wmoEmoji(d.daily.weather_code[i])} ${dow}</span><span>${lo}° / ${hi}°</span></div>`;
      })
      .join('');
  } catch (e) {
    box.textContent = '—';
  }
}

async function renderNewsSource(i) {
  const box = document.getElementById(`xw-news-${i}`);
  if (!box) return;
  const src = NEWS[i];
  try {
    let items;
    if (src.type === 'hn') {
      const ids = await fetchJSON('https://hacker-news.firebaseio.com/v0/topstories.json');
      const raw = await Promise.all(
        ids.slice(0, src.count).map((id) => fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`))
      );
      items = raw.map((it) => ({ title: it.title, url: it.url || `https://news.ycombinator.com/item?id=${it.id}` }));
    } else {
      // 任意 RSS 經 rss2json 代理轉 JSON
      const j = await fetchJSON('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(src.url));
      items = (j.items || []).slice(0, src.count).map((it) => ({ title: it.title, url: it.link }));
    }
    box.innerHTML = items
      .map((it) => {
        const title = (it.title || '').replace(/"/g, '&quot;');
        return `<a href="${it.url}" target="_blank" rel="noopener" title="${title}">• ${it.title}</a>`;
      })
      .join('');
  } catch (e) {
    box.textContent = '—';
  }
}

function renderAllNews() {
  NEWS.forEach((_, i) => renderNewsSource(i));
}

// 監控概覽 + 服務延遲（讀 Uptime Kuma 狀態頁，經 /kuma 同源代理）
async function renderKuma() {
  const summary = document.getElementById('xw-status');
  const latBox = document.getElementById('xw-latency');
  try {
    const [page, hb] = await Promise.all([
      fetchJSON(`${KUMA_BASE}/api/status-page/${KUMA_SLUG}`),
      fetchJSON(`${KUMA_BASE}/api/status-page/heartbeat/${KUMA_SLUG}`),
    ]);
    const names = {};
    (page.publicGroupList || []).forEach((g) =>
      (g.monitorList || []).forEach((m) => (names[m.id] = m.name))
    );
    let up = 0, down = 0;
    const downNames = [];
    const lat = [];
    Object.keys(hb.heartbeatList || {}).forEach((id) => {
      const beats = hb.heartbeatList[id];
      const last = beats && beats[beats.length - 1];
      if (!last) return;
      if (last.status === 1) up++;
      else { down++; downNames.push(names[id] || id); }
      if (last.ping != null) lat.push({ name: names[id] || id, ping: last.ping });
    });
    const total = up + down;
    if (summary) {
      const ok = down === 0;
      const avg = lat.length ? Math.round(lat.reduce((a, b) => a + b.ping, 0) / lat.length) : null;
      summary.className = 'xw-status ' + (ok ? 'ok' : 'bad');
      summary.textContent = ok
        ? `🟢 全部服務正常　·　${up}/${total}${avg != null ? `　·　平均 ${avg}ms` : ''}`
        : `🔴 ${down} 項異常：${downNames.join('、')}　·　${up}/${total} 正常`;
    }
    if (latBox) {
      lat.sort((a, b) => b.ping - a.ping);
      latBox.innerHTML = lat
        .map((x) => `<div class="xw-row"><span>${x.name}</span><span>${x.ping}ms</span></div>`)
        .join('') || '—';
    }
  } catch (e) {
    if (summary) { summary.className = 'xw-status'; summary.textContent = '監控概覽：讀不到（需 home.caddy 的 /kuma 代理已部署）'; }
    if (latBox) latBox.textContent = '—';
  }
}

// 便條：存 localStorage
function initNotes() {
  const ta = document.getElementById('xw-notes-input');
  if (!ta || ta.dataset.bound) return;
  ta.value = localStorage.getItem('xw-notes') || '';
  ta.addEventListener('input', () => localStorage.setItem('xw-notes', ta.value));
  ta.dataset.bound = '1';
}

// 倒數
function renderCountdown() {
  const box = document.getElementById('xw-countdown');
  if (!box) return;
  const now = Date.now();
  box.innerHTML = COUNTDOWNS.map((c) => {
    const t = new Date(c.date).getTime();
    let txt;
    if (isNaN(t)) txt = '?';
    else {
      const diff = t - now;
      if (diff <= 0) txt = '已到';
      else {
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        txt = d > 0 ? `${d} 天 ${h} 時` : `${h} 時 ${m} 分`;
      }
    }
    return `<div class="xw-row"><span>${c.label}</span><span>${txt}</span></div>`;
  }).join('');
}

async function init() {
  ensureExtras();

  // 定位一次，供當前城市與多日預報共用
  let coords = null;
  try {
    coords = await locate();
  } catch (e) {}
  if (coords && SHOW_CURRENT_CITY) {
    try {
      currentCity = await reverseCity(coords.lat, coords.lon);
      appendCityToGreeting(currentCity);
    } catch (e) {}
  }

  // 家天氣（給世界時鐘卡）
  const home = CITIES.find((c) => c.home);
  let homeWeather = null;
  const refreshHomeWeather = async () => {
    if (!home || home.lat == null) return;
    try {
      homeWeather = await currentWeather(home.lat, home.lon);
      renderClocks(homeWeather);
    } catch (e) {}
  };

  renderClocks(null);
  refreshHomeWeather();
  renderExchange();
  renderForecast(coords);
  renderAllNews();
  renderKuma();
  initNotes();
  renderCountdown();

  // 定時更新（順便確保底部卡片還在；被 React 移除就重建並補資料）
  setInterval(() => {
    if (!document.getElementById('extra-widgets')) {
      ensureExtras();
      renderExchange();
      renderForecast(coords);
      renderAllNews();
      renderKuma();
      initNotes();
      renderCountdown();
    } else {
      ensureExtras(); // 只是被搬走的話搬回
      initNotes();
    }
    renderClocks(homeWeather);
    if (currentCity) appendCityToGreeting(currentCity);
  }, 30000);
  setInterval(refreshHomeWeather, 900000); // 家天氣 15 分
  setInterval(renderExchange, 3600000); // 匯率 1 小時
  setInterval(renderAllNews, 1800000); // 新聞 30 分
  setInterval(renderKuma, 60000); // 監控概覽 1 分
  setInterval(renderCountdown, 60000); // 倒數 1 分
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderClocks(homeWeather);
  });
}

// Homepage 是 SPA，稍等 DOM 生成後再跑
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
} else {
  setTimeout(init, 500);
}
