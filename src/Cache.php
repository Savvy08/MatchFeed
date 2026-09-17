<?php
Class Cache {
    private string $dir;

    public function __construct(string $dir)
    {
        this ->dir= rtrim($dir,'/\\');
        if (!is_dir($this->dir)) {
            mkdir($this->dir,0777,true);
        }
    }

    public function get (string $key, int $ttl) : ? array
    {
        $file = $this->path($key);
        if (!file_exists($file)) return null;

        $age = time() - filemtime($file);
        if ($age >= $ttl) return null;

        $data = json_decode(file_get_contents($file),true);
        if (!is_array($data))return null;

        $data['cached'] = true;
        $data['cacheAge'] = $age;
        return $data;
    }

    public function path(string $key): string
    {
        return $this->dir . DIRECTORY_SEPARATOR . md5($key) . '.json';
    }
}