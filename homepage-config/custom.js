// 時區辨識：顯示「家時區」時間，只有當瀏覽器時區與家不同時才出現。
// 主時鐘（頁首 datetime widget）已顯示你當下所在地的時間；此處補上家時間。
// Homepage 會自動載入 config 目錄下的 custom.js。
(function () {
  const HOME_TZ = 'Asia/Taipei'; // ← 家時區，可改
  const HOME_LABEL = '🏠 台北'; // ← 標籤文字，可改

  // 取某時區當下的 HH:MM（24 小時制）
  const hhmm = (tz) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());

  function render() {
    // 家的牆鐘時間與本地相同 = 同一時區（含同偏移的其他時區），不顯示
    const abroad = hhmm(HOME_TZ) !== hhmm(undefined);
    let el = document.getElementById('home-tz-chip');

    if (!abroad) {
      if (el) el.remove();
      return;
    }

    if (!el) {
      el = document.createElement('div');
      el.id = 'home-tz-chip';
      document.body.appendChild(el); // 掛在 body 末端，位於頁面最後
    }

    const full = new Intl.DateTimeFormat('zh-TW', {
      timeZone: HOME_TZ,
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());

    let vtz = '';
    try {
      vtz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {}

    el.textContent = `${HOME_LABEL}　${full}`;
    el.title = vtz ? `你目前時區：${vtz}` : '';
  }

  render();
  setInterval(render, 15000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });
})();
