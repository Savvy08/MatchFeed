// MatchFeed — Pure Vanilla JavaScript Application (Table Tennis & Football)

let currentSport = 'table-tennis';
let currentStatus = 'all';
let currentView = 'feed';
let previousView = 'feed';

let matches = [];
let favorites = JSON.parse(localStorage.getItem('matchfeed_favs') || '[]');
let refreshTimer = null;

let playerSearchTimer = null;
let currentPlayerId = null;
let currentPlayerName = '';
let currentPlayerPage = 0;
let playerMatchesDone = false;

// ─── Web Audio API Sound ──────────────────────────────────────────────────────
function playGoalSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Audio blocked or not supported
  }
}

// ─── Banner Helper ────────────────────────────────────────────────────────────
function showBanner(type, message, showRetry = false) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;

  const iconEl = banner.querySelector('.banner-icon');
  const messageEl = banner.querySelector('.banner-message');
  const retryBtn = document.getElementById('banner-retry-btn');

  banner.className = `banner banner-${type}`;

  if (iconEl) {
    if (type === 'error') {
      iconEl.innerHTML = '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    } else {
      iconEl.innerHTML = '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="16"></line></svg>';
    }
  }

  if (messageEl) messageEl.textContent = message;
  if (retryBtn) {
    retryBtn.style.display = showRetry ? 'inline-block' : 'none';
    retryBtn.onclick = () => fetchMatches();
  }
}

function hideBanner() {
  const banner = document.getElementById('error-banner');
  if (banner) banner.className = 'banner hidden';
}

