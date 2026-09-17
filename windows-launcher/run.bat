@echo off
chcp 65001 >nul
title MatchFeed Launcher (Windows)

:: Автоматический переход в корень проекта
if exist "%~dp0api.php" cd /d "%~dp0"
if exist "%~dp0..\api.php" cd /d "%~dp0.."

:: Режим ввода (1 - мгновенный выбор, 0 - по Enter)
set "FAST_INPUT=1"
if exist "%~dp0launcher_config.txt" set /p FAST_INPUT=<"%~dp0launcher_config.txt"

:menu
cls
set "PHP_CMD="
php -v >nul 2>&1
if not errorlevel 1 set "PHP_CMD=php"
if not defined PHP_CMD if exist "php\php.exe" set "PHP_CMD=php\php.exe"
if not defined PHP_CMD if exist "%~dp0php\php.exe" set "PHP_CMD=%~dp0php\php.exe"

set "PY_CMD="
python --version >nul 2>&1
if not errorlevel 1 set "PY_CMD=python"
if not defined PY_CMD py -3 --version >nul 2>&1
if not defined PY_CMD if not errorlevel 1 set "PY_CMD=py -3"
if not defined PY_CMD if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined PY_CMD if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"

echo ======================================================
echo               MatchFeed - Меню управления
echo ======================================================

netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 echo  Сервер:  [РАБОТАЕТ] http://127.0.0.1:8000
if errorlevel 1 echo  Сервер:  [ОСТАНОВЛЕН]

if defined PHP_CMD echo  PHP:     [ГОТОВ К РАБОТЕ]
if not defined PHP_CMD echo  PHP:     [НЕ УСТАНОВЛЕН]

if defined PY_CMD echo  Python:  [ГОТОВ К РАБОТЕ]
if not defined PY_CMD echo  Python:  [НЕ УСТАНОВЛЕН]

