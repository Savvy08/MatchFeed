#!/bin/bash

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
URL="http://127.0.0.1:8000"
PORT=8000
CONFIG_FILE="$SCRIPT_DIR/launcher_config.txt"
SERVER_PID_FILE="/tmp/matchfeed-php-server.pid"
TUNNEL_PID_FILE="/tmp/matchfeed-cloudflared.pid"
SERVER_LOG="/tmp/matchfeed-php-server.log"
TUNNEL_LOG="/tmp/matchfeed-cloudflared.log"
FAST_INPUT=1
PHP_CMD=""
PY_CMD=""
CF_KIND=""
CF_PATH=""

if [[ -f "$SCRIPT_DIR/api.php" ]]; then
  PROJECT_DIR="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/sources/api.php" ]]; then
  PROJECT_DIR="$SCRIPT_DIR/sources"
else
  echo "Ошибка: файл api.php не найден. Поместите run.command в папку MatchFeed."
  read -r -p "Нажмите Enter, чтобы закрыть окно..."
  exit 1
fi

[[ -f "$CONFIG_FILE" ]] && FAST_INPUT="$(head -n 1 "$CONFIG_FILE")"
[[ "$FAST_INPUT" == "0" ]] || FAST_INPUT=1

pause() { read -r -p "Нажмите Enter для возврата в меню..."; }

refresh_commands() {
  PHP_CMD=""; PY_CMD=""
  if command -v php >/dev/null 2>&1; then PHP_CMD="$(command -v php)"; elif [[ -x "$SCRIPT_DIR/php/bin/php" ]]; then PHP_CMD="$SCRIPT_DIR/php/bin/php"; fi
  for candidate in python3.12 python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then PY_CMD="$(command -v "$candidate")"; break; fi
  done
}

port_is_busy() { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; }
pid_is_running() { [[ -f "$1" ]] && kill -0 "$(cat "$1")" 2>/dev/null; }
server_is_ours() { pid_is_running "$SERVER_PID_FILE"; }

show_status() {
  if port_is_busy; then echo "  Сервер:  [РАБОТАЕТ] $URL"; else echo "  Сервер:  [ОСТАНОВЛЕН]"; fi
  if [[ -n "$PHP_CMD" ]]; then echo "  PHP:     [ГОТОВ К РАБОТЕ]"; else echo "  PHP:     [НЕ УСТАНОВЛЕН]"; fi
  if [[ -n "$PY_CMD" ]]; then echo "  Python:  [ГОТОВ К РАБОТЕ]"; else echo "  Python:  [НЕ УСТАНОВЛЕН]"; fi
}

read_choice() {
  REPLY=""
  if [[ "$FAST_INPUT" == "1" ]]; then read -r -n 1 -p "$1" REPLY; echo; else read -r -p "$1" REPLY; fi
}

install_homebrew() {
  command -v brew >/dev/null 2>&1 && return 0
  echo "Для установки компонентов нужен Homebrew."
  read -r -p "Установить Homebrew? [y/N]: " answer
  [[ "$answer" == "y" || "$answer" == "Y" ]] || return 1
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || return 1
  if [[ -x /opt/homebrew/bin/brew ]]; then eval "$(/opt/homebrew/bin/brew shellenv)"; elif [[ -x /usr/local/bin/brew ]]; then eval "$(/usr/local/bin/brew shellenv)"; fi
  command -v brew >/dev/null 2>&1
}

install_php() {
  [[ -n "$PHP_CMD" ]] && { echo "PHP уже установлен: $PHP_CMD"; return 0; }
  install_homebrew || return 1
  echo "Установка PHP..."; brew install php || return 1
  refresh_commands; [[ -n "$PHP_CMD" ]]
}

install_python() {
  [[ -n "$PY_CMD" ]] && { echo "Python уже установлен: $PY_CMD"; return 0; }
  install_homebrew || return 1
  echo "Установка Python 3.12..."; brew install python@3.12 || return 1
  refresh_commands; [[ -n "$PY_CMD" ]]
}

install_dependencies() {
  [[ -n "$PY_CMD" ]] || { echo "Ошибка: Python не найден. Используйте пункт 5."; return 1; }
  echo "Установка или обновление curl_cffi..."
  "$PY_CMD" -m pip install --upgrade pip && "$PY_CMD" -m pip install curl_cffi
}

dependencies_are_ready() { [[ -n "$PY_CMD" ]] && "$PY_CMD" -c "import curl_cffi" >/dev/null 2>&1; }

wait_for_server() {
  local attempt
  for attempt in {1..25}; do curl -fsS "$URL" >/dev/null 2>&1 && return 0; sleep 0.2; done
  return 1
}

start_server() {
  echo "[1/4] Проверка файлов проекта..."; [[ -f "$PROJECT_DIR/api.php" ]] || { echo "Ошибка: api.php не найден."; return 1; }
  echo "[2/4] Проверка PHP..."; [[ -n "$PHP_CMD" ]] || { echo "Ошибка: PHP не найден. Используйте пункт 5."; return 1; }
  echo "[3/4] Проверка Python..."; [[ -n "$PY_CMD" ]] || { echo "Ошибка: Python не найден. Используйте пункт 5."; return 1; }
  echo "[4/4] Проверка curl_cffi..."
  dependencies_are_ready || install_dependencies || { echo "Ошибка: не удалось установить curl_cffi."; return 1; }
  if port_is_busy; then
    if server_is_ours; then echo "Сервер MatchFeed уже запущен."; open "$URL"; return 0; fi
    echo "Ошибка: порт 8000 занят другой программой."; return 1
  fi
  echo "Запуск локального сервера PHP на порту 8000..."
  (cd "$PROJECT_DIR" && exec "$PHP_CMD" -S "127.0.0.1:$PORT") >"$SERVER_LOG" 2>&1 &
  echo $! >"$SERVER_PID_FILE"
  if wait_for_server; then open "$URL"; echo "MatchFeed запущен: $URL"; return 0; fi
  echo "Ошибка: сервер не запустился. Подробности: $SERVER_LOG"; rm -f "$SERVER_PID_FILE"; return 1
}

