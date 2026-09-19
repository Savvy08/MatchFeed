# План реализации автономного Android APK (MatchFeed)

## 1. Архитектурное решение

Приложение реализуется как автономная нативная оболочка Android (Kotlin) со встроенным WebView и сетевым стеком Cronet (Chromium Network Stack).

Ключевая особенность: использование метода WebViewClient.shouldInterceptRequest(). 
Вместо ручного связывания через @JavascriptInterface, Android перехватывает все сетевые вызовы fetch() из веб-интерфейса, выполняет их через нативный Cronet с подлинным TLS-отпечатком Chrome и возвращает WebResourceResponse. Это исключает блокировки Cloudflare и сохраняет код фронтенда (app.js) без изменений.

## 2. Репозитории на GitHub

1. Готовая полнофункциональная оболочка WebView для упаковки веб-проектов в APK:
- Ссылка: https://github.com/mgks/Android-SmartWebView - предпочтительно!!!
- Официальный эталон от команды Android (Google): https://github.com/android/views-widgets-samples/tree/main/WebViewSamples (современный WebViewAssetLoader на Kotlin)

2. Официальный сетевой стек Chromium от Google (Cronet):
- Ссылка: https://github.com/google/cronet-samples (для обхода защиты SofaScore через нативный TLS-отпечаток Chrome)



## 3. Пошаговый план реализации (на базе Android-SmartWebView)

### Этап 1. Развертывание базового репозитория
- Клонировать репозиторий Android-SmartWebView в рабочую папку.
- Удалить неиспользуемые модули (Firebase, AdMob, геолокация, доступ к камере), оставив чистый полноэкранный WebView с локальным кэшированием.
- Добавить зависимость org.chromium.net:cronet-embedded в build.gradle для сетевого стека Chromium.

### Этап 2. Перенос интерфейса MatchFeed
- Скопировать файлы веб-интерфейса (index.html, style.css, app.js и папку с иконками/звуками) в директорию app/src/main/assets/.
- В конфигурации SmartWebView указать стартовый локальный адрес: file:///android_asset/index.html.

### Этап 3. Интеграция перехвата сетевых запросов (Cronet)
- Добавить компактный класс инициализации Google Cronet для отправки запросов с подлинным TLS-отпечатком Chrome.
- В существующий WebViewClient внутри SmartWebView добавить метод shouldInterceptRequest:
  - При сетевом запросе к API (/api/live, /api/match и т.д.) перенаправлять его в Cronet с нужными заголовками SofaScore.
  - Возвращать полученный ответ обратно в страницу через WebResourceResponse.
  - Оставить код app.js без изменений.

### Этап 4. Сборка APK
- Выполнить сборку готового APK в терминале: ./gradlew assembleDebug (без запуска интерфейса Android Studio).
- Проверить работоспособность APK на Android-устройстве по Wi-Fi и мобильной сети.

