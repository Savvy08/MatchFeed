<?php require_once __DIR__ . '/icons.php'; ?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MatchFeed - Live Scores & Статистика игроков</title>
  <link rel="stylesheet" href="style.css?v=<?= time() ?>">
</head>
<body>
  <div class="app-container">

    <!-- Шапка -->
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

    <!-- Баннер -->
    <div id="error-banner" class="banner hidden" role="alert">
      <div class="banner-content">
        <span class="banner-icon" aria-hidden="true"></span>
        <span class="banner-message"></span>
      </div>
      <button id="banner-retry-btn" class="banner-action-btn" type="button">Повторить</button>
    </div>

    <!-- Лента матчей -->
    <div id="feed-view" class="app-view">
      <!-- Выбор спорта -->
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

      <!-- Фильтры -->
      <div class="filter-pills">
        <button class="pill active" data-status="all">Все</button>
        <button class="pill" data-status="live">
          <span class="live-dot"></span>
          <span>Live</span>
        </button>
        <button class="pill" data-status="finished">Завершенные</button>
      </div>

      <!-- Список матчей -->
      <main class="feed-content">
        <div id="matches-container">
          <div class="feed-loader">Загрузка событий...</div>
        </div>
      </main>
    </div>

    <!-- Детали матча -->
    <div id="match-view" class="app-view hidden">
      <div class="view-sub-header">
        <button class="view-back-btn" onclick="navigateBack()" aria-label="Назад">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span>Назад</span>
        </button>
        <span id="match-view-header-title" class="view-header-title">Матчи</span>
        <div style="width: 72px;" aria-hidden="true"></div>
      </div>
      <div id="match-details-container" class="view-body">
        <div class="feed-loader">Загрузка данных матча...</div>
      </div>
    </div>

    <!-- Профиль игрока -->
    <div id="player-view" class="app-view hidden">
      <div class="view-sub-header">
        <button class="view-back-btn" onclick="navigateBack()" aria-label="Назад">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span id="player-back-label">Назад</span>
        </button>
        <span id="player-view-header-title" class="view-header-title">Профиль игрока</span>
        <div style="width: 72px;" aria-hidden="true"></div>
      </div>

      <!-- Поиск игрока -->
      <div class="player-search-bar">
        <div class="search-box">
          <svg class="search-box-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input id="player-search-input" class="player-search-input" type="search" placeholder="Поиск игрока (например, Fan Zhendong)..." autocomplete="off" oninput="onPlayerSearchInput(this.value)" />
        </div>
      </div>

      <!-- Результаты поиска -->
      <div id="player-search-results" class="player-search-dropdown hidden"></div>

      <!-- Контент профиля -->
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

    <!-- Настройки -->
    <div id="settings-view" class="app-view hidden">
      <div class="view-sub-header">
        <button class="view-back-btn" onclick="navigateBack()" aria-label="Назад">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span>Назад</span>
        </button>
        <span class="view-header-title">Настройки</span>
        <div style="width: 72px;" aria-hidden="true"></div>
      </div>

      <div class="view-body settings-view-body">
        <!-- Режим подключения -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div class="settings-card-title">Режим подключения</div>
            <div class="settings-card-desc">Выберите способ связи с серверами данных</div>
          </div>

                    <div class="connection-mode-group">
            <label class="mode-option" id="mode-opt-relay1">
              <input type="radio" name="conn_mode" value="relay1" checked onchange="handleConnectionModeChange(this.value)">
              <div class="mode-info">
                <div class="mode-title-row">
                  <span class="mode-title">Основной сервер</span>
                  <span class="mode-badge badge-rec">РЕКОМЕНДУЕТСЯ</span>
                </div>
                <div class="mode-desc">Автономный HTTPS-шлюз (работает на Ростелекоме без VPN)</div>
              </div>
            </label>

            <label class="mode-option" id="mode-opt-socks5">
              <input type="radio" name="conn_mode" value="socks5" onchange="handleConnectionModeChange(this.value)">
              <div class="mode-info">
                <div class="mode-title-row">
                  <span class="mode-title">SOCKS5 прокси</span>
                </div>
                <div class="mode-desc">Защищенный туннель (пользовательский прокси)</div>
              </div>
            </label>

            <label class="mode-option" id="mode-opt-http">
              <input type="radio" name="conn_mode" value="http" onchange="handleConnectionModeChange(this.value)">
              <div class="mode-info">
                <div class="mode-title-row">
                  <span class="mode-title">HTTP(S) прокси</span>
                </div>
                <div class="mode-desc">Подключение через HTTP/HTTPS прокси-сервер</div>
              </div>
            </label>

            <label class="mode-option" id="mode-opt-direct">
              <input type="radio" name="conn_mode" value="direct" onchange="handleConnectionModeChange(this.value)">
              <div class="mode-info">
                <div class="mode-title-row">
                  <span class="mode-title">Прямое подключение</span>
                </div>
                <div class="mode-desc">Прямой доступ к поставщикам данных (Cronet)</div>
              </div>
            </label>

            <label class="mode-option" id="mode-opt-auto">
              <input type="radio" name="conn_mode" value="auto" onchange="handleConnectionModeChange(this.value)">
              <div class="mode-info">
                <div class="mode-title-row">
                  <span class="mode-title">Автоматический выбор</span>
                </div>
                <div class="mode-desc">Оптимальный подбор лучшего канала связи</div>
              </div>
            </label>
          </div><!-- Пользовательский прокси -->
          <div class="settings-config-box">
            <div class="settings-sub-label">Пользовательский прокси-сервер</div>
            <div class="settings-input-group">
              <input type="text" id="custom-proxy-input" class="settings-input" placeholder="socks5://логин:пароль@ip:порт" onchange="handleCustomProxyChange(this.value)">
              <button class="settings-mini-btn" onclick="resetDefaultProxy()">Сброс</button>
            </div>
            <div class="settings-input-hint">Примеры: socks5://user:pass@host:port, http://user:pass@host:port или host:port</div>
          </div>

          <!-- Проверка соединения -->
          <div class="connection-test-row">
            <button id="test-connection-btn" class="settings-action-btn" onclick="testConnection()">Проверить соединение</button>
            <div id="connection-status-msg" class="connection-status-text"></div>
          </div>
        </div>

        <!-- Управление кэшем -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div class="settings-card-title">Управление кэшем</div>
            <div class="settings-card-desc">Хранение профилей, матчей и графики на устройстве</div>
          </div>

          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">Занято на устройстве</span>
              <span id="cache-size-display" class="settings-desc">Подсчет...</span>
            </div>
            <button id="clear-cache-btn" class="settings-action-btn" onclick="handleClearCache()">Очистить кэш</button>
          </div>

          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">Автоочистка кэша</span>
              <span class="settings-desc">Удалять устаревшие файлы автоматически</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="auto-clean-toggle" onchange="handleToggleAutoClean(this.checked)" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div id="cache-period-row" class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">Срок хранения кэша</span>
              <span class="settings-desc">Период перед удалением</span>
            </div>
            <select id="cache-period-select" class="settings-select" onchange="handleChangeCachePeriod(this.value)">
              <option value="7">7 дней</option>
              <option value="14">14 дней</option>
              <option value="21">21 день</option>
              <option value="30">30 дней</option>
            </select>
          </div>
        </div>

        <!-- О сервисе MatchFeed -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div class="settings-card-title">О сервисе MatchFeed</div>
          </div>
          <div class="modal-info-row">
            <span class="modal-info-label">Версия</span>
            <span class="modal-info-value">v2.1</span>
          </div>
          <div class="modal-info-row">
            <span class="modal-info-label">Источник данных</span>
            <span class="modal-info-value">SofaScore API</span>
          </div>
          <div class="modal-info-row">
            <span class="modal-info-label">Авто-обновление</span>
            <span class="modal-info-value">Каждые 30 секунд</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Нижнее меню -->
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
      <button class="nav-item" id="nav-settings-btn" onclick="openSettingsTab()" aria-label="Настройки">
        <?= getIcon('settings', ['size' => 20, 'class' => 'nav-icon']) ?>
        <span>Настройки</span>
      </button>
    </nav>


  </div>

  <script src="app.js?v=<?= time() ?>"></script>
</body>
</html>
