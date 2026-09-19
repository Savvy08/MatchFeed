<?php

class Cache
{
    private string $dir;

    public function __construct(string $dir)
    {
        $this->dir = rtrim($dir, '/\\');

        if (!is_dir($this->dir)) {
            if (!mkdir($this->dir, 0755, true)) {
                throw new RuntimeException("Не удалось создать директорию кэша: $this->dir");
            }
        }

        $realDir = realpath($this->dir);
        if ($realDir === false) {
            throw new RuntimeException("Не удалось получить реальный путь к кэшу: $this->dir");
        }
        $this->dir = $realDir;
    }

    public function get(string $key, int $ttl): ?array
    {
        $file = $this->path($key);

        if (!file_exists($file)) {
            return null;
        }

        $realFile = realpath($file);
        if ($realFile === false || strpos($realFile, $this->dir) !== 0) {
            error_log("Security alert: Cache file outside allowed directory: $file");
            return null;
        }

        $age = time() - filemtime($file);
        if ($age >= $ttl) {
            return null;
        }

        $raw = @file_get_contents($file);
        if ($raw === false) {
            return null;
        }

        $data = json_decode($raw, true);
        if (!is_array($data)) {
            return null;
        }

        $data['cached'] = true;
        $data['cacheAge'] = $age;
        return $data;
    }

    public function set(string $key, array $data): bool
    {
        $file = $this->path($key);
        
        $fileName = basename($file);
        if ($fileName !== md5($key) . '.json') {
            error_log("Security alert: Invalid filename generated for key: $key");
            return false;
        }

        $result = @file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE));
        return $result !== false;
    }

    private function path(string $key): string
    {
        return $this->dir . DIRECTORY_SEPARATOR . md5($key) . '.json';
    }
}