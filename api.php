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

function runPython(array $args): array {
    $script = escapeshellarg(__DIR__ . '/sofascore_api.py');
    $cmdArgs = array_map('escapeshellarg', $args);

    $isWin = (PHP_OS_FAMILY === 'Windows');
    $pyBin = $isWin ? 'python' : 'python3';
    $devNull = $isWin ? '2>nul' : '2>/dev/null';

    // Suppress stderr to avoid environment/zsh warnings contaminating output
    $cmd = $pyBin . ' ' . $script . ' ' . implode(' ', $cmdArgs) . ' ' . $devNull;
    $out = trim((string)shell_exec($cmd));

    $start = strpos($out, '{');
    $end = strrpos($out, '}');
    if ($start !== false && $end !== false && $end >= $start) {
        $jsonStr = substr($out, $start, $end - $start + 1);
        $data = json_decode($jsonStr, true);
        if (is_array($data)) {
            return $data;
        }
    }

    return ['success' => false, 'error' => 'Не удалось разобрать ответ сервера', 'raw' => substr($out, 0, 200)];
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
    if (mb_strlen($q) < 2) {
        echo json_encode(['success' => false, 'players' => []], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $cacheKey = "search_" . mb_strtolower($q);
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
