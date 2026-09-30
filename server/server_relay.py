#!/usr/bin/env python3
"""
MatchFeed Server Relay
Ultra-lightweight high-performance HTTP proxy relay for SofaScore API with Chrome 124 TLS impersonation.
Designed to run on VPS alongside 3x-ui without conflicts.
"""

import sys
import os
import time
import json
import argparse
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import threading

try:
    from curl_cffi import requests
except ImportError:
    print("ERROR: curl_cffi is required. Run: pip install curl_cffi")
    sys.exit(1)

# Configuration
DEFAULT_PORT = int(os.environ.get("MATCHFEED_PORT", 8089))
DEFAULT_HOST = os.environ.get("MATCHFEED_HOST", "0.0.0.0")

SESSION_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Origin": "https://www.sofascore.com",
    "Referer": "https://www.sofascore.com/",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
}

MIRRORS = [
    "https://api.sofascore.com",
    "https://api.sofascore.app",
    "https://mobile.sofascore.com"
]

# Simple in-memory cache: key -> (timestamp, data_bytes, content_type)
cache_lock = threading.Lock()
cache_store = {}

def get_cache_ttl(path):
    if "/events/live" in path:
        return 5
    if "/team/" in path or "/player/" in path:
        return 3600
    if "/search/" in path:
        return 1800
    return 30

def get_cached(key):
    now = time.time()
    with cache_lock:
        item = cache_store.get(key)
        if item:
            ts, ttl, data, ctype = item
            if now - ts < ttl:
                return data, ctype
            del cache_store[key]
    return None, None

def set_cached(key, data, ctype, ttl):
    with cache_lock:
        if len(cache_store) > 5000:
            now = time.time()
            expired = [k for k, v in cache_store.items() if now - v[0] >= v[1]]
            for k in expired:
                del cache_store[k]
        cache_store[key] = (time.time(), ttl, data, ctype)

# Thread-local curl_cffi session
_thread_local = threading.local()

def get_session():
    if not hasattr(_thread_local, "session"):
        _thread_local.session = requests.Session(impersonate="chrome124", headers=SESSION_HEADERS)
    return _thread_local.session

def fetch_sofascore(target_url, timeout=10):
    parsed = urllib.parse.urlparse(target_url)
    rel_path = parsed.path + (("?" + parsed.query) if parsed.query else "")
    if not rel_path.startswith("/"):
        rel_path = "/" + rel_path

    cached_data, cached_ctype = get_cached(rel_path)
    if cached_data is not None:
        return 200, cached_ctype, cached_data

    session = get_session()
    last_status = 502
    last_content = b'{"error": "Failed to connect to upstream mirrors"}'
    last_ctype = "application/json"

    # Try original URL first if provided
    hosts_to_try = []
    if parsed.netloc:
        orig_base = f"{parsed.scheme or 'https'}://{parsed.netloc}"
        hosts_to_try.append(orig_base)
    for m in MIRRORS:
        if m not in hosts_to_try:
            hosts_to_try.append(m)

    for host in hosts_to_try:
        url = f"{host}{rel_path}"
        try:
            resp = session.get(url, timeout=timeout)
            if resp.status_code == 200 and resp.content and len(resp.content) > 2:
                ctype = resp.headers.get("Content-Type", "application/json")
                ttl = get_cache_ttl(rel_path)
                set_cached(rel_path, resp.content, ctype, ttl)
                return 200, ctype, resp.content
            if resp.status_code in (404, 410):
                return resp.status_code, "application/json", resp.content
            last_status = resp.status_code
            last_content = resp.content
            last_ctype = resp.headers.get("Content-Type", "application/json")
        except Exception as e:
            last_status = 504
            last_content = json.dumps({"error": str(e)}).encode("utf-8")

    return last_status, last_ctype, last_content

class RelayHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Clean timestamped log
        sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {args[0]} - {args[1]} - {args[2]}\n")

    def send_cors_headers(self, status=200, content_type="application/json; charset=utf-8"):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Type", content_type)
        self.end_headers()

    def do_OPTIONS(self):
        self.send_cors_headers(204)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = urllib.parse.parse_qs(parsed.query)

        # Healthcheck endpoint
        if path in ("", "/health", "/healthz", "/ping", "/matchfeed/health"):
            self.send_cors_headers(200)
            res = json.dumps({
                "status": "ok",
                "service": "matchfeed-relay",
                "uptime": time.time(),
                "cached_items": len(cache_store)
            })
            self.wfile.write(res.encode("utf-8"))
            return

        # Target URL extraction
        target_url = None
        if "url" in query and query["url"]:
            target_url = query["url"][0]
        elif path.startswith("/api/v1/") or path.startswith("/matchfeed/api/v1/"):
            clean_path = path
            if clean_path.startswith("/matchfeed"):
                clean_path = clean_path[len("/matchfeed"):]
            target_url = f"https://api.sofascore.com{clean_path}"
            if parsed.query:
                target_url += f"?{parsed.query}"
        elif "action" in query and query["action"]:
            action = query["action"][0].lower()
            if action == "live":
                sport = query.get("sport", ["table-tennis"])[0]
                target_url = f"https://api.sofascore.com/api/v1/sport/{sport}/events/live"
            elif action in ("match", "event"):
                event_id = query.get("id", [""])[0]
                target_url = f"https://api.sofascore.com/api/v1/event/{event_id}"
            elif action in ("player", "history"):
                player_id = query.get("id", [""])[0]
                page = query.get("page", ["0"])[0]
                target_url = f"https://api.sofascore.com/api/v1/team/{player_id}/events/last/{page}"
            elif action == "search":
                q = urllib.parse.quote(query.get("q", [""])[0])
                target_url = f"https://api.sofascore.com/api/v1/search/{q}"

        if not target_url:
            self.send_cors_headers(400)
            self.wfile.write(b'{"error": "Missing target URL or action parameter"}')
            return

        status, ctype, content = fetch_sofascore(target_url)
        self.send_cors_headers(status, ctype)
        self.wfile.write(content)

def main():
    parser = argparse.ArgumentParser(description="MatchFeed Server Relay")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to listen on")
    parser.add_argument("--host", type=str, default=DEFAULT_HOST, help="Host to bind to")
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), RelayHandler)
    print(f"MatchFeed Relay running on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.server_close()

if __name__ == "__main__":
    main()
