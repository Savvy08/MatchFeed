// MatchFeed - Pure Vanilla JavaScript Application (Table Tennis & Football)

let currentSport = 'table-tennis';
let currentStatus = 'all';
let currentView = 'feed';
let previousView = 'feed';

let matches = [];
let favorites = JSON.parse(localStorage.getItem('matchfeed_favs') || '[]').map(String);
let favoriteMatches = JSON.parse(localStorage.getItem('matchfeed_fav_matches') || '{}');
let favoritePlayers = JSON.parse(localStorage.getItem('matchfeed_fav_players') || '{}');
let favSubTab = 'matches'; // 'matches' | 'players'
let currentMatchData = null;
let currentMatchTab = 'overview';
let currentPlayerProfile = null;
let refreshTimer = null;

let playerSearchTimer = null;
let currentPlayerId = null;
let currentPlayerName = '';
let currentPlayerPage = 0;
let playerMatchesDone = false;
let currentPlayerData = null;
let currentPlayerTab = 'overview';
let playerMatchesFilter = 'all';

// Dark mode
function initDarkMode() {
  const isDark = localStorage.getItem('matchfeed_dark') === '1';
  if (isDark) applyDark(true);
}

function toggleDarkMode() {
  const isDark = document.body.classList.contains('dark-mode');
  applyDark(!isDark);
  localStorage.setItem('matchfeed_dark', isDark ? '0' : '1');
}

function applyDark(on) {
  document.body.classList.toggle('dark-mode', on);
  const moon = document.getElementById('theme-icon-moon');
  const sun = document.getElementById('theme-icon-sun');
  if (moon) moon.style.display = on ? 'none' : '';
  if (sun) sun.style.display = on ? '' : 'none';
}

// Web audio, api sound
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

// Banner helper
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

// View management
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

function openMatchesFeed() {
  currentStatus = 'all';
  document.querySelectorAll('.pill').forEach(p => {
    p.classList.toggle('active', p.dataset.status === 'all');
  });
  showView('feed');
  renderMatches();
}

function showFavorites() {
  currentStatus = 'favorites';
  document.querySelectorAll('.pill').forEach(p => {
    p.classList.toggle('active', p.dataset.status === 'favorites');
  });
  showView('feed');
  renderMatches();
}

function openPlayerTab() {
  showView('player');
  resetPlayerViewToSearch();
}

function resetPlayerViewToSearch() {
  currentPlayerId = null;
  currentPlayerName = '';
  currentPlayerProfile = null;
  updatePlayerHeaderFavBtn(null);
  const titleEl = document.getElementById('player-view-header-title');
  if (titleEl) titleEl.textContent = 'Поиск игрока';
  const content = document.getElementById('player-view-content');
  if (content) {
    const favPlayerList = Object.values(favoritePlayers);
    let favSection = '';
    if (favPlayerList.length > 0) {
      favSection = `
        <div class="section-heading" style="display:flex;align-items:center;justify-content:space-between;padding-top:16px;">
          <span>Избранные игроки (${favPlayerList.length})</span>
        </div>
        <div class="fav-players-list">
          ${favPlayerList.map(p => {
            const isFoot = p.sport === 'football';
            const badge = isFoot
              ? '<span class="sport-badge football">Футбол</span>'
              : '<span class="sport-badge table-tennis">Н. теннис</span>';
            return `
              <div class="fav-player-card" onclick="openPlayerProfile(${p.id}, '${escapeJs(p.name)}')">
                <div class="fav-player-info">
                  <img src="api.php?action=image&id=${p.id}" class="fav-player-avatar" alt="" onerror="this.style.opacity='0.2'">
                  <div class="fav-player-details">
                    <div class="fav-player-name">${escapeHtml(p.name)}</div>
                    <div class="fav-player-meta">
                      ${badge}
                      ${p.ranking ? `<span>#${p.ranking}</span>` : ''}
                      ${p.country ? `<span>${escapeHtml(p.country)}</span>` : ''}
                    </div>
                  </div>
                </div>
                <button class="fav-btn active" onclick="event.stopPropagation(); togglePlayerFavorite({ id: ${p.id} })" aria-label="Удалить из избранного" title="Удалить из избранного">
                  <svg class="star-icon filled" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
    content.innerHTML = `
      ${favSection}
      <div class="player-empty-prompt" style="${favPlayerList.length > 0 ? 'padding-top: 20px;' : ''}">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
        <div class="empty-state-title">Поиск игрока</div>
        <div class="empty-state-desc">Введите имя игрока или название команды в строке поиска.</div>
      </div>
    `;
  }
  const input = document.getElementById('player-search-input');
  if (input) {
    input.value = '';
    input.focus();
  }
}

function goBackFromPlayer() {
  if (currentPlayerId && previousView !== 'match') {
    resetPlayerViewToSearch();
  } else if (previousView === 'match') {
    showView('match');
  } else {
    openMatchesFeed();
  }
}

// Match feed fetching & rendering
function formatMatchTime(m) {
  if (m.status === 'live') {
    return `<span>${escapeHtml(m.time || 'LIVE')}</span>`;
  }
  if (m.status === 'finished') {
    const t = m.time || 'Завершён';
    if (t.includes(', ')) {
      const parts = t.split(', ');
      return `<span class="time-date">${escapeHtml(parts[0])}</span><span class="time-hour">${escapeHtml(parts[1])}</span>`;
    }
    return `<span>${escapeHtml(t)}</span>`;
  }
  if (m.startTimestamp) {
    const d = new Date(m.startTimestamp * 1000);
    const now = new Date();
    const isDifferentDay = d.getDate() !== now.getDate() || d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    if (isDifferentDay) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `<span class="time-date">${day}.${month}</span><span class="time-hour">${hours}:${minutes}</span>`;
    }
    return `<span>${hours}:${minutes}</span>`;
  }
  return `<span>${escapeHtml(m.time || '--:--')}</span>`;
}

// Unified API client with fallback
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
      // Sync fresh data for favorite matches currently in live feed
      let favUpdated = false;
      matches.forEach(m => {
        const sid = String(m.id);
        if (favorites.includes(sid)) {
          favoriteMatches[sid] = {
            id: m.id,
            tournament: m.tournament || '',
            country: m.country || '',
            homeTeam: { id: m.homeTeam?.id, name: m.homeTeam?.name, score: m.homeTeam?.score },
            awayTeam: { id: m.awayTeam?.id, name: m.awayTeam?.name, score: m.awayTeam?.score },
            status: m.status || 'live',
            time: m.time || '',
            startTimestamp: m.startTimestamp || Math.floor(Date.now() / 1000),
            sport: m.sport || currentSport
          };
          favUpdated = true;
        }
      });
      if (favUpdated) {
        localStorage.setItem('matchfeed_fav_matches', JSON.stringify(favoriteMatches));
      }
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

function isFavoriteMatch(id) {
  return favorites.includes(String(id));
}

function isPlayerFavorite(id) {
  return !!favoritePlayers[String(id)];
}

function updateMatchHeaderFavBtn(id) {
  const isFav = isFavoriteMatch(id);
  const btns = [
    document.getElementById('match-card-fav-btn'),
    document.getElementById('match-header-fav-btn')
  ].filter(Boolean);
  btns.forEach(btn => {
    btn.classList.toggle('active', isFav);
    btn.innerHTML = isFav
      ? `<svg class="star-icon filled" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
      : `<svg class="star-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
  });
}

function updatePlayerHeaderFavBtn(id) {
  const btn = document.getElementById('player-header-fav-btn');
  if (!btn) return;
  if (!id) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'flex';
  const isFav = isPlayerFavorite(id);
  btn.classList.toggle('active', isFav);
  btn.innerHTML = isFav
    ? `<svg class="star-icon filled" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
    : `<svg class="star-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
}

function toggleFavorite(id, matchData = null) {
  id = String(id);
  const index = favorites.indexOf(id);
  if (index > -1) {
    favorites.splice(index, 1);
    delete favoriteMatches[id];
  } else {
    favorites.push(id);
    const m = matchData || matches.find(item => String(item.id) === id) || (currentMatchData && String(currentMatchData.id) === id ? currentMatchData : null);
    if (m) {
      favoriteMatches[id] = {
        id: m.id,
        tournament: m.tournament || '',
        country: m.country || '',
        homeTeam: { id: m.homeTeam?.id, name: m.homeTeam?.name, score: m.homeTeam?.score },
        awayTeam: { id: m.awayTeam?.id, name: m.awayTeam?.name, score: m.awayTeam?.score },
        status: m.status || 'live',
        time: m.time || '',
        startTimestamp: m.startTimestamp || Math.floor(Date.now() / 1000),
        sport: m.sport || currentSport
      };
    }
    playGoalSound();
  }
  localStorage.setItem('matchfeed_favs', JSON.stringify(favorites));
  localStorage.setItem('matchfeed_fav_matches', JSON.stringify(favoriteMatches));
  updateMatchHeaderFavBtn(id);
  if (currentView === 'feed') {
    renderMatches();
  }
}

