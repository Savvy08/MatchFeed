# MatchFeed - Live Scores и статистика игроков

Мобильное веб-приложение спортивной ленты для настольного тенниса и футбола с прямым получением данных из SofaScore API.
## Возможности

- Live-лента событий, с автоматическим обновлением каждые 30 секунд.
- Сортировка матчей
- Сеты
- Поиск и профиль игрока
- Быстрый доступ к избранным матчам с локальным сохранением в браузере (`localStorage`).
- Звуковое уведомление о важных событиях через Web Audio API (без внешних аудиофайлов).
- Прямой обход TLS-отпечатков Cloudflare через Python `curl_cffi` (impersonate Chrome)
- Двухуровневое локальное кэширование на стороне PHP.

## Стек технологий

- Frontend: чистый JavaScript (ES6+), HTML5, CSS3 (Mobile-first, без зависимостей).
- Backend: PHP 8.x + локальный парсер на Python 3 (`curl_cffi`).

## Требования

- PHP 8.0+
- Python 3.10+ с библиотекой `curl_cffi`:
  ```bash
  pip3 install curl_cffi
  ```

## Локальный запуск

1. Склонируйте репозиторий:
   ```bash
   git clone https://github.com/Savvy08/MatchFeed.git
   cd MatchFeed
   ```

2. Установите зависимость Python (если еще не установлена):
   ```bash
   pip3 install curl_cffi
   ```

3. Запустите встроенный PHP-сервер:
   ```bash
   PHP_CLI_SERVER_WORKERS=4 php -S "[::]:8000"
   ```

4. Откройте в браузере: `http://localhost:8000` (или `http://127.0.0.1:8000`).
