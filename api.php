<?php
/**
 * MatchFeed API
 * Direct Sofascore access via sofascore_api.py (TLS impersonation)
 * Multi-sport: Table Tennis (default), Football, Tennis.
 * Features: Live matches, Player search, Player profile & stats, Match details.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$action = strtolower(trim($_GET['action'] ?? 'live'));
$cacheDir = __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0777, true);
}

function findPythonBinary(): string {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    if (PHP_OS_FAMILY !== 'Windows') {
        $test = @shell_exec('python3 --version 2>&1');
        if ($test && stripos($test, 'Python') !== false) {
            return $cached = 'python3';
        }
        return $cached = 'python';
    }

    $candidates = [
        'python',
        'py -3',
        getenv('LOCALAPPDATA') ? getenv('LOCALAPPDATA') . '\\Programs\\Python\\Python312\\python.exe' : null,
        getenv('LOCALAPPDATA') ? getenv('LOCALAPPDATA') . '\\Programs\\Python\\Python311\\python.exe' : null,
        getenv('LOCALAPPDATA') ? getenv('LOCALAPPDATA') . '\\Programs\\Python\\Python310\\python.exe' : null,
        'C:\\Python312\\python.exe',
        'C:\\Python311\\python.exe',
        'py'
    ];

    foreach ($candidates as $bin) {
        if (!$bin) continue;
        if (strpos($bin, '\\') !== false && !file_exists($bin)) {
            continue;
        }
        $testCmd = (strpos($bin, ' ') !== false && strpos($bin, 'py -') === false ? escapeshellarg($bin) : $bin) . ' --version 2>&1';
        $testOut = @shell_exec($testCmd);
        if ($testOut && stripos($testOut, 'Python ') !== false && stripos($testOut, 'was not found') === false) {
            return $cached = (strpos($bin, ' ') !== false && strpos($bin, 'py -') === false) ? escapeshellarg($bin) : $bin;
        }
    }

    return $cached = 'python';
}

function runPython(array $args): array {
    $pyBin = findPythonBinary();
    $script = __DIR__ . DIRECTORY_SEPARATOR . 'sofascore_api.py';
    $cmdArgs = array_map('escapeshellarg', $args);
    $cmd = $pyBin . ' ' . escapeshellarg($script) . ' ' . implode(' ', $cmdArgs);

    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'], // stdout
        2 => ['pipe', 'w']  // stderr
    ];

    $env = array_merge($_ENV, [
        'PYTHONIOENCODING' => 'utf-8',
        'PYTHONUTF8' => '1',
        'SYSTEMROOT' => getenv('SYSTEMROOT') ?: 'C:\\Windows',
        'PATH' => getenv('PATH') ?: ''
    ]);

    $process = @proc_open($cmd, $descriptors, $pipes, __DIR__, $env);
    if (!is_resource($process)) {
        return ['success' => false, 'error' => "Не удалось запустить процесс: {$pyBin}"];
    }

    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[2]);

    $exitCode = proc_close($process);

    $stdout = trim((string)$stdout);
    $stderr = trim((string)$stderr);

    $start = strpos($stdout, '{');
    $end = strrpos($stdout, '}');
    if ($start !== false && $end !== false && $end >= $start) {
        $jsonStr = substr($stdout, $start, $end - $start + 1);
        $data = json_decode($jsonStr, true);
        if (is_array($data)) {
            return $data;
        }
    }

    $errorMsg = 'Не удалось получить данные от Sofascore';
    if ($stderr !== '') {
        if (stripos($stderr, 'No module named') !== false) {
            $errorMsg = 'Не установлена библиотека Python: ' . trim($stderr);
        } elseif (stripos($stderr, 'not recognized') !== false || stripos($stderr, 'was not found') !== false) {
            $errorMsg = 'Python не найден в системе. Установите Python 3 и curl_cffi.';
        } else {
            $errorMsg = 'Ошибка Python: ' . mb_substr(trim($stderr), 0, 300);
        }
    } elseif ($stdout !== '') {
        $errorMsg = 'Некорректный ответ скрипта: ' . mb_substr($stdout, 0, 200);
    }

    return [
        'success' => false,
        'error' => $errorMsg,
        'exitCode' => $exitCode,
        'raw_stdout' => substr($stdout, 0, 200),
        'raw_stderr' => substr($stderr, 0, 200)
    ];
}

function getCache(string $key, int $ttl): ?array {
    global $cacheDir;
    $file = $cacheDir . '/' . md5($key) . '.json';
    if (file_exists($file)) {
        $age = time() - (filemtime($file) ?: 0);
        if ($age < $ttl) {
            $raw = @file_get_contents($file);
            $json = json_decode($raw, true);
            if (is_array($json)) {
                $json['cached'] = true;
                $json['cacheAge'] = $age;
                return $json;
            }
        }
    }
    return null;
}

function setCache(string $key, array $data): void {
    global $cacheDir;
    $file = $cacheDir . '/' . md5($key) . '.json';
    @file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE));
}

// ─── ACTION: IMAGE ────────────────────────────────────────────────────────────
if ($action === 'image') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(404);
        exit;
    }

    $imgDir = __DIR__ . '/cache/images';
    if (!is_dir($imgDir)) {
        @mkdir($imgDir, 0777, true);
    }

    $cacheFile = "{$imgDir}/{$id}.png";
    if (file_exists($cacheFile) && filesize($cacheFile) > 0 && (time() - filemtime($cacheFile) < 86400 * 7)) {
        header('Content-Type: image/png');
        header('Cache-Control: public, max-age=604800');
        readfile($cacheFile);
        exit;
    }

    $remoteUrl = "https://img.sofascore.com/api/v1/team/{$id}/image";
    $imgData = null;
    $contentType = 'image/png';

    if (function_exists('curl_init')) {
        $ch = curl_init($remoteUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        $imgData = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $cType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        if ($cType) $contentType = $cType;
        curl_close($ch);
        if ($code !== 200) $imgData = null;
    }

    if (!$imgData) {
        $ctx = stream_context_create([
            'http' => [
                'timeout' => 5,
                'header' => "User-Agent: Mozilla/5.0\r\n"
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false
            ]
        ]);
        $imgData = @file_get_contents($remoteUrl, false, $ctx);
    }

    if (!$imgData) {
        runPython(['image', (string)$id, $cacheFile]);
        if (file_exists($cacheFile) && filesize($cacheFile) > 0) {
            header('Content-Type: image/png');
            header('Cache-Control: public, max-age=604800');
            readfile($cacheFile);
            exit;
        }
    }

    if ($imgData && strlen($imgData) > 0) {
        @file_put_contents($cacheFile, $imgData);
        header('Content-Type: ' . $contentType);
        header('Cache-Control: public, max-age=604800');
        echo $imgData;
        exit;
    }

    // Default SVG fallback avatar
    header('Content-Type: image/svg+xml');
    echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="#9CA3AF"><circle cx="24" cy="24" r="24" fill="#E5E7EB"/><path d="M24 23a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 4c-6.67 0-14 3.33-14 10v1h28v-1c0-6.67-7.33-10-14-10z"/></svg>';
    exit;
}

// ─── ACTION: LIVE ─────────────────────────────────────────────────────────────
if ($action === 'live') {
    $sport = strtolower(trim($_GET['sport'] ?? 'table-tennis'));
    if (!in_array($sport, ['table-tennis', 'football', 'tennis'])) {
        $sport = 'table-tennis';
    }

    $cacheKey = "live_{$sport}";
    $cached = getCache($cacheKey, 15);
    if ($cached) {
        echo json_encode($cached, JSON_UNESCAPED_UNICODE);
        exit;
    }

    $data = runPython(['live', $sport]);
    if (!empty($data['success'])) {
        setCache($cacheKey, $data);
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Return stale cache if available
    $stale = getCache($cacheKey, 3600);
    if ($stale) {
        $stale['warning'] = 'Данные из кэша';
        echo json_encode($stale, JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ─── ACTION: SEARCH ───────────────────────────────────────────────────────────
if ($action === 'search') {
    $q = trim($_GET['q'] ?? '');
    $qLen = function_exists('mb_strlen') ? mb_strlen($q) : strlen($q);
    if ($qLen < 2) {
        echo json_encode(['success' => false, 'players' => []], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $qLower = function_exists('mb_strtolower') ? mb_strtolower($q) : strtolower($q);
    $cacheKey = "search_" . $qLower;
    $cached = getCache($cacheKey, 300);
    if ($cached) {
        echo json_encode($cached, JSON_UNESCAPED_UNICODE);
        exit;
    }

    $data = runPython(['search', $q]);
    if (!empty($data['success'])) {
        setCache($cacheKey, $data);
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ─── ACTION: PLAYER ───────────────────────────────────────────────────────────
if ($action === 'player' || $action === 'history') {
    $id = (int)($_GET['id'] ?? 0);
    $page = max(0, (int)($_GET['page'] ?? 0));

    if ($id <= 0) {
        echo json_encode(['success' => false, 'error' => 'Не указан ID игрока'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $cacheKey = "player_{$id}_{$page}";
    $cached = getCache($cacheKey, 180);
    if ($cached) {
        echo json_encode($cached, JSON_UNESCAPED_UNICODE);
        exit;
    }

    $data = runPython(['player', (string)$id, (string)$page]);
    if (!empty($data['success'])) {
        setCache($cacheKey, $data);
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ─── ACTION: EVENT (MATCH DETAILS) ────────────────────────────────────────────
if ($action === 'event' || $action === 'match') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        echo json_encode(['success' => false, 'error' => 'Не указан ID события'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $cacheKey = "event_{$id}";
    $cached = getCache($cacheKey, 10);
    if ($cached) {
        echo json_encode($cached, JSON_UNESCAPED_UNICODE);
        exit;
    }

    $data = runPython(['event', (string)$id]);
    if (!empty($data['success'])) {
        $ttl = (!empty($data['isLive'])) ? 10 : 600;
        setCache($cacheKey, $data);
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Fallback
echo json_encode(['success' => false, 'error' => 'Неизвестное действие']);