echo ======================================================
echo.
echo  [1] Запустить MatchFeed (сервер + браузер)
echo  [2] Установить / проверить библиотеки Python (curl_cffi)
echo  [3] Открыть сайт в браузере (http://127.0.0.1:8000)
echo  [4] Остановить сервер MatchFeed
echo  [5] Автоустановка окружения (скачать PHP 8 / Python 3.12)
echo  [6] Создать онлайн-ссылку [Для заказчика]
if "%FAST_INPUT%"=="1" echo  [7] Режим ввода: [Мгновенный - без Enter]  ^<-- нажми 7 для смены
if not "%FAST_INPUT%"=="1" echo  [7] Режим ввода: [По нажатию Enter]       ^<-- нажми 7 для смены
echo  [0] Выход
echo.
echo ======================================================

if "%FAST_INPUT%"=="1" goto fast_choice

set "choice="
set /p choice="Выберите действие [0-7] и нажмите Enter: "
if "%choice%"=="1" goto start_app
if "%choice%"=="2" goto install_deps
if "%choice%"=="3" goto open_browser
if "%choice%"=="4" goto stop_server
if "%choice%"=="5" goto menu_install
if "%choice%"=="6" goto start_tunnel
if "%choice%"=="7" goto toggle_input
if "%choice%"=="0" goto exit_app
echo.
echo Неверный ввод. Нажмите любую клавишу...
pause >nul
goto menu

:fast_choice
choice /c 12345670 /n /m "Выберите действие [0-7]: "
if errorlevel 8 goto exit_app
if errorlevel 7 goto toggle_input
if errorlevel 6 goto start_tunnel
if errorlevel 5 goto menu_install
if errorlevel 4 goto stop_server
if errorlevel 3 goto open_browser
if errorlevel 2 goto install_deps
if errorlevel 1 goto start_app
goto menu

:toggle_input
if "%FAST_INPUT%"=="1" goto set_slow
set "FAST_INPUT=1"
goto save_input
:set_slow
set "FAST_INPUT=0"
:save_input
> "%~dp0launcher_config.txt" echo %FAST_INPUT%
goto menu

:start_app
cls
echo [1/4] Проверка файлов проекта...
if exist "api.php" goto files_ok
echo.
echo [ОШИБКА] Файл api.php не найден!
echo Убедитесь, что батник находится в папке MatchFeed или windows-launcher.
echo.
pause
goto menu
:files_ok

echo [2/4] Проверка PHP...
if defined PHP_CMD goto php_ok
echo.
echo [ОШИБКА] PHP не найден в системе!
echo Вы можете установить его автоматически через пункт 5 меню.
echo.
pause
goto menu
:php_ok

echo [3/4] Проверка Python...
if defined PY_CMD goto python_ok
echo.
echo [ОШИБКА] Python не найден в системе!
echo Вы можете установить его автоматически через пункт 5 меню.
echo.
pause
goto menu
:python_ok

echo [4/4] Проверка библиотеки curl_cffi...
%PY_CMD% -c "import curl_cffi" >nul 2>&1
if not errorlevel 1 goto deps_ok
echo.
echo [ИНФО] Библиотека curl_cffi не найдена. Устанавливаю...
%PY_CMD% -m pip install --upgrade pip
%PY_CMD% -m pip install curl_cffi
%PY_CMD% -c "import curl_cffi" >nul 2>&1
if not errorlevel 1 goto deps_ok
echo.
echo [ОШИБКА] Не удалось установить curl_cffi.
echo Проверьте подключение к интернету или версию Python.
echo.
pause
goto menu
:deps_ok

echo.
echo Проверка порта 8000...
netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 goto run_server

tasklist /FI "WINDOWTITLE eq MatchFeed Server*" 2>nul | findstr /I "php.exe" >nul 2>&1
if not errorlevel 1 (
    echo [ИНФО] Сервер MatchFeed уже запущен на порту 8000.
    goto open_site
)
echo [ВНИМАНИЕ] Порт 8000 уже занят другой программой!
echo Остановите программу, занимающую порт 8000, или перезагрузитесь.
echo.
pause
goto menu

:run_server
echo Остановка старых процессов сервера (если были)...
taskkill /FI "WINDOWTITLE eq MatchFeed Server*" /F >nul 2>&1

echo Запуск локального сервера PHP на порту 8000...
start "MatchFeed Server" /min "%PHP_CMD%" -S 127.0.0.1:8000

timeout /t 2 /nobreak >nul

:open_site
echo Открытие браузера...
start http://127.0.0.1:8000

echo.
echo ======================================================
echo [УСПЕХ] MatchFeed запущен!
echo Адрес в браузере: http://127.0.0.1:8000
echo Сервер работает в фоновом режиме.
echo При изменении кода просто обновите страницу (Ctrl+F5).
echo ======================================================
echo.
pause
goto menu

:start_tunnel
cls
echo ======================================================
echo       Создание онлайн-ссылки [Для заказчика]
echo ======================================================
echo.

if defined PHP_CMD goto tunnel_php_ok
echo [ОШИБКА] Сначала установите PHP [пункт 5 меню].
echo.
pause
goto menu
:tunnel_php_ok

netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto tunnel_server_ok
echo [ИНФО] Сервер MatchFeed не запущен. Запускаю на порту 8000...
taskkill /FI "WINDOWTITLE eq MatchFeed Server*" /F >nul 2>&1
start "MatchFeed Server" /min "%PHP_CMD%" -S 127.0.0.1:8000
timeout /t 2 /nobreak >nul
:tunnel_server_ok

set "CF_BIN="
where cloudflared >nul 2>&1
if not errorlevel 1 set "CF_BIN=cloudflared"
if not defined CF_BIN if exist "cloudflared.exe" set "CF_BIN=cloudflared.exe"
if not defined CF_BIN if exist "%~dp0cloudflared.exe" set "CF_BIN=%~dp0cloudflared.exe"
if defined CF_BIN goto cf_bin_ready

where npx >nul 2>&1
if not errorlevel 1 set "CF_BIN=npx cloudflared"
if defined CF_BIN goto cf_bin_ready

echo [ИНФО] Утилита безопасного туннеля [cloudflared] не найдена.
echo Скачиваю официальный cloudflared.exe от Cloudflare...
curl.exe -L -# -o "%~dp0cloudflared.exe" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
if exist "%~dp0cloudflared.exe" goto cf_download_ok

echo.
echo [ОШИБКА] Не удалось скачать cloudflared.exe. Проверьте интернет.
echo.
pause
goto menu

:cf_download_ok
set "CF_BIN=%~dp0cloudflared.exe"
echo [УСПЕХ] Утилита скачана!

:cf_bin_ready
echo.
echo ======================================================
echo  Туннель запускается в отдельном окне!
echo.
echo  1. В открывшемся окне появится ссылка вида:
echo     https://xxxx-xxxx-xxxx.trycloudflare.com
echo.
echo  2. Скопируйте её и отправьте заказчику для проверки.
echo  3. Заказчик сможет открыть сайт со смартфона или ПК,
echo     а ваш исходный код остаётся в безопасности на вашем ПК.
echo.
echo  Чтобы закрыть доступ заказчику - просто закройте
echo  открывшееся окно туннеля или выберите пункт 4 в меню.
echo ======================================================
echo.

taskkill /FI "WINDOWTITLE eq MatchFeed Tunnel*" /F >nul 2>&1
start "MatchFeed Tunnel" cmd /k "%CF_BIN% tunnel --url http://127.0.0.1:8000"

pause
goto menu

:install_deps
cls
if defined PY_CMD goto python_deps_ready
echo [ОШИБКА] Python не найден. Сначала установите Python (пункт 5).
echo.
pause
goto menu
:python_deps_ready
echo Установка / обновление библиотеки curl_cffi...
%PY_CMD% -m pip install --upgrade pip
%PY_CMD% -m pip install curl_cffi
echo.
echo Готово. Нажмите любую клавишу для возврата в меню...
pause >nul
goto menu

:open_browser
start http://localhost:8000
goto menu

:stop_server
cls
echo Остановка сервера MatchFeed и туннелей...
taskkill /FI "WINDOWTITLE eq MatchFeed Server*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq MatchFeed Tunnel*" /F >nul 2>&1
echo Сервер и онлайн-доступ остановлены.
echo.
pause
goto menu

:menu_install
cls
echo ======================================================
echo             Автоустановка компонентов
echo ======================================================
echo.
echo  [1] Установить ВСЁ (PHP 8 + Python 3.12 + curl_cffi)
echo  [2] Скачать и настроить PHP 8 (портативный, в папку php)
echo  [3] Скачать и установить Python 3.12 (официальный с PATH)
echo  [0] Назад в главное меню
echo.
echo ======================================================
if "%FAST_INPUT%"=="1" goto fast_sub_choice

set "sub_choice="
set /p sub_choice="Выберите вариант [0-3] и нажмите Enter: "
if "%sub_choice%"=="1" goto install_all_manual
if "%sub_choice%"=="2" goto install_php_manual
if "%sub_choice%"=="3" goto install_python_manual
if "%sub_choice%"=="0" goto menu
goto menu_install

:fast_sub_choice
choice /c 1230 /n /m "Выберите вариант [0-3]: "
if errorlevel 4 goto menu
if errorlevel 3 goto install_python_manual
if errorlevel 2 goto install_php_manual
if errorlevel 1 goto install_all_manual
goto menu_install

:install_all_manual
cls
echo ======================================================
echo       Полная автоустановка всех компонентов
echo ======================================================
echo.
echo [1/3] Установка PHP 8...
call :do_install_php
echo.
echo [2/3] Установка Python 3.12...
call :do_install_python
echo.
echo [3/3] Установка библиотеки curl_cffi...
if defined PY_CMD (
    %PY_CMD% -m pip install --upgrade pip
    %PY_CMD% -m pip install curl_cffi
)
echo.
echo ======================================================
echo   Автоустановка завершена!
echo ======================================================
echo.
pause
goto menu

:install_php_manual
cls
call :do_install_php
echo.
pause
goto menu

:install_python_manual
cls
call :do_install_python
echo.
pause
goto menu

:do_install_php
echo Скачивание PHP 8.2 [портативный архив]...
curl.exe -L -# -o "%TEMP%\php_temp.zip" "https://windows.php.net/downloads/releases/archives/php-8.2.20-nts-Win32-vs16-x64.zip"
if exist "%TEMP%\php_temp.zip" goto php_dl_ok
echo [ОШИБКА] Не удалось скачать PHP. Проверьте соединение с интернетом.
exit /b 1

:php_dl_ok
echo Распаковка PHP в папку проекта [php\]...
if not exist "php" mkdir "php"
powershell -Command "Expand-Archive -Path '%TEMP%\php_temp.zip' -DestinationPath '.\php' -Force"
del /f /q "%TEMP%\php_temp.zip" >nul 2>&1

if exist "php\php.ini-development" if not exist "php\php.ini" copy /y "php\php.ini-development" "php\php.ini" >nul

if not exist "php\php.exe" goto php_fail
set "PHP_CMD=php\php.exe"
echo [УСПЕХ] PHP 8 установлен и готов к работе!
exit /b 0

:php_fail
echo [ОШИБКА] Не удалось настроить PHP.
exit /b 1

:do_install_python
echo Скачивание официального инсталлятора Python 3.12 [64-bit]...
curl.exe -L -# -o "%TEMP%\python_installer.exe" "https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe"
if exist "%TEMP%\python_installer.exe" goto py_dl_ok
echo [ОШИБКА] Не удалось скачать Python. Проверьте соединение с интернетом.
exit /b 1

:py_dl_ok
echo Установка Python [с добавлением в PATH]...
echo Процесс идёт в тихом режиме, пожалуйста, подождите...
"%TEMP%\python_installer.exe" /passive PrependPath=1 Include_test=0 Include_pip=1
del /f /q "%TEMP%\python_installer.exe" >nul 2>&1

:: Обновление путей текущей сессии
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts"

set "PY_CMD=python"
python --version >nul 2>&1
if not errorlevel 1 goto py_installed_ok

py -3 --version >nul 2>&1
if not errorlevel 1 set "PY_CMD=py -3"
if errorlevel 1 if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"

:py_installed_ok
if not defined PY_CMD goto py_install_warn
echo [УСПЕХ] Python успешно установлен!
echo Установка / проверка библиотеки curl_cffi...
%PY_CMD% -m pip install --upgrade pip
%PY_CMD% -m pip install curl_cffi
exit /b 0

:py_install_warn
echo [ВНИМАНИЕ] Установка завершена. Если команды не распознаются, перезапустите батник.
exit /b 0

:exit_app
echo Закрытие меню...
exit /b 0
