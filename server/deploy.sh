#!/bin/bash
set -e

echo "=== Установка MatchFeed Relay ==="

# 1. Проверка Python3 и pip
apt-get update -qq
apt-get install -y python3 python3-pip python3-venv

# 2. Создание папки
mkdir -p /opt/matchfeed-relay
cp server_relay.py /opt/matchfeed-relay/server_relay.py

# 3. Установка зависимости
pip3 install --break-system-packages curl_cffi || pip3 install curl_cffi

# 4. Установка systemd службы
cp matchfeed-relay.service /etc/systemd/system/matchfeed-relay.service
systemctl daemon-reload
systemctl enable matchfeed-relay
systemctl restart matchfeed-relay

echo "=== Служба запущена! Проверка статуса: ==="
systemctl status matchfeed-relay --no-pager

echo ""
echo "=== Тест локального ответа: ==="
curl -s http://127.0.0.1:8089/health
echo ""
echo "Готово! Не забудьте подключить nginx-snippet.conf в конфигурацию вашего сайта."
