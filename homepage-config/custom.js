// 時區/地點輔助：頁首補「當前城市」，底部顯示「家」的時間＋天氣。
// Homepage 會自動載入 config 目錄下的 custom.js。
//
// ── 個人設定：改這裡就好 ─────────────────────────────
const HOME = {
  label: '新竹', // 家的顯示名稱
  tz: 'Asia/Taipei', // 家時區
  latitude: 24.791977, // 家緯度
  longitude: 121.015696, // 家經度
  showWhenLocal: false, // false=只有跨時區才顯示家資訊；true=在家時也顯示
};
// 與 widgets.yaml 的 greeting 文字一致，用來定位並在後面補上當前城市
const GREETING_TEXT = '哈囉，Gary 👋';
// 反查當前城市名（會把座標送到 BigDataCloud）。設 false 可完全關閉此功能。
const SHOW_CURRENT_CITY = true;
// ─────────────────────────────────────────────────────

// WMO 天氣代碼 → emoji
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

const hhmm = (tz) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());

const homeTimeText = () =>
  new Intl.DateTimeFormat('zh-TW', {
    timeZone: HOME.tz,
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      reject,
      { maximumAge: 600000, timeout: 8000 }
    );
  });
}

async function currentWeather(lat, lon) {
  const data = await fetchJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
  );
  return {
    temp: Math.round(data.current.temperature_2m),
    emoji: wmoEmoji(data.current.weather_code),
  };
}

async function reverseCity(lat, lon) {
  const d = await fetchJSON(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`
  );
  return d.city || d.locality || d.principalSubdivision || '';
}

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

let homeWeatherCache = null; // { temp, emoji }

function renderHomeChip() {
  const abroad = hhmm(HOME.tz) !== hhmm(undefined);
  let el = document.getElementById('home-tz-chip');

  if (!abroad && !HOME.showWhenLocal) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'home-tz-chip';
    document.body.appendChild(el);
  }
  const w = homeWeatherCache
    ? `　·　${homeWeatherCache.emoji} ${homeWeatherCache.temp}°`
    : '';
  el.textContent = `🏠 ${HOME.label}　${homeTimeText()}${w}`;
}

async function init() {
  renderHomeChip();

  // 家的天氣（每 15 分鐘更新）
  const refreshHomeWeather = async () => {
    try {
      homeWeatherCache = await currentWeather(HOME.latitude, HOME.longitude);
      renderHomeChip();
    } catch (e) {}
  };
  refreshHomeWeather();
  setInterval(refreshHomeWeather, 900000);

  // 家時間每 15 秒更新
  setInterval(renderHomeChip, 15000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderHomeChip();
  });

  // 當前城市名
  if (SHOW_CURRENT_CITY) {
    try {
      const c = await getPosition();
      const city = await reverseCity(c.latitude, c.longitude);
      appendCityToGreeting(city);
    } catch (e) {}
  }
}

// Homepage 是 SPA，稍等 DOM 生成後再跑
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
} else {
  setTimeout(init, 500);
}