open_browser() { open "$URL" || echo "Не удалось передать ссылку браузеру: $URL"; }

stop_process_from_file() {
  local pid_file="$1"
  if pid_is_running "$pid_file"; then kill "$(cat "$pid_file")" 2>/dev/null; fi
  rm -f "$pid_file"
}

stop_server_and_tunnel() {
  echo "Остановка сервера MatchFeed и туннеля..."
  stop_process_from_file "$TUNNEL_PID_FILE"; stop_process_from_file "$SERVER_PID_FILE"
  echo "Сервер и онлайн-доступ остановлены."
}

find_cloudflared() {
  CF_KIND=""; CF_PATH=""
  if command -v cloudflared >/dev/null 2>&1; then CF_KIND="binary"; CF_PATH="$(command -v cloudflared)"
  elif [[ -x "$SCRIPT_DIR/cloudflared" ]]; then CF_KIND="binary"; CF_PATH="$SCRIPT_DIR/cloudflared"
  elif command -v npx >/dev/null 2>&1; then CF_KIND="npx"; fi
}

install_cloudflared() {
  find_cloudflared; [[ -n "$CF_KIND" ]] && return 0
  install_homebrew || return 1
  echo "Установка cloudflared..."; brew install cloudflared || return 1
  find_cloudflared; [[ -n "$CF_KIND" ]]
}

start_tunnel() {
  [[ -n "$PHP_CMD" ]] || { echo "Ошибка: сначала установите PHP через пункт 5."; return 1; }
  port_is_busy || start_server || return 1
  install_cloudflared || { echo "Ошибка: cloudflared не удалось установить."; return 1; }
  stop_process_from_file "$TUNNEL_PID_FILE"; : >"$TUNNEL_LOG"
  echo "Создаю онлайн-ссылку. Она появится ниже..."
  if [[ "$CF_KIND" == "binary" ]]; then
    "$CF_PATH" tunnel --url "$URL" >>"$TUNNEL_LOG" 2>&1 &
  else
    npx cloudflared tunnel --url "$URL" >>"$TUNNEL_LOG" 2>&1 &
  fi
  echo $! >"$TUNNEL_PID_FILE"
  local attempt tunnel_url
  for attempt in {1..30}; do
    tunnel_url="$(grep -Eo 'https://[^[:space:]]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -n 1 || true)"
    [[ -n "$tunnel_url" ]] && { echo "Онлайн-ссылка: $tunnel_url"; echo "Чтобы закрыть доступ, выберите пункт 4."; return 0; }
    sleep 0.5
  done
  echo "Туннель запущен. Ссылка появится в журнале: $TUNNEL_LOG"
}

install_menu() {
  while true; do
    clear; echo "======================================================"; echo "            Автоустановка компонентов"; echo "======================================================"
    echo "  [1] Установить всё: PHP + Python 3.12 + curl_cffi"; echo "  [2] Установить PHP"; echo "  [3] Установить Python 3.12"; echo "  [0] Назад"; echo
    read_choice "Выберите вариант [0-3]: "
    case "$REPLY" in
      1) install_php && install_python && install_dependencies; pause ;;
      2) install_php; pause ;;
      3) install_python && install_dependencies; pause ;;
      0) return ;;
      *) echo "Неверный ввод."; sleep 1 ;;
    esac
    refresh_commands
  done
}

toggle_input() { if [[ "$FAST_INPUT" == "1" ]]; then FAST_INPUT=0; else FAST_INPUT=1; fi; printf '%s\n' "$FAST_INPUT" >"$CONFIG_FILE"; }

while true; do
  refresh_commands; clear
  echo "======================================================"; echo "              MatchFeed - Меню управления"; echo "======================================================"; show_status
  echo "======================================================"
  echo "  [1] Запустить MatchFeed: сервер + браузер"; echo "  [2] Установить / проверить curl_cffi"; echo "  [3] Открыть сайт в браузере"; echo "  [4] Остановить сервер и онлайн-доступ"
  echo "  [5] Автоустановка окружения"; echo "  [6] Создать онлайн-ссылку"
  if [[ "$FAST_INPUT" == "1" ]]; then echo "  [7] Режим ввода: мгновенный"; else echo "  [7] Режим ввода: по Enter"; fi
  echo "  [0] Выход"; echo
  read_choice "Выберите действие [0-7]: "
  case "$REPLY" in
    1) clear; start_server; pause ;;
    2) clear; install_dependencies; pause ;;
    3) open_browser ;;
    4) clear; stop_server_and_tunnel; pause ;;
    5) install_menu ;;
    6) clear; start_tunnel; pause ;;
    7) toggle_input ;;
    0) exit 0 ;;
    *) echo "Неверный ввод."; sleep 1 ;;
  esac
done