// ─── View Management ──────────────────────────────────────────────────────────
function showView(viewName) {
  if (currentView !== viewName) {
    previousView = currentView;
  }
  currentView = viewName;

  document.querySelectorAll('.app-view').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`${viewName}-view`);
  if (target) target.classList.remove('hidden');

  // Update bottom navigation bar
  document.querySelectorAll('.bottom-bar .nav-item').forEach(b => b.classList.remove('active'));
  if (viewName === 'feed') {
    if (currentStatus === 'favorites') {
      document.getElementById('nav-favs-btn')?.classList.add('active');
    } else {
      document.getElementById('nav-matches-btn')?.classList.add('active');
    }
  } else if (viewName === 'player') {
    document.getElementById('nav-player-btn')?.classList.add('active');
  } else if (viewName === 'match') {
    document.getElementById('nav-matches-btn')?.classList.add('active');
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function showFavorites() {
  currentStatus = 'favorites';
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  document.querySelector('.pill[data-status="favorites"]')?.classList.add('active');
  showView('feed');
  renderMatches();
}

function openPlayerTab() {
  showView('player');
  if (!currentPlayerId) {
    const input = document.getElementById('player-search-input');
    if (input) input.focus();
  }
}

function goBackFromPlayer() {
  if (previousView === 'match') {
    showView('match');
  } else {
    showView('feed');
  }
}

// ─── Match Feed Fetching & Rendering ──────────────────────────────────────────
function formatMatchTime(m) {
  if (m.status === 'live') {
    return escapeHtml(m.time || 'LIVE');
  }
  if (m.startTimestamp) {
    const d = new Date(m.startTimestamp * 1000);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  return escapeHtml(m.time || '--:--');
}

// ─── Unified API Client with Fallback ─────────────────────────────────────────
async function apiGet(params) {
  const query = new URLSearchParams(params).toString();
  const url = `api.php?${query}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache'
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (fetchErr) {
    console.warn(`Fetch error for ${url}, trying XMLHttpRequest fallback:`, fetchErr);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.timeout = 10000;
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('Не удалось разобрать JSON ответа'));
          }
        } else {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = function() {
        const detail = (fetchErr && fetchErr.message) ? fetchErr.message : 'Сбой сети';
        reject(new Error(`Ошибка подключения к ${url}: ${detail}`));
      };
      xhr.ontimeout = function() {
        reject(new Error(`Превышено время ожидания ответа (${url})`));
      };
      xhr.send();
    });
  }
}

async function fetchMatches() {
  const refreshBtn = document.getElementById('refresh-btn');
  const refreshIcon = refreshBtn ? refreshBtn.querySelector('.icon-refresh') : null;
  const refreshText = refreshBtn ? refreshBtn.querySelector('.refresh-text') : null;

  if (refreshIcon) refreshIcon.classList.add('spinning');
  if (refreshText) refreshText.textContent = 'Обновление...';

  try {
    const data = await apiGet({ action: 'live', sport: currentSport });

    if (!data || data.success === false) {
      const msg = (data && data.error) ? data.error : 'Не удалось загрузить матчи';
      showBanner('error', msg, true);
      if (matches.length === 0) renderMatches();
      return;
    }

    if (data.success && Array.isArray(data.matches)) {
      matches = data.matches;
      if (data.warning) {
        showBanner('warning', data.warning, false);
      } else {
        hideBanner();
      }
      renderMatches();
    }
  } catch (err) {
    if (window.location.protocol === 'file:') {
      showBanner('error', 'Запустите локальный сервер (php -S localhost:8000). Запуск через file:// не поддерживает PHP', false);
    } else {
      showBanner('error', 'Ошибка подключения к серверу', true);
    }
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('spinning');
    if (refreshText) refreshText.textContent = 'Обновить';
  }
}

function toggleFavorite(id) {
  const index = favorites.indexOf(id);
  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(id);
    playGoalSound();
  }
  localStorage.setItem('matchfeed_favs', JSON.stringify(favorites));
  renderMatches();
}

function groupMatches(list) {
  const groups = {};
  list.forEach(m => {
    const key = `${m.country ? m.country + ': ' : ''}${m.tournament}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  return groups;
}

function renderMatches() {
  const container = document.getElementById('matches-container');
  if (!container) return;

  let filtered = matches;
  if (currentStatus === 'live') {
    filtered = matches.filter(m => m.status === 'live');
  } else if (currentStatus === 'finished') {
    filtered = matches.filter(m => m.status === 'finished');
  } else if (currentStatus === 'favorites') {
    filtered = matches.filter(m => favorites.includes(m.id));
  }

  const statusOrder = { 'live': 1, 'upcoming': 2, 'finished': 3 };
  filtered = [...filtered].sort((a, b) => {
    const orderA = statusOrder[a.status] || 99;
    const orderB = statusOrder[b.status] || 99;
    if (orderA !== orderB) return orderA - orderB;
    if (a.status === 'upcoming') {
      return (a.startTimestamp || 0) - (b.startTimestamp || 0);
    }
    // Новые матчи сверху, старые снизу
    return (b.startTimestamp || 0) - (a.startTimestamp || 0);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
        <div class="empty-state-title">Событий не найдено</div>
        <div class="empty-state-desc">Попробуйте сменить фильтр или переключить спорт.</div>
      </div>
    `;
    return;
  }

  const grouped = groupMatches(filtered);
  let html = '';

  for (const [league, items] of Object.entries(grouped)) {
    html += `
      <div class="league-group">
        <div class="league-header">${escapeHtml(league)}</div>
    `;

    items.forEach(m => {
      const isFav = favorites.includes(m.id);
      const isLive = m.status === 'live';
      const homeScore = m.homeTeam.score !== null && m.homeTeam.score !== undefined ? m.homeTeam.score : '-';
      const awayScore = m.awayTeam.score !== null && m.awayTeam.score !== undefined ? m.awayTeam.score : '-';
      const timeStr = formatMatchTime(m);

      const starIcon = isFav
        ? `<svg class="star-icon filled" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
        : `<svg class="star-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

      html += `
        <div class="match-row" onclick="openMatchDetail('${escapeHtml(m.id)}')" style="cursor: pointer;">
          <div class="match-time ${isLive ? 'live' : ''}">
            ${isLive ? '<span class="live-dot"></span>' : ''}
            <span>${timeStr}</span>
          </div>
          <div class="match-teams">
            <div class="team-line">
              <span>${escapeHtml(m.homeTeam.name)}</span>
              <span class="team-score">${homeScore}</span>
            </div>
            <div class="team-line">
              <span>${escapeHtml(m.awayTeam.name)}</span>
              <span class="team-score">${awayScore}</span>
            </div>
          </div>
          <button class="fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${escapeHtml(m.id)}')" aria-label="Избранное">
            ${starIcon}
          </button>
        </div>
      `;
    });

    html += '</div>';
  }

  container.innerHTML = html;
}

// ─── Match Detail View ────────────────────────────────────────────────────────
async function openMatchDetail(matchId) {
  showView('match');

  const titleEl = document.getElementById('match-view-header-title');
  const container = document.getElementById('match-details-container');
  if (titleEl) titleEl.textContent = 'Матч';
  if (container) container.innerHTML = '<div class="feed-loader">Загрузка данных матча...</div>';

  if (!matchId) {
    if (container) container.innerHTML = '<div class="player-empty-prompt"><div class="empty-state-title">ID матча не указан</div></div>';
    return;
  }

  try {
    const data = await apiGet({ action: 'match', id: matchId });

    if (!data || !data.success) {
      const errMsg = data?.error || 'Не удалось получить данные о матче';
      if (container) {
        container.innerHTML = `
          <div class="player-empty-prompt">
            <div class="empty-state-title">${escapeHtml(errMsg)}</div>
            <button class="load-more-btn" style="width:auto; display:inline-block; margin-top:14px;" onclick="openMatchDetail('${escapeHtml(matchId)}')">Повторить попытку</button>
          </div>
        `;
      }
      return;
    }

    if (titleEl) titleEl.textContent = data.tournament || 'Детали матча';

    const homeTeam = data.homeTeam || {};
    const awayTeam = data.awayTeam || {};
    const homeName = homeTeam.name || 'Игрок 1';
    const awayName = awayTeam.name || 'Игрок 2';
    const homeId = homeTeam.id || 0;
    const awayId = awayTeam.id || 0;
    const homeSets = homeTeam.sets !== null && homeTeam.sets !== undefined ? homeTeam.sets : '-';
    const awaySets = awayTeam.sets !== null && awayTeam.sets !== undefined ? awayTeam.sets : '-';
    const statusClass = data.isLive ? 'live' : 'finished';

    // Sets table rows
    let setsHeaders = '<th>Игрок</th>';
    let homeRow = `<td class="team-cell">${escapeHtml(homeName)}</td>`;
    let awayRow = `<td class="team-cell">${escapeHtml(awayName)}</td>`;

    const sets = Array.isArray(data.sets) ? data.sets : [];
    sets.forEach((s, idx) => {
      setsHeaders += `<th>Сет ${idx + 1}</th>`;
      const hp = s.home !== null && s.home !== undefined ? s.home : '-';
      const ap = s.away !== null && s.away !== undefined ? s.away : '-';
      const homeWon = s.homeWon === true;
      const awayWon = s.homeWon === false;

      homeRow += `<td class="set-score ${homeWon ? 'winner' : 'loser'}">${hp}</td>`;
      awayRow += `<td class="set-score ${awayWon ? 'winner' : 'loser'}">${ap}</td>`;
    });

    setsHeaders += '<th>Итог</th>';
    homeRow += `<td class="set-score" style="font-weight:800;">${homeSets}</td>`;
    awayRow += `<td class="set-score" style="font-weight:800;">${awaySets}</td>`;

    const setsTableHtml = sets.length > 0 ? `
      <div class="sets-table-box">
        <table class="sets-table">
          <thead><tr>${setsHeaders}</tr></thead>
          <tbody>
            <tr>${homeRow}</tr>
            <tr>${awayRow}</tr>
          </tbody>
        </table>
      </div>
    ` : '';

    const homeBtnHtml = homeId ? `
      <button class="player-link-btn" onclick="openPlayerProfile(${homeId}, '${escapeJs(homeName)}')">
        <div>
          <div>${escapeHtml(homeName)}</div>
          <span class="player-link-pill">Профиль игрока</span>
        </div>
      </button>
    ` : `<div style="font-size:14px; font-weight:600; padding:8px;">${escapeHtml(homeName)}</div>`;

    const awayBtnHtml = awayId ? `
      <button class="player-link-btn" onclick="openPlayerProfile(${awayId}, '${escapeJs(awayName)}')">
        <div>
          <div>${escapeHtml(awayName)}</div>
          <span class="player-link-pill">Профиль игрока</span>
        </div>
      </button>
    ` : `<div style="font-size:14px; font-weight:600; padding:8px;">${escapeHtml(awayName)}</div>`;

    const html = `
      <div class="match-detail-card">
        <div class="match-detail-header">
          <div class="match-tourn-title">${escapeHtml(data.tournament || 'Матч')} ${data.round ? '• ' + escapeHtml(data.round) : ''}</div>
          <div class="match-status-pill ${statusClass}">${escapeHtml(data.status || '—')}</div>
        </div>

        <div class="scoreboard-box">
          <div class="scoreboard-side">
            ${homeBtnHtml}
            <div class="scoreboard-score">${homeSets}</div>
          </div>

          <div class="scoreboard-colon">:</div>

          <div class="scoreboard-side">
            <div class="scoreboard-score">${awaySets}</div>
            ${awayBtnHtml}
          </div>
        </div>

        ${setsTableHtml}

        <div style="margin-top: 14px; text-align: center; font-size: 11px; color: #9CA3AF;">
          Дата: ${escapeHtml(data.date || '—')}
        </div>
      </div>
    `;

    if (container) container.innerHTML = html;
  } catch (err) {
    console.error('Match detail error:', err);
    if (container) {
      container.innerHTML = `
        <div class="player-empty-prompt">
          <div class="empty-state-title">Ошибка загрузки матча</div>
          <div class="empty-state-desc">${escapeHtml(err.message || 'Проверьте соединение с сервером')}</div>
          <button class="load-more-btn" style="width:auto; display:inline-block; margin-top:14px;" onclick="openMatchDetail('${escapeHtml(matchId)}')">Повторить попытку</button>
        </div>
      `;
    }
  }
}

// ─── Player Profile & History View ────────────────────────────────────────────
function onPlayerSearchInput(val) {
  clearTimeout(playerSearchTimer);
  const q = val.trim();
  const dropdown = document.getElementById('player-search-results');

  if (q.length < 2) {
    if (dropdown) dropdown.classList.add('hidden');
    return;
  }

  playerSearchTimer = setTimeout(async () => {
    try {
      const data = await apiGet({ action: 'search', q: q });
      if (!data || !data.success || !data.players || data.players.length === 0) {
        if (dropdown) {
          dropdown.innerHTML = '<div style="padding: 12px; text-align: center; color: #9CA3AF; font-size: 13px;">Ничего не найдено</div>';
          dropdown.classList.remove('hidden');
        }
        return;
      }

      let dHtml = '';
      data.players.slice(0, 8).forEach(p => {
        dHtml += `
          <button class="player-search-item" onclick="selectSearchedPlayer(${p.id}, '${escapeJs(p.name)}')">
            <div>
              <div class="search-item-name">${escapeHtml(p.name)}</div>
              <div class="search-item-meta">${escapeHtml(p.country || p.sport || '')}</div>
            </div>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9CA3AF" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        `;
      });

      if (dropdown) {
        dropdown.innerHTML = dHtml;
        dropdown.classList.remove('hidden');
      }
    } catch (e) {}
  }, 350);
}