function toggleCurrentMatchFavorite() {
  if (currentMatchData && currentMatchData.id) {
    toggleFavorite(currentMatchData.id, currentMatchData);
  }
}

function togglePlayerFavorite(player) {
  if (!player || !player.id) return;
  const id = String(player.id);
  if (favoritePlayers[id]) {
    delete favoritePlayers[id];
  } else {
    favoritePlayers[id] = {
      id: player.id,
      name: player.name || 'Игрок',
      ranking: player.ranking || null,
      country: player.country || '',
      sport: player.sport || currentSport,
      addedAt: Date.now()
    };
    playGoalSound();
  }
  localStorage.setItem('matchfeed_fav_players', JSON.stringify(favoritePlayers));
  updatePlayerHeaderFavBtn(id);
  const cardBtn = document.getElementById('player-profile-fav-btn');
  if (cardBtn) {
    const isFav = isPlayerFavorite(id);
    cardBtn.classList.toggle('active', isFav);
    cardBtn.innerHTML = isFav
      ? `<svg class="star-icon filled" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
      : `<svg class="star-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
  }
  if (currentView === 'feed' && currentStatus === 'favorites') {
    renderMatches();
  } else if (currentView === 'player' && !currentPlayerId) {
    resetPlayerViewToSearch();
  }
}

function toggleCurrentPlayerFavorite() {
  if (currentPlayerProfile && currentPlayerProfile.id) {
    togglePlayerFavorite(currentPlayerProfile);
  } else if (currentPlayerId) {
    togglePlayerFavorite({ id: currentPlayerId, name: currentPlayerName });
  }
}

