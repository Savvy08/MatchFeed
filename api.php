<?php

/**
 * MatchFeed API
 * Direct Sofascore access via sofascore_api.py (TLS impersonation)
 * Multi-sport: Table Tennis (default), Football, Tennis.
 * Features: Live matches, Player search, Player profile & stats, Match details.
 */

require_once __DIR__ . '/Cache.php';

$cacheDir = dirname(__DIR__) . '/cache';

try {
    $cache = new Cache($cacheDir);
} catch (Exception $e) {
    error_log("Cache init error: ". $e->getMessage());
    $cache = null;
}

$uri = parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if ($uri && str_starts_with(strtolower($uri), '/cache/')) {
    http_response_code(403);
    echo json_encode(['error' => 'Access denied']);
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$action = strtolower(trim($_GET['action'] ?? 'live'));

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

// ─── ACTION: LIVE ─────────────────────────────────────────────────────────────
if ($action === 'live') {
    $sport = strtolower(trim($_GET['sport'] ?? 'table-tennis'));
    if (!in_array($sport, ['table-tennis', 'football', 'tennis'])) {
        $sport = 'table-tennis';
    }

    $cacheKey = "live_{$sport}";
    $cached = null;

    if ($cache instanceof Cache) {
        $cached = $cache->get($cacheKey,15);
    }

    if ($cached) {
        echo json_encode($cached, JSON_UNESCAPED_UNICODE);
        exit;
    }

    $data = runPython(['live', $sport]);
    if (!empty($data['success'])) {
        if ($cache instanceof Cache) {
            $cache->set($cacheKey, $data);
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Return stale cache if available
    $stale = null;
    if ($cache instanceof Cache) {
        $stale = $cache->get($cacheKey, 3600);
    }

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
    $qRaw = $_GET['q'] ?? '';

    $q = mb_substr(trim($qRaw),0,50);

    $q = preg_replace('/[^A-Za-zA-Яа-яЁё0-9\s\-\']/u', '', $q);

    if (mb_strlen($q) < 2) {
        echo json_encode(['success' => false, 'players' => [], 'warning' => 'Слишком короткий или пустой запрос'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $cacheKey = 'search_' . mb_strtolower($q);
    $cached = null;

    if ($cache instanceof Cache) {
        $cached = $cache->get($cacheKey,300);
    }

    if ($cached) {
        echo json_encode($cached, JSON_UNESCAPED_UNICODE);
        exit;
    }

    $data = runPython(['search', $q]);
    if (!empty($data['success'])) {
        if($cache instanceof Cache) {
            $cache->set($cacheKey,$data);
        }
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
    $cached = null;

    if ($cache instanceof Cache) {
        $cached = $cache->get($cacheKey,180);
    }

    if ($cached) {
        echo json_encode($cached, JSON_UNESCAPED_UNICODE);
        exit;
    }

    $data = runPython(['player', (string)$id, (string)$page]);
    if (!empty($data['success'])) {
        if ($cache instanceof Cache) {
            $cache->set($cacheKey,$data);
        }
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
    $cached = null;

    if ($cache instanceof Cache) {
        $cached = $cache->get($cacheKey,10);
    }

    if ($cached) {
        echo json_encode($cached, JSON_UNESCAPED_UNICODE);
        exit;
    }

    $data = runPython(['event', (string)$id]);
    if (!empty($data['success'])) {
        if ($cache instanceof Cache) {
            $cache->set($cacheKey,$data);
        }
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Fallback
echo json_encode(['success' => false, 'error' => 'Неизвестное действие']);