function selectSearchedPlayer(id, name) {
  const dropdown = document.getElementById('player-search-results');
  if (dropdown) dropdown.classList.add('hidden');
  const input = document.getElementById('player-search-input');
  if (input) input.value = '';
  openPlayerProfile(id, name);
}

async function openPlayerProfile(playerId, playerName) {
  currentPlayerId = playerId;
  currentPlayerName = playerName;
  currentPlayerPage = 0;
  playerMatchesDone = false;

  showView('player');

  const titleEl = document.getElementById('player-view-header-title');
  const content = document.getElementById('player-view-content');
  if (titleEl) titleEl.textContent = playerName || 'Профиль игрока';
  if (content) content.innerHTML = '<div class="feed-loader">Загрузка профиля и статистики игрока...</div>';

  try {
    const data = await apiGet({ action: 'player', id: playerId, page: 0 });

    if (!data || !data.success) {
      if (content) {
        content.innerHTML = `
          <div class="player-empty-prompt">
            <div class="empty-state-title">Не удалось загрузить данные игрока</div>
            <div class="empty-state-desc">${escapeHtml(data?.error || '')}</div>
            <button class="load-more-btn" style="width:auto; display:inline-block; margin-top:14px;" onclick="openPlayerProfile(${playerId}, '${escapeJs(playerName)}')">Повторить попытку</button>
          </div>
        `;
      }
      return;
    }

    const prof = data.profile || { name: playerName };
    const stats = data.stats || { totalMatches: 0, wins: 0, losses: 0, winRate: 0, pointsWon: 0, pointsLost: 0 };
    const matchesList = data.matches || [];
    matchesList.sort((a, b) => (b.startTimestamp || 0) - (a.startTimestamp || 0));

    if (titleEl) titleEl.textContent = prof.name;

    const rankHtml = prof.ranking ? `<span class="player-rank-badge">Рейтинг #${prof.ranking}</span>` : '';
    const countryStr = prof.country ? escapeHtml(prof.country) : 'Настольный теннис';

    let html = `
      <div class="player-profile-card">
        <div class="player-profile-top">
          <div>
            <div class="player-title-name">${escapeHtml(prof.name)}</div>
            <div class="player-meta-info">
              <span>${countryStr}</span>
            </div>
          </div>
          ${rankHtml}
        </div>

        <!-- 4-Cell Stats Grid -->
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-val stat-total">${stats.totalMatches}</div>
            <div class="stat-lbl">Матчей</div>
          </div>
          <div class="stat-box">
            <div class="stat-val stat-wins">${stats.wins}</div>
            <div class="stat-lbl">Побед</div>
          </div>
          <div class="stat-box">
            <div class="stat-val stat-losses">${stats.losses}</div>
            <div class="stat-lbl">Пораж.</div>
          </div>
          <div class="stat-box">
            <div class="stat-val stat-rate">${stats.winRate}%</div>
            <div class="stat-lbl">Винрейт</div>
          </div>
        </div>

        <div class="points-summary-bar">
          <span>Очки в сетах:</span>
          <strong>${stats.pointsWon} : ${stats.pointsLost}</strong>
        </div>
      </div>

      <div class="section-heading">История матчей (счёт по сетам)</div>
      <div id="player-matches-container">
        ${renderPlayerMatchesList(matchesList)}
      </div>
    `;

    if (matchesList.length >= 30) {
      html += `<button id="player-load-more-btn" class="load-more-btn" onclick="loadMorePlayerMatches()">Загрузить ещё матчи</button>`;
    }

    if (content) content.innerHTML = html;
  } catch (err) {
    if (content) {
      content.innerHTML = `
        <div class="player-empty-prompt">
          <div class="empty-state-title">Ошибка загрузки профиля</div>
          <div class="empty-state-desc">${escapeHtml(err.message || 'Проверьте соединение с сервером')}</div>
          <button class="load-more-btn" style="width:auto; display:inline-block; margin-top:14px;" onclick="openPlayerProfile(${playerId}, '${escapeJs(playerName)}')">Повторить попытку</button>
        </div>
      `;
    }
  }
}