function setFavSubTab(tab) {
  favSubTab = tab;
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

  if (currentStatus === 'favorites') {
    const favPlayerList = Object.values(favoritePlayers);
    const subtabsHtml = `
      <div class="fav-segmented-box">
        <div class="fav-segmented-control">
          <button class="fav-segmented-btn ${favSubTab === 'matches' ? 'active' : ''}" onclick="setFavSubTab('matches')">
            <span>Матчи</span>
            <span class="fav-badge-count">${favorites.length}</span>
          </button>
          <button class="fav-segmented-btn ${favSubTab === 'players' ? 'active' : ''}" onclick="setFavSubTab('players')">
            <span>Игроки</span>
            <span class="fav-badge-count">${favPlayerList.length}</span>
          </button>
        </div>
      </div>
    `;

    if (favSubTab === 'players') {
      if (favPlayerList.length === 0) {
        container.innerHTML = subtabsHtml + `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <div class="empty-state-title">В избранном пока нет игроков</div>
            <div class="empty-state-desc">Откройте профиль любого игрока и нажмите звёздочку, чтобы добавить его сюда.</div>
          </div>
        `;
        return;
      }

      let playersHtml = subtabsHtml + '<div class="fav-players-list">';
      favPlayerList.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).forEach(p => {
        const isFoot = p.sport === 'football';
        const badge = isFoot
          ? '<span class="sport-badge football">Футбол</span>'
          : '<span class="sport-badge table-tennis">Н. теннис</span>';
        playersHtml += `
          <div class="fav-player-card" onclick="openPlayerProfile(${p.id}, '${escapeJs(p.name)}')">
            <div class="fav-player-info">
              <img src="api.php?action=image&id=${p.id}" class="fav-player-avatar" alt="" onerror="this.style.opacity='0.2'">
              <div class="fav-player-details">
                <div class="fav-player-name">${escapeHtml(p.name)}</div>
                <div class="fav-player-meta">
                  ${badge}
                  ${p.ranking ? `<span>#${p.ranking}</span>` : ''}
                  ${p.country ? `<span>${escapeHtml(p.country)}</span>` : ''}
                </div>
              </div>
            </div>
            <button class="fav-btn active" onclick="event.stopPropagation(); togglePlayerFavorite({ id: ${p.id} })" aria-label="Удалить из избранного" title="Удалить из избранного">
              <svg class="star-icon filled" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </button>
          </div>
        `;
      });
      playersHtml += '</div>';
      container.innerHTML = playersHtml;
      return;
    }

    // favSubTab === 'matches'
    const favMatchesList = [];
    favorites.forEach(id => {
      const liveM = matches.find(m => String(m.id) === String(id));
      if (liveM) {
        favMatchesList.push(liveM);
      } else if (favoriteMatches[id]) {
        favMatchesList.push(favoriteMatches[id]);
      }
    });

    if (favMatchesList.length === 0) {
      container.innerHTML = subtabsHtml + `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </div>
          <div class="empty-state-title">В избранном пока нет матчей</div>
          <div class="empty-state-desc">Нажмите на звёздочку рядом с любым матчем, чтобы сохранить его здесь.</div>
        </div>
      `;
      return;
    }

    const statusOrder = { 'live': 1, 'upcoming': 2, 'finished': 3 };
    favMatchesList.sort((a, b) => {
      const orderA = statusOrder[a.status] || 99;
      const orderB = statusOrder[b.status] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return (b.startTimestamp || 0) - (a.startTimestamp || 0);
    });

    const grouped = groupMatches(favMatchesList);
    let html = subtabsHtml;

    for (const [league, items] of Object.entries(grouped)) {
      html += `
        <div class="league-group">
          <div class="league-header">${escapeHtml(league)}</div>
      `;

      items.forEach(m => {
        const isFav = isFavoriteMatch(m.id);
        const isLive = m.status === 'live';
        const homeScore = m.homeTeam?.score !== null && m.homeTeam?.score !== undefined ? m.homeTeam.score : '-';
        const awayScore = m.awayTeam?.score !== null && m.awayTeam?.score !== undefined ? m.awayTeam.score : '-';
        const timeStr = formatMatchTime(m);

        const starIcon = isFav
          ? `<svg class="star-icon filled" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
          : `<svg class="star-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

        html += `
          <div class="match-row" onclick="openMatchDetail('${escapeHtml(m.id)}')" style="cursor: pointer;">
            <div class="match-time ${isLive ? 'live' : ''}">
              ${isLive ? '<span class="live-dot"></span>' : ''}
              ${timeStr}
            </div>
            <div class="match-teams">
              <div class="team-line">
                <span>${escapeHtml(m.homeTeam?.name || 'Команда 1')}</span>
                <span class="team-score">${homeScore}</span>
              </div>
              <div class="team-line">
                <span>${escapeHtml(m.awayTeam?.name || 'Команда 2')}</span>
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
    return;
  }

  let filtered = matches;
  if (currentStatus === 'live') {
    filtered = matches.filter(m => m.status === 'live');
  } else if (currentStatus === 'finished') {
    filtered = matches.filter(m => m.status === 'finished');
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
      const isFav = isFavoriteMatch(m.id);
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
            ${timeStr}
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

// Match detail view
async function openMatchDetail(matchId) {
  showView('match');

  const titleEl = document.getElementById('match-view-header-title');
  const container = document.getElementById('match-details-container');
  if (titleEl) titleEl.textContent = 'Матчи';
  if (container) container.innerHTML = '<div class="feed-loader">Загрузка данных матча...</div>';

  currentMatchData = { id: matchId };
  currentMatchTab = 'overview';
  updateMatchHeaderFavBtn(matchId);

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

    currentMatchData = data;
    currentMatchData.id = matchId;
    updateMatchHeaderFavBtn(matchId);

    if (titleEl) titleEl.textContent = 'Матчи';

    const homeTeam = data.homeTeam || {};
    const awayTeam = data.awayTeam || {};
    const homeName = homeTeam.name || 'Команда 1';
    const awayName = awayTeam.name || 'Команда 2';
    const homeId = homeTeam.id || 0;
    const awayId = awayTeam.id || 0;
    const homeSets = homeTeam.sets !== null && homeTeam.sets !== undefined ? homeTeam.sets : '-';
    const awaySets = awayTeam.sets !== null && awayTeam.sets !== undefined ? awayTeam.sets : '-';
    const statusClass = data.isLive ? 'live' : 'finished';

    // Update favorite match cache with rich details
    if (favorites.includes(String(matchId))) {
      favoriteMatches[String(matchId)] = {
        id: matchId,
        tournament: data.tournament || '',
        country: data.country || '',
        homeTeam: { id: homeId, name: homeName, score: homeSets },
        awayTeam: { id: awayId, name: awayName, score: awaySets },
        status: data.isLive ? 'live' : 'finished',
        time: data.date || '',
        startTimestamp: data.startTimestamp || Math.floor(Date.now() / 1000),
        sport: data.sport || currentSport
      };
      localStorage.setItem('matchfeed_fav_matches', JSON.stringify(favoriteMatches));
    }

    // Определяем вид спорта
    const isFootball = (data.sport === 'football') || (currentSport === 'football');
    const periodLabel = isFootball
      ? ['1-й тайм', '2-й тайм', 'Доп. время', 'Пенальти']
      : null;

    // Таблица периодов/сетов
    let setsHeaders = `<th>${isFootball ? 'Команда' : 'Игрок'}</th>`;
    let homeRow = `<td class="team-cell">${escapeHtml(homeName)}</td>`;
    let awayRow = `<td class="team-cell">${escapeHtml(awayName)}</td>`;

    const sets = Array.isArray(data.sets) ? data.sets : [];
    sets.forEach((s, idx) => {
      const label = periodLabel ? (periodLabel[idx] || `Период ${idx + 1}`) : `Сет ${idx + 1}`;
      setsHeaders += `<th>${label}</th>`;
      const hp = s.home !== null && s.home !== undefined ? s.home : '-';
      const ap = s.away !== null && s.away !== undefined ? s.away : '-';

      if (isFootball) {
        homeRow += `<td class="set-score">${hp}</td>`;
        awayRow += `<td class="set-score">${ap}</td>`;
      } else {
        const homeWon = s.homeWon === true;
        const awayWon = s.homeWon === false;
        homeRow += `<td class="set-score ${homeWon ? 'winner' : 'loser'}">${hp}</td>`;
        awayRow += `<td class="set-score ${awayWon ? 'winner' : 'loser'}">${ap}</td>`;
      }
    });

    const totalLabel = 'Итог';
    setsHeaders += `<th>${totalLabel}</th>`;
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

    // Карточки команд/игроков с фото через локальный прокси
    const homeImgUrl = homeId ? `api.php?action=image&id=${homeId}` : '';
    const awayImgUrl = awayId ? `api.php?action=image&id=${awayId}` : '';

    const homeCard = homeId ? `
      <button class="player-link-btn" onclick="openPlayerProfile(${homeId}, '${escapeJs(homeName)}')">
        <img src="${homeImgUrl}" class="team-avatar-img" alt="" onerror="this.style.opacity='0.2'">
        <div class="player-card-name">${escapeHtml(homeName)}</div>
        ${!isFootball ? '<span class="player-link-pill">Профиль игрока</span>' : ''}
      </button>
    ` : `<div class="player-name-plain">${escapeHtml(homeName)}</div>`;

    const awayCard = awayId ? `
      <button class="player-link-btn" onclick="openPlayerProfile(${awayId}, '${escapeJs(awayName)}')">
        <img src="${awayImgUrl}" class="team-avatar-img" alt="" onerror="this.style.opacity='0.2'">
        <div class="player-card-name">${escapeHtml(awayName)}</div>
        ${!isFootball ? '<span class="player-link-pill">Профиль игрока</span>' : ''}
      </button>
    ` : `<div class="player-name-plain">${escapeHtml(awayName)}</div>`;

    const hasVideos = Array.isArray(data.media?.videos) && data.media.videos.length > 0;
    const hasNews = Array.isArray(data.media?.news) && data.media.news.length > 0;
    const hasMedia = Boolean(data.media?.hasMedia && (hasVideos || hasNews));
    if (!hasMedia && currentMatchTab === 'media') {
      currentMatchTab = 'overview';
    }

    const isFav = isFavoriteMatch(matchId);
    const html = `
      <div class="match-detail-card">
        <div class="match-detail-header">
          <button id="match-card-fav-btn" class="fav-btn match-card-fav-btn ${isFav ? 'active' : ''}" onclick="toggleCurrentMatchFavorite()" aria-label="В избранное" title="Добавить в избранное">
            <svg class="star-icon ${isFav ? 'filled' : ''}" viewBox="0 0 24 24" width="20" height="20" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${isFav ? '1.5' : '2'}" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </button>
          <div class="match-tourn-title">${escapeHtml(data.tournament || 'Матч')} ${data.round ? '• ' + escapeHtml(data.round) : ''}</div>
          <div class="match-status-pill ${statusClass}">${escapeHtml(data.status || '-')}</div>
        </div>

        <div class="scoreboard-box">
          <div class="scoreboard-side">
            ${homeCard}
            <div class="scoreboard-score">${homeSets}</div>
          </div>

          <div class="scoreboard-colon">:</div>

          <div class="scoreboard-side">
            <div class="scoreboard-score">${awaySets}</div>
            ${awayCard}
          </div>
        </div>

        ${setsTableHtml}

        <div class="match-tabs-container">
          <div class="match-tabs-nav">
            <button id="match-tab-nav-overview" class="match-tab-btn ${currentMatchTab === 'overview' ? 'active' : ''}" onclick="switchMatchTab('overview')">Обзор</button>
            <button id="match-tab-nav-h2h" class="match-tab-btn ${currentMatchTab === 'h2h' ? 'active' : ''}" onclick="switchMatchTab('h2h')">H2H</button>
            <button id="match-tab-nav-form" class="match-tab-btn ${currentMatchTab === 'form' ? 'active' : ''}" onclick="switchMatchTab('form')">Форма</button>
            <button id="match-tab-nav-bracket" class="match-tab-btn ${currentMatchTab === 'bracket' ? 'active' : ''}" onclick="switchMatchTab('bracket')">Сетка</button>
            ${hasMedia ? `<button id="match-tab-nav-media" class="match-tab-btn ${currentMatchTab === 'media' ? 'active' : ''}" onclick="switchMatchTab('media')">Медиа</button>` : ''}
          </div>

          <div id="match-tab-content-body" class="match-tab-content-body">
            <!-- Dynamic tab content -->
          </div>
        </div>

        <div style="margin-top: 16px; text-align: center; font-size: 11px; color: #9CA3AF;">
          Дата: ${escapeHtml(data.date || '-')}
        </div>
      </div>
    `;

    if (container) {
      container.innerHTML = html;
      renderMatchTabContent(currentMatchTab);
    }
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

// Match tabs logic
function switchMatchTab(tabName) {
  currentMatchTab = tabName;
  ['overview', 'h2h', 'form', 'bracket', 'media'].forEach(t => {
    const btn = document.getElementById(`match-tab-nav-${t}`);
    if (btn) btn.classList.toggle('active', t === tabName);
  });
  renderMatchTabContent(tabName);
}

function submitMatchVote(choice) {
  if (!currentMatchData || !currentMatchData.id) return;
  const matchId = String(currentMatchData.id);
  localStorage.setItem(`matchfeed_vote_${matchId}`, choice);

  if (!currentMatchData.votes) {
    currentMatchData.votes = { vote1: 0, vote2: 0, voteX: 0, hasDraw: false };
  }
  if (choice === '1') currentMatchData.votes.vote1 = (currentMatchData.votes.vote1 || 0) + 1;
  else if (choice === '2') currentMatchData.votes.vote2 = (currentMatchData.votes.vote2 || 0) + 1;
  else if (choice === 'X') currentMatchData.votes.voteX = (currentMatchData.votes.voteX || 0) + 1;

  renderMatchTabContent('overview');
}

function renderMatchTabContent(tabName) {
  const container = document.getElementById('match-tab-content-body');
  if (!container || !currentMatchData) return;

  if (tabName === 'overview') {
    container.innerHTML = getMatchOverviewHtml(currentMatchData);
  } else if (tabName === 'h2h') {
    container.innerHTML = getMatchH2HHtml(currentMatchData);
  } else if (tabName === 'form') {
    container.innerHTML = getMatchFormHtml(currentMatchData);
  } else if (tabName === 'bracket') {
    container.innerHTML = getMatchBracketHtml(currentMatchData);
  } else if (tabName === 'media') {
    container.innerHTML = getMatchMediaHtml(currentMatchData);
  }
}

function getMatchOverviewHtml(data) {
  const homeName = data.homeTeam?.name || 'Игрок 1';
  const awayName = data.awayTeam?.name || 'Игрок 2';
  const matchId = String(data.id || '');
  const userVote = localStorage.getItem(`matchfeed_vote_${matchId}`);

  const v1 = Number(data.votes?.vote1 || 0);
  const v2 = Number(data.votes?.vote2 || 0);
  const vx = Number(data.votes?.voteX || 0);
  const hasDraw = Boolean(data.votes?.hasDraw);
  const totalVotes = v1 + v2 + (hasDraw ? vx : 0);

  let p1 = 0;
  let px = 0;
  let p2 = 0;
  if (totalVotes > 0) {
    p1 = Math.round((v1 / totalVotes) * 100);
    px = hasDraw ? Math.round((vx / totalVotes) * 100) : 0;
    p2 = Math.max(0, 100 - p1 - px);
  }

  // Voting HTML
  let voteHtml = '';
  if (userVote) {
    const chosenName = userVote === '1' ? homeName : (userVote === '2' ? awayName : 'Ничья');
    voteHtml = `
      <div class="vote-result-box">
        <div class="vote-progress-bar">
          <div class="vote-bar-fill vote-bar-home" style="width: ${p1}%;"></div>
          ${hasDraw ? `<div class="vote-bar-fill vote-bar-draw" style="width: ${px}%;"></div>` : ''}
          <div class="vote-bar-fill vote-bar-away" style="width: ${p2}%;"></div>
        </div>
        <div class="vote-labels-row">
          <span class="vote-label-team">${escapeHtml(homeName)}: ${p1}% (${v1})</span>
          ${hasDraw ? `<span class="vote-label-draw">Ничья: ${px}% (${vx})</span>` : ''}
          <span class="vote-label-team" style="text-align:right;">${escapeHtml(awayName)}: ${p2}% (${v2})</span>
        </div>
        <div class="vote-confirmed-tag">Ваш выбор: ${escapeHtml(chosenName)} • Всего: ${totalVotes}</div>
      </div>
    `;
  } else {
    voteHtml = `
      <div class="vote-buttons-row">
        <button class="vote-action-btn" onclick="submitMatchVote('1')">${escapeHtml(homeName)}</button>
        ${hasDraw ? `<button class="vote-action-btn vote-draw-btn" onclick="submitMatchVote('X')">Ничья</button>` : ''}
        <button class="vote-action-btn" onclick="submitMatchVote('2')">${escapeHtml(awayName)}</button>
      </div>
      <div class="vote-hint">Проголосовало пользователей: ${totalVotes}</div>
    `;
  }

  // Odds HTML
  let oddsHtml = '';
  const oddsList = Array.isArray(data.odds) ? data.odds : [];
  const primaryMarket = oddsList[0];
  if (primaryMarket && Array.isArray(primaryMarket.choices) && primaryMarket.choices.length > 0) {
    let oddsItems = '';
    primaryMarket.choices.forEach(c => {
      let label = c.name;
      if (c.name === '1') label = `П1 (${homeName})`;
      else if (c.name === '2') label = `П2 (${awayName})`;
      else if (c.name === 'X' || c.name === 'x') label = 'Ничья';

      const changeClass = c.change > 0 ? 'odds-up' : (c.change < 0 ? 'odds-down' : '');
      oddsItems += `
        <div class="odds-box">
          <div class="odds-label">${escapeHtml(label)}</div>
          <div class="odds-value ${changeClass}">${escapeHtml(String(c.val || '-'))}</div>
        </div>
      `;
    });
    oddsHtml = `<div class="odds-grid">${oddsItems}</div>`;
  } else {
    oddsHtml = `<div class="match-tab-empty-note">Коэффициенты на победу пока не опубликованы</div>`;
  }

  // Rankings and Info HTML
  const homeRank = data.homeTeam?.ranking ? `№${data.homeTeam.ranking}` : '-';
  const awayRank = data.awayTeam?.ranking ? `№${data.awayTeam.ranking}` : '-';

  // Broadcast / Stream Status HTML
  let liveTrackerHtml = '';
  if (data.isLive) {
    liveTrackerHtml = `
      <div class="broadcast-banner live">
        <span class="live-dot-pulse"></span>
        <div class="broadcast-text">
          <div class="broadcast-title">Live-трекер матча активен</div>
          <div class="broadcast-sub">Счет, сеты и статистика обновляются в режиме реального времени</div>
        </div>
      </div>
    `;
  } else {
    liveTrackerHtml = `
      <div class="broadcast-banner">
        <div class="broadcast-text">
          <div class="broadcast-title">${escapeHtml(data.status || 'Матч')}</div>
          <div class="broadcast-sub">Текстовая трансляция и статистика сохранены</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="match-tab-section">
      <div class="match-tab-section-title">Кто победит?</div>
      ${voteHtml}
    </div>

    <div class="match-tab-section">
      <div class="match-tab-section-title">Коэффициенты букмекеров</div>
      ${oddsHtml}
    </div>

    <div class="match-tab-section">
      <div class="match-tab-section-title">Информация о матче</div>
      <div class="match-info-list">
        <div class="match-info-row"><span class="info-k">Турнир</span><span class="info-v">${escapeHtml(data.tournament || '-')}</span></div>
        ${data.category ? `<div class="match-info-row"><span class="info-k">Категория</span><span class="info-v">${escapeHtml(data.category)}</span></div>` : ''}
        ${data.round ? `<div class="match-info-row"><span class="info-k">Раунд</span><span class="info-v">${escapeHtml(data.round)}</span></div>` : ''}
        <div class="match-info-row"><span class="info-k">Дата и время</span><span class="info-v">${escapeHtml(data.date || '-')}</span></div>
        ${data.homeTeam?.ranking || data.awayTeam?.ranking ? `
          <div class="match-info-row"><span class="info-k">Рейтинг ${escapeHtml(homeName)}</span><span class="info-v">${homeRank}</span></div>
          <div class="match-info-row"><span class="info-k">Рейтинг ${escapeHtml(awayName)}</span><span class="info-v">${awayRank}</span></div>
        ` : ''}
      </div>
    </div>

    <div class="match-tab-section">
      <div class="match-tab-section-title">Трансляция и статус</div>
      ${liveTrackerHtml}
    </div>
  `;
}

function getMatchH2HHtml(data) {
  const homeName = data.homeTeam?.name || 'Игрок 1';
  const awayName = data.awayTeam?.name || 'Игрок 2';

  const duel = data.h2h?.duel || { homeWins: 0, awayWins: 0, draws: 0 };
  const hw = Number(duel.homeWins || 0);
  const aw = Number(duel.awayWins || 0);
  const dr = Number(duel.draws || 0);
  const total = hw + aw + dr;

  let duelBarHtml = '';
  if (total > 0) {
    const hwPct = Math.round((hw / total) * 100);
    const drPct = dr > 0 ? Math.round((dr / total) * 100) : 0;
    const awPct = Math.max(0, 100 - hwPct - drPct);

    duelBarHtml = `
      <div class="h2h-duel-bar">
        <div class="h2h-bar-fill h2h-bar-home" style="width: ${hwPct}%;"></div>
        ${dr > 0 ? `<div class="h2h-bar-fill h2h-bar-draw" style="width: ${drPct}%;"></div>` : ''}
        <div class="h2h-bar-fill h2h-bar-away" style="width: ${awPct}%;"></div>
      </div>
      <div class="h2h-stats-row">
        <span class="h2h-stat-home">${escapeHtml(homeName)}: ${hw}</span>
        ${dr > 0 ? `<span class="h2h-stat-draw">Ничьих: ${dr}</span>` : ''}
        <span class="h2h-stat-away">${escapeHtml(awayName)}: ${aw}</span>
      </div>
    `;
  } else {
    duelBarHtml = `<div class="match-tab-empty-note">История личных дуэлей пока формируется</div>`;
  }

  const directMatches = Array.isArray(data.h2h?.matches) ? data.h2h.matches : [];
  let matchesListHtml = '';
  if (directMatches.length > 0) {
    matchesListHtml = directMatches.map(m => {
      return `
        <div class="h2h-match-item" onclick="openMatchDetail('${escapeJs(m.id)}')">
          <div class="h2h-match-top">
            <span class="h2h-match-tourn">${escapeHtml(m.tournament || 'Турнир')}</span>
            <span class="h2h-match-date">${escapeHtml(m.date || '')}</span>
          </div>
          <div class="h2h-match-teams">
            <span class="h2h-team-name ${m.winnerCode === 1 ? 'winner' : ''}">${escapeHtml(m.homeTeam || homeName)}</span>
            <span class="h2h-score-badge">${escapeHtml(m.scoreStr || '-')}</span>
            <span class="h2h-team-name ${m.winnerCode === 2 ? 'winner' : ''}">${escapeHtml(m.awayTeam || awayName)}</span>
          </div>
          ${m.setsStr ? `<div class="h2h-match-sets">${escapeHtml(m.setsStr)}</div>` : ''}
        </div>
      `;
    }).join('');
  } else {
    matchesListHtml = `<div class="match-tab-empty-note">Предыдущих личных встреч в текущем сезоне не найдено</div>`;
  }

  return `
    <div class="match-tab-section">
      <div class="match-tab-section-title">Баланс побед в личных встречах</div>
      ${duelBarHtml}
    </div>

    <div class="match-tab-section">
      <div class="match-tab-section-title">История предыдущих матчей</div>
      <div class="h2h-matches-list">
        ${matchesListHtml}
      </div>
    </div>
  `;
}

function getMatchFormHtml(data) {
  const homeName = data.homeTeam?.name || 'Игрок 1';
  const awayName = data.awayTeam?.name || 'Игрок 2';

  const homeForm = data.form?.home || {};
  const awayForm = data.form?.away || {};

  function renderTeamFormBlock(tName, fData) {
    const streak = fData.streak || { type: 'none', text: 'Нет данных' };
    const streakClass = streak.type === 'win' ? 'win' : (streak.type === 'loss' ? 'loss' : 'none');
    const winRate = fData.winRate !== undefined ? `${fData.winRate}% побед` : '';
    const mList = Array.isArray(fData.matches) ? fData.matches : [];

    const badgesHtml = mList.map(m => {
      let bClass = 'draw';
      let bLetter = 'Н';
      if (m.won === true) { bClass = 'win'; bLetter = 'В'; }
      else if (m.won === false) { bClass = 'loss'; bLetter = 'П'; }
      return `<span class="form-badge ${bClass}" title="${escapeHtml(m.opponent || '')}">${bLetter}</span>`;
    }).join('');

    const listHtml = mList.length > 0 ? mList.map(m => {
      let bClass = 'draw';
      let bLetter = 'Н';
      if (m.won === true) { bClass = 'win'; bLetter = 'В'; }
      else if (m.won === false) { bClass = 'loss'; bLetter = 'П'; }

      return `
        <div class="form-match-row" ${m.id ? `onclick="openMatchDetail('${escapeJs(m.id)}')"` : ''}>
          <div class="form-match-left">
            <span class="form-badge small ${bClass}">${bLetter}</span>
            <div class="form-match-opp">
              <span class="form-opp-name">против ${escapeHtml(m.opponent || 'Соперник')}</span>
              <span class="form-match-date">${escapeHtml(m.date || '')} • ${escapeHtml(m.tournament || '')}</span>
            </div>
          </div>
          <div class="form-match-score">${escapeHtml(m.scoreStr || '-')}</div>
        </div>
      `;
    }).join('') : `<div class="match-tab-empty-note">Нет данных о последних матчах</div>`;

    return `
      <div class="match-tab-section">
        <div class="form-team-header">
          <div class="form-team-name">${escapeHtml(tName)}</div>
          <span class="streak-pill ${streakClass}">${escapeHtml(streak.text)}</span>
        </div>
        <div class="form-badges-container">
          <div class="form-badges-row">${badgesHtml}</div>
          ${winRate ? `<span class="form-winrate-text">${winRate}</span>` : ''}
        </div>
        <div class="form-matches-list">
          ${listHtml}
        </div>
      </div>
    `;
  }

  return `
    ${renderTeamFormBlock(homeName, homeForm)}
    ${renderTeamFormBlock(awayName, awayForm)}
  `;
}

function getMatchBracketHtml(data) {
  const bracket = data.bracket || {};
  const hasTree = Boolean(bracket.hasTree && Array.isArray(bracket.tree) && bracket.tree.length > 0);
  const matches = Array.isArray(bracket.matches) ? bracket.matches : [];

  if (!hasTree && matches.length === 0) {
    return `
      <div class="match-tab-section">
        <div class="match-tab-section-title">Сетка турнира</div>
        <div class="match-tab-empty-note">Сетка турнира формируется или для данного формата не предусмотрена</div>
      </div>
    `;
  }

  // Древовидная турнирная сетка (cuptrees)
  if (hasTree) {
    const treeName = bracket.treeName || data.tournament || 'Сетка плей-офф';
    const roundsHtml = bracket.tree.map((r, rIdx) => {
      const blocksHtml = (r.blocks || []).map(b => {
        const isCurrent = Boolean(b.isCurrent);
        const isLive = Boolean(b.isLive);
        const hasMatch = Boolean(b.matchId);

        const hSeed = b.home?.seed ? `<span class="bracket-seed-tag">${escapeHtml(b.home.seed)}</span>` : '';
        const aSeed = b.away?.seed ? `<span class="bracket-seed-tag">${escapeHtml(b.away.seed)}</span>` : '';

        const hWinner = b.home?.winner === true;
        const aWinner = b.away?.winner === true;

        const hScore = b.home?.score !== null && b.home?.score !== undefined ? b.home.score : (b.finished ? '0' : '-');
        const aScore = b.away?.score !== null && b.away?.score !== undefined ? b.away.score : (b.finished ? '0' : '-');

        const clickAttr = hasMatch ? `onclick="openMatchDetail('${escapeJs(b.matchId)}')"` : '';
        const cursorClass = hasMatch ? 'clickable' : '';

        let statusBadge = '';
        if (isCurrent) {
          statusBadge = '<span class="bracket-node-current">Текущий матч</span>';
        } else if (isLive) {
          statusBadge = '<span class="bracket-node-live">LIVE</span>';
        }

        return `
          <div class="bracket-node-card ${isCurrent ? 'current' : ''} ${cursorClass}" ${clickAttr}>
            ${statusBadge}
            <div class="bracket-node-row ${hWinner ? 'winner' : ''}">
              <div class="bracket-participant-info">
                ${hSeed}
                <span class="bracket-participant-name">${escapeHtml(b.home?.name || '-')}</span>
              </div>
              <span class="bracket-participant-score">${hScore}</span>
            </div>
            <div class="bracket-node-divider"></div>
            <div class="bracket-node-row ${aWinner ? 'winner' : ''}">
              <div class="bracket-participant-info">
                ${aSeed}
                <span class="bracket-participant-name">${escapeHtml(b.away?.name || '-')}</span>
              </div>
              <span class="bracket-participant-score">${aScore}</span>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="bracket-round-column">
          <div class="bracket-round-title">${escapeHtml(r.title || `Раунд ${rIdx + 1}`)}</div>
          <div class="bracket-round-blocks">
            ${blocksHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="match-tab-section" style="padding: 12px 6px;">
        <div class="bracket-header-bar">
          <div class="match-tab-section-title" style="margin-left: 8px;">Турнирная сетка: ${escapeHtml(treeName)}</div>
          <span class="bracket-hint">Прокрутите вправо &rarr;</span>
        </div>
        <div class="bracket-tree-wrapper">
          <div class="bracket-tree-container">
            ${roundsHtml}
          </div>
        </div>
      </div>
    `;
  }

  // Резервный плоский список матчей
  const itemsHtml = matches.map(m => {
    const isCurrent = Boolean(m.isCurrent);
    const hScore = m.homeTeam?.score !== null && m.homeTeam?.score !== undefined ? m.homeTeam.score : '-';
    const aScore = m.awayTeam?.score !== null && m.awayTeam?.score !== undefined ? m.awayTeam.score : '-';
    const statusText = m.isLive ? 'LIVE' : (m.status || '');

    return `
      <div class="bracket-match-item ${isCurrent ? 'current' : ''}" onclick="openMatchDetail('${escapeJs(m.id)}')">
        <div class="bracket-match-header">
          <span class="bracket-round-name">${escapeHtml(m.round || m.date || 'Матч')}</span>
          ${isCurrent ? '<span class="bracket-current-badge">Текущий матч</span>' : ''}
          <span class="bracket-status-tag ${m.isLive ? 'live' : ''}">${escapeHtml(statusText)}</span>
        </div>
        <div class="bracket-match-teams">
          <div class="bracket-team-line">
            <span class="bracket-team-name">${escapeHtml(m.homeTeam?.name || 'Команда 1')}</span>
            <span class="bracket-team-score">${hScore}</span>
          </div>
          <div class="bracket-team-line">
            <span class="bracket-team-name">${escapeHtml(m.awayTeam?.name || 'Команда 2')}</span>
            <span class="bracket-team-score">${aScore}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="match-tab-section">
      <div class="match-tab-section-title">Матчи турнира: ${escapeHtml(data.tournament || 'Сетка')}</div>
      <div class="bracket-matches-list">
        ${itemsHtml}
      </div>
    </div>
  `;
}

// Media tab
let currentMediaSubTab = 'videos';
let selectedMediaVideoIndex = 0;

function formatMediaDateRu(tsOrStr) {
  if (!tsOrStr) return '';
  let d;
  if (typeof tsOrStr === 'number' || (!isNaN(tsOrStr) && !String(tsOrStr).includes('.'))) {
    d = new Date(Number(tsOrStr) * 1000);
  } else {
    d = new Date(tsOrStr);
  }
  if (isNaN(d.getTime())) return String(tsOrStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function switchMediaSubTab(subTab) {
  currentMediaSubTab = subTab;
  const container = document.getElementById('match-tab-content-body');
  if (container && currentMatchData) {
    container.innerHTML = getMatchMediaHtml(currentMatchData);
  }
}

function selectMediaVideo(index) {
  selectedMediaVideoIndex = index;
  const container = document.getElementById('match-tab-content-body');
  if (container && currentMatchData) {
    container.innerHTML = getMatchMediaHtml(currentMatchData);
  }
}

function getMatchMediaHtml(data) {
  const media = data.media || {};
  const videos = Array.isArray(media.videos) ? media.videos : [];
  const news = Array.isArray(media.news) ? media.news : [];

  if (videos.length === 0 && news.length === 0) {
    return `
      <div class="match-tab-section">
        <div class="player-empty-prompt" style="padding: 28px 0;">
          <div class="empty-state-title">Медиаматериалы недоступны</div>
          <div class="empty-state-desc">Для данного матча видео и новости отсутствуют</div>
        </div>
      </div>
    `;
  }

  if (currentMediaSubTab === 'videos' && videos.length === 0 && news.length > 0) {
    currentMediaSubTab = 'news';
  } else if (currentMediaSubTab === 'news' && news.length === 0 && videos.length > 0) {
    currentMediaSubTab = 'videos';
  }

  let chipsHtml = '';
  if (videos.length > 0 && news.length > 0) {
    chipsHtml = `
      <div class="media-filters-row">
        <button class="media-chip ${currentMediaSubTab === 'videos' ? 'active' : ''}" onclick="switchMediaSubTab('videos')">Видео</button>
        <button class="media-chip ${currentMediaSubTab === 'news' ? 'active' : ''}" onclick="switchMediaSubTab('news')">Новости</button>
      </div>
    `;
  } else if (videos.length > 0) {
    chipsHtml = `
      <div class="media-filters-row">
        <button class="media-chip active">Видео</button>
      </div>
    `;
  } else if (news.length > 0) {
    chipsHtml = `
      <div class="media-filters-row">
        <button class="media-chip active">Новости</button>
      </div>
    `;
  }

  let bodyHtml = '';

  if (currentMediaSubTab === 'videos' && videos.length > 0) {
    const curIdx = (selectedMediaVideoIndex >= 0 && selectedMediaVideoIndex < videos.length) ? selectedMediaVideoIndex : 0;
    const curVideo = videos[curIdx];

    let playerHtml = '';
    if (curVideo.youtubeId) {
      playerHtml = `
        <div class="media-player-box">
          <iframe
            id="media-youtube-iframe"
            src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(curVideo.youtubeId)}?autoplay=0"
            title="${escapeHtml(curVideo.title || 'Видео матча')}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>
      `;
    } else if (curVideo.url) {
      playerHtml = `
        <div class="media-player-box">
          <video src="${escapeHtml(curVideo.url)}" controls style="position:absolute; top:0; left:0; width:100%; height:100%;"></video>
        </div>
      `;
    }

    let externalBtnHtml = '';
    if (curVideo.url) {
      externalBtnHtml = `
        <a class="media-external-btn" href="${escapeHtml(curVideo.url)}" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          <span>Смотреть на YouTube</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
      `;
    }

    let otherVideosHtml = '';
    if (videos.length > 1) {
      const items = videos.map((v, i) => `
        <div class="media-card-item ${i === curIdx ? 'media-card-selected' : ''}" onclick="selectMediaVideo(${i})" style="cursor: pointer;">
          <div class="media-card-thumb-box">
            ${v.thumbnailUrl ? `<img src="${escapeHtml(v.thumbnailUrl)}" class="media-card-thumb" alt="" />` : ''}
            <div class="media-play-overlay">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </div>
          </div>
          <div class="media-card-body">
            <div class="media-card-title">${escapeHtml(v.title || 'Видео')}</div>
            ${v.subtitle ? `<div class="media-card-sub">${escapeHtml(v.subtitle)}</div>` : ''}
          </div>
        </div>
      `).join('');

      otherVideosHtml = `
        <div style="margin-top: 16px;">
          <div class="match-tab-section-title" style="margin-bottom: 8px;">Все видео матча (${videos.length})</div>
          <div class="media-official-grid">
            ${items}
          </div>
        </div>
      `;
    }

    bodyHtml = `
      ${playerHtml}
      <div class="media-video-info">
        <div class="media-video-title">${escapeHtml(curVideo.title || '')}</div>
        ${curVideo.subtitle ? `<div class="media-video-sub">${escapeHtml(curVideo.subtitle)}</div>` : ''}
      </div>
      ${externalBtnHtml}
      ${otherVideosHtml}
    `;
  } else if (currentMediaSubTab === 'news' && news.length > 0) {
    const cards = news.map(art => {
      const imgHtml = art.thumbnailUrl ? `
        <div class="media-news-img-box">
          <img src="${escapeHtml(art.thumbnailUrl)}" class="media-news-img" alt="${escapeHtml(art.title)}" />
        </div>
      ` : '';
      const dateRu = formatMediaDateRu(art.timestamp || art.date);
      return `
        <a href="${escapeHtml(art.url || '#')}" target="_blank" rel="noopener noreferrer" class="media-news-card">
          ${imgHtml}
          <div class="media-news-body">
            <div class="media-news-title">${escapeHtml(art.title)}</div>
            ${art.lead ? `<div class="media-news-lead">${escapeHtml(art.lead)}</div>` : ''}
            <div class="media-news-footer">
              <span class="media-news-source-tag">${escapeHtml(art.source || 'Sofascore')}</span>
              ${dateRu ? `<span class="media-news-dot">•</span><span class="media-news-date">${escapeHtml(dateRu)}</span>` : ''}
            </div>
          </div>
        </a>
      `;
    }).join('');

    bodyHtml = `
      <div class="media-news-list">
        ${cards}
      </div>
    `;
  }

  return `
    <div class="match-tab-section">
      ${chipsHtml}
      ${bodyHtml}
    </div>
  `;
}



// Player profile & history view
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
        const isFoot = p.sport === 'football';
        const sportBadge = isFoot
          ? '<span class="sport-badge football">Футбол</span>'
          : '<span class="sport-badge table-tennis">Н. теннис</span>';

        dHtml += `
          <button class="player-search-item" onclick="selectSearchedPlayer(${p.id}, '${escapeJs(p.name)}')">
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="api.php?action=image&id=${p.id}" class="search-avatar-img" alt="" onerror="this.style.opacity='0.2'">
              <div>
                <div class="search-item-name">${escapeHtml(p.name)}</div>
                <div class="search-item-meta" style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                  ${sportBadge}
                  <span>${escapeHtml(p.country || '')}</span>
                </div>
              </div>
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
  currentPlayerProfile = { id: playerId, name: playerName, country: '', ranking: null, sport: currentSport };
  updatePlayerHeaderFavBtn(playerId);

  showView('player');

  const titleEl = document.getElementById('player-view-header-title');
  const content = document.getElementById('player-view-content');
  if (titleEl) titleEl.textContent = 'Профиль игрока';
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
    currentPlayerProfile = {
      id: playerId,
      name: prof.name || playerName,
      country: prof.country || '',
      ranking: prof.ranking || null,
      sport: prof.sport || currentSport
    };
    updatePlayerHeaderFavBtn(playerId);

    if (favoritePlayers[String(playerId)]) {
      favoritePlayers[String(playerId)] = {
        ...favoritePlayers[String(playerId)],
        name: currentPlayerProfile.name,
        country: currentPlayerProfile.country,
        ranking: currentPlayerProfile.ranking,
        sport: currentPlayerProfile.sport
      };
      localStorage.setItem('matchfeed_fav_players', JSON.stringify(favoritePlayers));
    }

    currentPlayerData = data;
    const stats = data.stats || { totalMatches: 0, wins: 0, losses: 0, winRate: 0, pointsWon: 0, pointsLost: 0 };
    if (Array.isArray(data.matches)) {
      data.matches.sort((a, b) => (b.startTimestamp || 0) - (a.startTimestamp || 0));
    }

    if (titleEl) titleEl.textContent = 'Профиль игрока';

    const rankHtml = prof.ranking ? `<span class="player-rank-badge">Рейтинг #${prof.ranking}</span>` : '';
    const countryStr = prof.country ? escapeHtml(prof.country) : 'Настольный теннис';
    const isPlayerFav = isPlayerFavorite(playerId);
    const playerStarSvg = isPlayerFav
      ? `<svg class="star-icon filled" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
      : `<svg class="star-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

    let html = `
      <div class="player-profile-card">
        <div class="player-profile-top" style="display:flex;align-items:center;gap:12px;">
          <img src="api.php?action=image&id=${playerId}" class="team-avatar-img" style="margin:0;width:52px;height:52px;" alt="" onerror="this.style.opacity='0.2'">
          <div style="flex:1;min-width:0;">
            <div class="player-title-name">${escapeHtml(prof.name)}</div>
            <div class="player-meta-info">
              <span>${countryStr}</span>
            </div>
          </div>
          ${rankHtml}
          <button class="fav-btn ${isPlayerFav ? 'active' : ''}" id="player-profile-fav-btn" onclick="toggleCurrentPlayerFavorite()" aria-label="В избранное" title="Добавить в избранное" style="padding:6px;margin-left:4px;">
            ${playerStarSvg}
          </button>
        </div>

        <!-- Вкладки профиля -->
        <div class="player-tabs-container">
          <div class="player-tabs-nav">
            <button id="player-tab-nav-overview" class="player-tab-btn ${currentPlayerTab === 'overview' ? 'active' : ''}" onclick="switchPlayerTab('overview')">Обзор</button>
            <button id="player-tab-nav-matches" class="player-tab-btn ${currentPlayerTab === 'matches' ? 'active' : ''}" onclick="switchPlayerTab('matches')">Матчи</button>
            <button id="player-tab-nav-stats" class="player-tab-btn ${currentPlayerTab === 'stats' ? 'active' : ''}" onclick="switchPlayerTab('stats')">Статистика</button>
          </div>
        </div>
      </div>

      <div id="player-tab-content-body" class="player-tab-content-body">
        <!-- Контент выбранной вкладки -->
      </div>
    `;

    if (content) {
      content.innerHTML = html;
      renderPlayerTabContent(currentPlayerTab);
    }
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

// Переключение вкладок профиля игрока
function switchPlayerTab(tabName) {
  currentPlayerTab = tabName;
  ['overview', 'matches', 'stats'].forEach(t => {
    const btn = document.getElementById(`player-tab-nav-${t}`);
    if (btn) btn.classList.toggle('active', t === tabName);
  });
  renderPlayerTabContent(tabName);
}

function renderPlayerTabContent(tabName) {
  const container = document.getElementById('player-tab-content-body');
  if (!container || !currentPlayerData) return;

  if (tabName === 'overview') {
    container.innerHTML = getPlayerOverviewHtml(currentPlayerData);
  } else if (tabName === 'matches') {
    container.innerHTML = getPlayerMatchesHtml(currentPlayerData);
  } else if (tabName === 'stats') {
    container.innerHTML = getPlayerStatsHtml(currentPlayerData);
  }
}

// Формирование вкладки Обзор
function getPlayerOverviewHtml(data) {
  const prof = data.profile || {};
  const stats = data.stats || {};
  const streak = stats.currentStreak || { type: 'none', count: 0 };
  const recentForm = stats.recentForm || [];
  const nextMatches = data.nextMatches || [];
  const matches = data.matches || [];

  let streakHtml = '';
  if (streak.count > 0) {
    const isWinStreak = streak.type === 'win';
    const streakClass = isWinStreak ? 'streak-win' : 'streak-loss';
    const streakText = isWinStreak
      ? `Серия: ${streak.count} ${getNounForm(streak.count, 'победа', 'победы', 'побед')} подряд`
      : `Серия: ${streak.count} ${getNounForm(streak.count, 'поражение', 'поражения', 'поражений')}`;
    streakHtml = `<span class="player-streak-badge ${streakClass}">${streakText}</span>`;
  }

  let formBadgesHtml = '';
  if (recentForm.length > 0) {
    formBadgesHtml = recentForm.map(f => {
      const bClass = f.won ? 'badge-win' : 'badge-loss';
      const bLetter = f.won ? 'В' : 'П';
      const tooltip = `${f.score} vs ${escapeHtml(f.oppName)}`;
      return `<span class="player-form-badge ${bClass}" title="${tooltip}" onclick="openMatchDetail('${escapeHtml(f.id)}')">${bLetter}</span>`;
    }).join('');
  } else {
    formBadgesHtml = '<span style="font-size:12px;color:#9CA3AF;">Нет данных</span>';
  }

  const genderRu = prof.gender === 'M' ? 'Мужской' : (prof.gender === 'F' ? 'Женский' : 'Не указан');
  const sportRu = prof.sportName || (prof.sport === 'football' ? 'Футбол' : (prof.sport === 'tennis' ? 'Теннис' : 'Настольный теннис'));
  const fullNameStr = escapeHtml(prof.fullName || prof.originalName || prof.name || '-');
  const countryStr = escapeHtml(prof.country || 'Не указана');
  const leagueStr = escapeHtml(prof.currentLeague || 'Основная сетка');
  const rankStr = prof.ranking ? `#${prof.ranking}` : 'Не указан';

  let matchCardHtml = '';
  if (nextMatches.length > 0) {
    const nm = nextMatches[0];
    matchCardHtml = `
      <div class="player-tab-section">
        <div class="player-section-header">
          <span class="player-tab-section-title">Ближайший матч</span>
          <span class="player-match-status-badge upcoming">Предстоит</span>
        </div>
        <div class="player-featured-match" onclick="openMatchDetail('${escapeHtml(nm.id)}')">
          <div class="featured-match-info">
            <div class="featured-match-tourn">${escapeHtml(nm.tournament)}</div>
            <div class="featured-match-opp">vs ${escapeHtml(nm.opponent.name)}</div>
            <div class="featured-match-time">${escapeHtml(nm.date)} ${escapeHtml(nm.time || '')}</div>
          </div>
          <button class="featured-match-btn">Подробнее</button>
        </div>
      </div>
    `;
  } else if (matches.length > 0) {
    const lm = matches[0];
    const isWin = lm.won === true;
    const resClass = isWin ? 'win' : 'loss';
    const resText = isWin ? `Победа ${lm.playerSets}:${lm.opponentSets}` : `Поражение ${lm.playerSets}:${lm.opponentSets}`;
    matchCardHtml = `
      <div class="player-tab-section">
        <div class="player-section-header">
          <span class="player-tab-section-title">Рекомендуемый матч</span>
          <span class="player-match-status-badge ${resClass}">${resText}</span>
        </div>
        <div class="player-featured-match" onclick="openMatchDetail('${escapeHtml(lm.id)}')">
          <div class="featured-match-info">
            <div class="featured-match-tourn">${escapeHtml(lm.tournament)}</div>
            <div class="featured-match-opp">vs ${escapeHtml(lm.opponent.name)}</div>
            <div class="featured-match-time">${escapeHtml(lm.date)}</div>
          </div>
          <button class="featured-match-btn">Обзор матча</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="player-tab-section">
      <div class="player-section-header">
        <span class="player-tab-section-title">Текущая форма</span>
        ${streakHtml}
      </div>
      <div class="player-form-row">
        <span class="player-form-label">Последние игры:</span>
        <div class="player-form-badges">
          ${formBadgesHtml}
        </div>
      </div>
      <div class="player-form-summary">
        Винрейт по сезону: <strong>${stats.winRate || 0}%</strong> (${stats.wins || 0} побед из ${stats.totalMatches || 0} игр)
      </div>
    </div>

    <div class="player-tab-section">
      <div class="player-tab-section-title">Анкета игрока</div>
      <div class="player-info-grid">
        <div class="player-info-item">
          <div class="player-info-label">Полное имя</div>
          <div class="player-info-val">${fullNameStr}</div>
        </div>
        <div class="player-info-item">
          <div class="player-info-label">Страна</div>
          <div class="player-info-val">${countryStr}</div>
        </div>
        <div class="player-info-item">
          <div class="player-info-label">Вид спорта</div>
          <div class="player-info-val">${sportRu}</div>
        </div>
        <div class="player-info-item">
          <div class="player-info-label">Пол</div>
          <div class="player-info-val">${genderRu}</div>
        </div>
        <div class="player-info-item">
          <div class="player-info-label">Мировой рейтинг</div>
          <div class="player-info-val">${rankStr}</div>
        </div>
        <div class="player-info-item">
          <div class="player-info-label">Текущая лига</div>
          <div class="player-info-val">${leagueStr}</div>
        </div>
      </div>
    </div>

    ${matchCardHtml}
  `;
}

// Формирование вкладки Матчи
function getPlayerMatchesHtml(data) {
  const allMatches = data.matches || [];
  const nextMatches = data.nextMatches || [];
  const winsCount = data.stats?.wins ?? allMatches.filter(m => m.won === true).length;
  const lossesCount = data.stats?.losses ?? allMatches.filter(m => m.won === false).length;
  const upcomingCount = nextMatches.length;

  let filtered = [];
  if (playerMatchesFilter === 'all') {
    filtered = allMatches;
  } else if (playerMatchesFilter === 'wins') {
    filtered = allMatches.filter(m => m.won === true);
  } else if (playerMatchesFilter === 'losses') {
    filtered = allMatches.filter(m => m.won === false);
  } else if (playerMatchesFilter === 'upcoming') {
    filtered = nextMatches;
  }

  let listHtml = '';
  if (playerMatchesFilter === 'upcoming') {
    listHtml = renderPlayerNextMatchesList(filtered);
  } else {
    listHtml = renderPlayerMatchesList(filtered);
  }

  let loadMoreBtn = '';
  if (playerMatchesFilter === 'all' && allMatches.length >= 30 && !playerMatchesDone) {
    loadMoreBtn = `<button id="player-load-more-btn" class="load-more-btn" onclick="loadMorePlayerMatches()">Загрузить ещё матчи</button>`;
  }

  return `
    <div class="player-filter-chips">
      <button class="player-filter-btn ${playerMatchesFilter === 'all' ? 'active' : ''}" onclick="setPlayerMatchesFilter('all')">Все (${allMatches.length})</button>
      <button class="player-filter-btn ${playerMatchesFilter === 'wins' ? 'active' : ''}" onclick="setPlayerMatchesFilter('wins')">Победы (${winsCount})</button>
      <button class="player-filter-btn ${playerMatchesFilter === 'losses' ? 'active' : ''}" onclick="setPlayerMatchesFilter('losses')">Поражения (${lossesCount})</button>
      <button class="player-filter-btn ${playerMatchesFilter === 'upcoming' ? 'active' : ''}" onclick="setPlayerMatchesFilter('upcoming')">Предстоящие (${upcomingCount})</button>
    </div>

    <div id="player-matches-container">
      ${listHtml}
    </div>

    ${loadMoreBtn}
  `;
}

function setPlayerMatchesFilter(filterType) {
  playerMatchesFilter = filterType;
  renderPlayerTabContent('matches');
}

function renderPlayerNextMatchesList(list) {
  if (!list || list.length === 0) {
    return '<div class="player-empty-prompt"><div class="empty-state-desc">Нет запланированных предстоящих матчей</div></div>';
  }

  let html = '';
  list.forEach(m => {
    html += `
      <div class="player-match-card upcoming" onclick="openMatchDetail('${escapeHtml(m.id)}')">
        <div class="match-card-top">
          <div class="opp-name">vs ${escapeHtml(m.opponent?.name || 'Соперник')}</div>
          <div class="match-res-badge badge-upcoming">${escapeHtml(m.status || 'Предстоит')}</div>
        </div>
        <div class="match-card-bottom" style="margin-top:8px;">
          <div class="match-card-tourn">${escapeHtml(m.tournament || '-')}</div>
          <div>${escapeHtml(m.date || '-')} ${escapeHtml(m.time || '')}</div>
        </div>
      </div>
    `;
  });
  return html;
}

// Формирование вкладки Статистика
function getPlayerStatsHtml(data) {
  const stats = data.stats || {};
  const total = stats.totalMatches || 0;
  const wins = stats.wins || 0;
  const losses = stats.losses || 0;
  const winRate = stats.winRate || 0;

  const setsWon = stats.setsWon || 0;
  const setsLost = stats.setsLost || 0;
  const setsTotal = stats.setsTotal || (setsWon + setsLost);
  const setsWinRate = stats.setsWinRate || (setsTotal > 0 ? Math.round(setsWon / setsTotal * 100) : 0);

  const ptsWon = stats.pointsWon || 0;
  const ptsLost = stats.pointsLost || 0;
  const ptsDiff = stats.pointsDiff ?? (ptsWon - ptsLost);
  const ptsDiffSign = ptsDiff > 0 ? `+${ptsDiff}` : `${ptsDiff}`;
  const ptsDiffClass = ptsDiff >= 0 ? 'stat-positive' : 'stat-negative';
  const avgPts = stats.avgPointsPerSet ?? (setsTotal > 0 ? (ptsWon / setsTotal).toFixed(1) : 0);

  const cleanSweeps = stats.cleanSweeps || 0;
  const cleanSweepsRate = stats.cleanSweepsRate || (wins > 0 ? Math.round(cleanSweeps / wins * 100) : 0);

  const decidingTotal = stats.decidingTotal || 0;
  const decidingWins = stats.decidingWins || 0;
  const decidingRate = stats.decidingWinRate || (decidingTotal > 0 ? Math.round(decidingWins / decidingTotal * 100) : 0);
  const bestStreak = stats.bestWinStreak || 0;

  return `
    <!-- Баланс матчей -->
    <div class="player-tab-section">
      <div class="player-tab-section-title">Баланс матчей</div>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-val stat-total">${total}</div>
          <div class="stat-lbl">Матчей</div>
        </div>
        <div class="stat-box">
          <div class="stat-val stat-wins">${wins}</div>
          <div class="stat-lbl">Побед</div>
        </div>
        <div class="stat-box">
          <div class="stat-val stat-losses">${losses}</div>
          <div class="stat-lbl">Пораж.</div>
        </div>
        <div class="stat-box">
          <div class="stat-val stat-rate">${winRate}%</div>
          <div class="stat-lbl">Винрейт</div>
        </div>
      </div>
      <div class="stat-bar-container" style="margin-top:12px;">
        <div class="stat-bar-track">
          <div class="stat-bar-fill win" style="width:${winRate}%;"></div>
        </div>
        <div class="stat-bar-labels">
          <span style="color:#059669; font-weight:600;">${wins} побед (${winRate}%)</span>
          <span style="color:#DC2626; font-weight:600;">${losses} поражений (${100 - winRate}%)</span>
        </div>
      </div>
    </div>

    <!-- Баланс партий (сетов) -->
    <div class="player-tab-section">
      <div class="player-tab-section-title">Баланс партий (сетов)</div>
      <div class="player-metric-row">
        <div class="player-metric-item">
          <div class="player-metric-val">${setsWon} : ${setsLost}</div>
          <div class="player-metric-lbl">Счёт по сетам</div>
        </div>
        <div class="player-metric-item">
          <div class="player-metric-val">${setsWinRate}%</div>
          <div class="player-metric-lbl">Винрейт сетов</div>
        </div>
      </div>
      <div class="stat-bar-container" style="margin-top:10px;">
        <div class="stat-bar-track">
          <div class="stat-bar-fill win" style="width:${setsWinRate}%;"></div>
        </div>
        <div class="stat-bar-labels">
          <span>Выиграно: ${setsWon}</span>
          <span>Проиграно: ${setsLost}</span>
        </div>
      </div>
    </div>

    <!-- Очки в партиях -->
    <div class="player-tab-section">
      <div class="player-tab-section-title">Очки в партиях</div>
      <div class="player-metric-row">
        <div class="player-metric-item">
          <div class="player-metric-val">${ptsWon} : ${ptsLost}</div>
          <div class="player-metric-lbl">Набрано / отдано</div>
        </div>
        <div class="player-metric-item">
          <div class="player-metric-val ${ptsDiffClass}">${ptsDiffSign}</div>
          <div class="player-metric-lbl">Дифференциал</div>
        </div>
        <div class="player-metric-item">
          <div class="player-metric-val">${avgPts}</div>
          <div class="player-metric-lbl">Среднее за сет</div>
        </div>
      </div>
    </div>

    <!-- Дополнительные показатели -->
    <div class="player-tab-section">
      <div class="player-tab-section-title">Показатели выступлений</div>
      <div class="player-metrics-grid">
        <div class="player-metric-card">
          <div class="metric-card-val">${cleanSweeps}</div>
          <div class="metric-card-title">Сухие победы</div>
          <div class="metric-card-desc">${cleanSweepsRate}% от побед (3:0 или 4:0)</div>
        </div>
        <div class="player-metric-card">
          <div class="metric-card-val">${decidingWins} / ${decidingTotal}</div>
          <div class="metric-card-title">Решающие сеты</div>
          <div class="metric-card-desc">${decidingRate}% побед в 5-х / 7-х партиях</div>
        </div>
        <div class="player-metric-card" style="grid-column: 1 / -1;">
          <div class="metric-card-val">${bestStreak}</div>
          <div class="metric-card-title">Лучшая серия побед</div>
          <div class="metric-card-desc">Максимальное количество побед подряд в истории</div>
        </div>
      </div>
    </div>
  `;
}

function getNounForm(number, one, two, five) {
  let n = Math.abs(number);
  n %= 100;
  if (n >= 5 && n <= 20) return five;
  n %= 10;
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return two;
  return five;
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

    let setsChips = '';
    (m.sets || []).forEach(s => {
      const chipWon = s.won === true;
      const chipClass = chipWon ? 'chip-win' : 'chip-loss';
      setsChips += `<span class="set-chip ${chipClass}">${s.player}:${s.opponent}</span>`;
    });

    html += `
      <div class="player-match-card ${cardClass}" onclick="openMatchDetail('${escapeHtml(m.id)}')">
        <div class="match-card-top">
          <div class="opp-name">vs ${escapeHtml(m.opponent?.name || 'Соперник')}</div>
          <div class="match-res-badge ${badgeClass}">${resText}</div>
        </div>

        <div class="sets-chips-row">
          ${setsChips || '<span style="font-size:11px; color:#9CA3AF;">Счёт по сетам не указан</span>'}
        </div>

        <div class="match-card-bottom">
          <div class="match-card-tourn">${escapeHtml(m.tournament || '-')}</div>
          <div>${escapeHtml(m.date || '-')}</div>
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

    if (currentPlayerData && currentPlayerData.matches) {
      currentPlayerData.matches = currentPlayerData.matches.concat(data.matches);
    }

    if (currentPlayerTab === 'matches') {
      renderPlayerTabContent('matches');
    }

    if (data.matches.length < 30) {
      playerMatchesDone = true;
      const b = document.getElementById('player-load-more-btn');
      if (b) b.style.display = 'none';
    }
  } catch (e) {
    if (btn) btn.textContent = 'Загрузить ещё матчи';
  }
}

// Modal functions
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

// Helper functions
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

// Initial setup on DOMContentLoaded
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
  initDarkMode();
  fetchMatches();

  // Auto-refresh every 30s only on feed view
  refreshTimer = setInterval(() => {
    if (currentView === 'feed') {
      fetchMatches();
    }
  }, 30000);
});
