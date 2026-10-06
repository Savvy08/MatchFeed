<p align="center">
  <img
    src="https://github.com/user-attachments/assets/43ec4a36-bfc3-487a-bb56-8f0d1f3a1f92"
    alt="MatchFeed - Android APK & Web"
    width="800"
  />
</p>

-----

<p align="center">
  <a href="https://matchfeed.netlify.app/" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Сайт_проекта-MatchFeed_↗-00d084?style=for-the-badge&logo=googlechrome&logoColor=white&labelColor=2f363d" alt="Сайт проекта MatchFeed" />
  </a>
  <br />
  <sub>Нажмите на кнопку, чтобы открыть веб-версию</sub>
</p>





<p align="center">
  <img
    src="https://github.com/user-attachments/assets/28f9e944-dade-4766-8067-f5e09d7378ad"
    alt="MatchFeed - Android APK"
    width="800"
  />
</p>


-----

MatchFeed - приложение для отслеживания live-результатов и спортивной статистики. Поддерживает настольный теннис и футбол, подробную статистику матчей и игроков, H2H, форму, турнирные сетки, коэффициенты и другие данные SofaScore.

## Основной функционал

- **Live-лента** - события настольного тенниса и футбола с автоматическим обновлением каждые 30 секунд и звуковыми уведомлениями.
- **Карточка матча:**
  - **Обзор** - интерактивное голосование и коэффициенты букмекеров.
  - **H2H** - баланс побед и поражений, история личных встреч со счетом по сетам.
  - **Форма** - статистика побед, серии побед и последние игры.
  - **Сетка** - турнирное дерево плей-офф с парами участников.
  - **Медиа** - встроенные хайлайты матча и новости SofaScore.
- **Профиль игрока** - рейтинг, страна, физические данные, статистика побед и поражений и история матчей.
- **Избранное** - быстрый доступ к отслеживаемым матчам.
- **Интерфейс** - адаптивная верстка, темная и светлая темы, настройки и управление кэшем.

## Архитектура

- **Android:** SmartWebView 8, Android SDK 36, minSdk 24, Java 17.
- **Сетевой слой:** OkHttp 4.12.0 с прямым подключением к SofaScore и автоматическим переключением на резервные адреса при необходимости.
- **Frontend:** JavaScript (ES6+), HTML5, Vanilla CSS.
- **Web-режим:** локальный PHP 8.x + Python 3 (`curl_cffi`).

Android-приложение работает автономно и не требует запуска локального PHP/Python-сервера.

## Сборка Android APK

Сборка APK автоматизирована через GitHub Actions (`.github/workflows/build-apk.yml`).

- **Среда:** Ubuntu 24.04, JDK 17 (Temurin).
- **Команда:** `./gradlew assembleDebug --no-daemon`
- **Артефакт:** `MatchFeed-debug-apk` в разделе Actions.

### Локальная сборка

```bash
cd android
./gradlew assembleDebug