function renderPlayerMatchesList(list) {
  if (!list || list.length === 0) {
    return '<div class="player-empty-prompt"><div class="empty-state-desc">Нет истории матчей</div></div>';
  }

  let html = '';
  list.forEach(m => {
    const isWin = m.won === true;
    const cardClass = isWin ? 'win' : 'loss';
    const resText = isWin ? `Победа ${m.playerSets}:${m.opponentSets}` : `Поражение ${m.playerSets}:${m.opponentSets}`;
    const badgeClass = isWin ? 'badge-win' : 'badge-loss';

    // Set points chips (e.g. 11:7, 9:11, ...)
    let setsChips = '';
    (m.sets || []).forEach(s => {
      const chipWon = s.won === true;
      const chipClass = chipWon ? 'chip-win' : 'chip-loss';
      setsChips += `<span class="set-chip ${chipClass}">${s.player}:${s.opponent}</span>`;
    });

    html += `
      <div class="player-match-card ${cardClass}" onclick="openMatchDetail('${escapeHtml(m.id)}')">
        <div class="match-card-top">
          <div class="opp-name">vs ${escapeHtml(m.opponent.name)}</div>
          <div class="match-res-badge ${badgeClass}">${resText}</div>
        </div>

        <div class="sets-chips-row">
          ${setsChips || '<span style="font-size:11px; color:#9CA3AF;">Счёт по сетам не указан</span>'}
        </div>

        <div class="match-card-bottom">
          <div class="match-card-tourn">${escapeHtml(m.tournament)}</div>
          <div>${escapeHtml(m.date)}</div>
        </div>
      </div>
    `;
  });

  return html;
}

