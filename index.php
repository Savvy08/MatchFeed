<?php require_once __DIR__ . '/icons.php'; ?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MatchFeed — Live Scores & Статистика игроков</title>
  <link rel="stylesheet" href="style.css?v=<?= time() ?>">
</head>
<body>
  <div class="app-container">

    <!-- Global App Header -->
    <header class="app-header">
      <div class="brand" onclick="openMatchesFeed()" style="cursor: pointer;">
        <div class="logo-badge" aria-hidden="true">
          <?= getIcon('trophy', ['size' => 16]) ?>
        </div>
        <span class="brand-title">MatchFeed</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button id="theme-toggle-btn" class="theme-toggle-btn" onclick="toggleDarkMode()" aria-label="Сменить тему" title="Тёмная/светлая тема">
          <svg id="theme-icon-moon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          <svg id="theme-icon-sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        </button>
        <button id="refresh-btn" class="refresh-btn" aria-label="Обновить счёт">
          <?= getIcon('refresh', ['size' => 14, 'class' => 'icon-refresh']) ?>
          <span class="refresh-text">Обновить</span>
        </button>
      </div>
    </header>

    <!-- Error/Warning Banner -->
    <div id="error-banner" class="banner hidden" role="alert">
      <div class="banner-content">
        <span class="banner-icon" aria-hidden="true"></span>
        <span class="banner-message"></span>
      </div>
      <button id="banner-retry-btn" class="banner-action-btn" type="button">Повторить</button>
    </div>

    <!-- ══ VIEW 1: MATCH FEED ══ -->
    <div id="feed-view" class="app-view">
      <!-- Sport Selector -->
      <div class="sub-nav">
        <div class="sport-tabs">
          <button class="sport-tab active" data-sport="table-tennis">
            <?= getIcon('tennis', ['size' => 15]) ?>
            <span>Настольный теннис</span>
          </button>
          <button class="sport-tab" data-sport="football">
            <?= getIcon('football', ['size' => 15]) ?>
            <span>Футбол</span>
          </button>
        </div>
      </div>

      <!-- Status Filters -->
      <div class="filter-pills">
        <button class="pill active" data-status="all">Все</button>
        <button class="pill" data-status="live">
          <span class="live-dot"></span>
          <span>Live</span>
        </button>
        <button class="pill" data-status="finished">Завершенные</button>
      </div>

      <!-- Feed Content -->
      <main class="feed-content">
        <div id="matches-container">
          <div class="feed-loader">Загрузка событий...</div>
        </div>
      </main>
    </div>

    <!-- ══ VIEW 2: MATCH DETAILS ══ -->
    <div id="match-view" class="app-view hidden">
      <div class="view-sub-header">
        <button class="view-back-btn" onclick="showView('feed')" aria-label="Назад к матчам">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span>Матчи</span>
        </button>
        <span id="match-view-header-title" class="view-header-title">Детали матча</span>
      </div>
      <div id="match-details-container" class="view-body">
        <div class="feed-loader">Загрузка данных матча...</div>
      </div>
    </div>

    <!-- ══ VIEW 3: PLAYER PROFILE & STATS ══ -->
    <div id="player-view" class="app-view hidden">
      <div class="view-sub-header">
        <button class="view-back-btn" onclick="goBackFromPlayer()" aria-label="Назад">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span id="player-back-label">Назад</span>
        </button>
        <span id="player-view-header-title" class="view-header-title">Профиль игрока</span>
      </div>

      <!-- Light search bar -->
      <div class="player-search-bar">
        <div class="search-box">
          <svg class="search-box-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input id="player-search-input" class="player-search-input" type="search" placeholder="Поиск игрока (например, Fan Zhendong)..." autocomplete="off" oninput="onPlayerSearchInput(this.value)" />
        </div>
      </div>

      <!-- Search results -->
      <div id="player-search-results" class="player-search-dropdown hidden"></div>

      <!-- Player Content: profile, statistics, match history -->
      <div id="player-view-content" class="view-body">
        <div class="player-empty-prompt">
          <div class="empty-state-icon">
            <?= getIcon('person', ['size' => 32]) ?>
          </div>
          <div class="empty-state-title">Поиск игрока</div>
          <div class="empty-state-desc">Введите имя игрока в строке поиска или нажмите на имя в любом матче.</div>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation Bar -->
    <nav class="bottom-bar">
      <button class="nav-item active" id="nav-matches-btn" onclick="openMatchesFeed()" aria-label="Матчи">
        <?= getIcon('list', ['size' => 20, 'class' => 'nav-icon']) ?>
        <span>Матчи</span>
      </button>
      <button class="nav-item" id="nav-favs-btn" onclick="showFavorites()" aria-label="Избранное">
        <?= getIcon('star', ['size' => 20, 'class' => 'nav-icon']) ?>
        <span>Избранное</span>
      </button>
      <button class="nav-item" id="nav-player-btn" onclick="openPlayerTab()" aria-label="Поиск игрока">
        <?= getIcon('person', ['size' => 20, 'class' => 'nav-icon']) ?>
        <span>Игрок</span>
      </button>
      <button class="nav-item" onclick="openInfoModal()" aria-label="Информация о сервисе">
        <?= getIcon('info', ['size' => 20, 'class' => 'nav-icon']) ?>
        <span>Инфо</span>
      </button>
    </nav>

    <!-- Info Modal -->
    <div id="info-modal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="info-modal-title" onclick="handleBackdropClick(event)">
      <div class="modal-card">
        <div class="modal-header">
          <span id="info-modal-title" class="modal-title">О сервисе MatchFeed</span>
          <button class="modal-close-btn" onclick="closeInfoModal()" aria-label="Закрыть">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="modal-info-row">
            <span class="modal-info-label">Версия</span>
            <span class="modal-info-value">v2.0</span>
          </div>
          <div class="modal-info-row">
            <span class="modal-info-label">Источник данных</span>
            <span class="modal-info-value">SofaScore</span>
          </div>
          <div class="modal-info-row">
            <span class="modal-info-label">Авто-обновление</span>
            <span class="modal-info-value">Каждые 30 секунд</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn-close" onclick="closeInfoModal()">Закрыть</button>
        </div>
      </div>
    </div>

  </div>

  <script src="app.js?v=<?= time() ?>"></script>
</body>
</html>