async function loadMorePlayerMatches() {
  if (!currentPlayerId || playerMatchesDone) return;
  currentPlayerPage++;

  const btn = document.getElementById('player-load-more-btn');
  if (btn) btn.textContent = 'Загрузка...';

  try {
    const data = await apiGet({ action: 'player', id: currentPlayerId, page: currentPlayerPage });

    if (!data || !data.success || !data.matches || data.matches.length === 0) {
      playerMatchesDone = true;
      if (btn) btn.style.display = 'none';
      return;
    }

    const container = document.getElementById('player-matches-container');
    if (container) {
      container.insertAdjacentHTML('beforeend', renderPlayerMatchesList(data.matches));
    }

    if (btn) {
      btn.textContent = 'Загрузить ещё матчи';
      if (data.matches.length < 30) {
        playerMatchesDone = true;
        btn.style.display = 'none';
      }
    }
  } catch (e) {
    if (btn) btn.textContent = 'Загрузить ещё матчи';
  }
}

// ─── Modal Functions ──────────────────────────────────────────────────────────
function openInfoModal() {
  const modal = document.getElementById('info-modal');
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeInfoModal() {
  const modal = document.getElementById('info-modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

function handleBackdropClick(event) {
  if (event.target === event.currentTarget) {
    closeInfoModal();
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJs(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}

// ─── Initial Setup on DOMContentLoaded ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Sport tabs
  document.querySelectorAll('.sport-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      document.querySelectorAll('.sport-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      currentSport = btn.dataset.sport;
      showView('feed');
      fetchMatches();
    });
  });

  // Status pills
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status;
      showView('feed');
      renderMatches();
    });
  });

  // Refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (currentView === 'feed') {
        fetchMatches();
      } else if (currentView === 'match') {
        const titleEl = document.getElementById('match-view-header-title');
        // reload current match
      } else if (currentView === 'player' && currentPlayerId) {
        openPlayerProfile(currentPlayerId, currentPlayerName);
      }
    });
  }

  // Escape key closes modal or goes back
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('info-modal');
      if (modal && modal.classList.contains('open')) {
        closeInfoModal();
      } else if (currentView !== 'feed') {
        showView('feed');
      }
    }
  });

  // Initial load
  fetchMatches();

  // Auto-refresh every 30s only on feed view
  refreshTimer = setInterval(() => {
    if (currentView === 'feed') {
      fetchMatches();
    }
  }, 30000);
});
