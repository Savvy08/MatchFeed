# Логи сетевой диагностики MatchFeed (SOFA_DIAG)

Дата и время снятия: 2026-10-01 00:46:35
Окружение: Эмулятор Android (LDPlayer9), сеть провайдера Ростелеком.
APK: C:\Users\ilya_\Downloads\Telegram Desktop\app-debug.apk

---

## 1. Диагностический тест SOFA_DIAG (OkHttp 4.12.0)

```text
10-01 00:46:35.844  5651  5783 I SofaScoreClient: ==================== [DIAG-STAGE-2] EXPERIMENT START ====================
10-01 00:46:35.844  5651  5783 I SofaScoreClient: TARGET URL: https://api.sofascore.com/api/v1/sport/table-tennis/events/live
10-01 00:46:35.844  5651  5783 I SofaScoreClient: 
10-01 00:46:35.844  5651  5783 I SofaScoreClient: --- Test 2 (Variant A): OkHttp H2 + Chrome 124 UA ---
10-01 00:46:35.844  5651  5783 I SofaScoreClient: HTTP CLIENT: OkHttp 4.12.0
10-01 00:46:35.844  5651  5783 I SofaScoreClient: CONFIGURED UA: Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36
10-01 00:46:35.844  5651  5783 I SofaScoreClient: Actual Wire Request Headers sent:
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Origin: https://www.sofascore.com
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Referer: https://www.sofascore.com/
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Accept: application/json, text/plain, */*
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   User-Agent: Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Host: api.sofascore.com
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Connection: Keep-Alive
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Accept-Encoding: gzip
10-01 00:46:35.844  5651  5783 I SofaScoreClient: ACTUAL WIRE USER-AGENT: Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36
10-01 00:46:35.844  5651  5783 I SofaScoreClient: HTTP STATUS: 403 ()
10-01 00:46:35.844  5651  5783 I SofaScoreClient: RESPONSE SERVER: Varnish
10-01 00:46:35.844  5651  5783 I SofaScoreClient: PROTOCOL: h2
10-01 00:46:35.844  5651  5783 I SofaScoreClient: TIMING: 881 ms
10-01 00:46:35.844  5651  5783 I SofaScoreClient: TLS Version: TLS_1_2
10-01 00:46:35.844  5651  5783 I SofaScoreClient: Cipher Suite: TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
10-01 00:46:35.844  5651  5783 I SofaScoreClient: Response Headers:
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   server: Varnish
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   retry-after: 0
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   content-type: application/json
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   access-control-allow-origin: *
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   accept-ranges: bytes
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   date: Wed, 30 Sep 2026 21:46:27 GMT
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   strict-transport-security: max-age=300
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   content-length: 48
10-01 00:46:35.844  5651  5783 I SofaScoreClient: RESPONSE BODY SIZE: 48 bytes
10-01 00:46:35.844  5651  5783 I SofaScoreClient: Response Body (first 250 bytes):
10-01 00:46:35.844  5651  5783 I SofaScoreClient: {"error": {"code": 403, "reason": "Forbidden" }}
10-01 00:46:35.844  5651  5783 I SofaScoreClient: Set-Cookie count: 0
10-01 00:46:35.844  5651  5783 I SofaScoreClient: 
10-01 00:46:35.844  5651  5783 I SofaScoreClient: --- Test 3 (Variant B): OkHttp H2 + Modern Chrome 134 UA ---
10-01 00:46:35.844  5651  5783 I SofaScoreClient: HTTP CLIENT: OkHttp 4.12.0
10-01 00:46:35.844  5651  5783 I SofaScoreClient: CONFIGURED UA: Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36
10-01 00:46:35.844  5651  5783 I SofaScoreClient: Actual Wire Request Headers sent:
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Origin: https://www.sofascore.com
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Referer: https://www.sofascore.com/
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Accept: application/json, text/plain, */*
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   User-Agent: Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Host: api.sofascore.com
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Connection: Keep-Alive
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   Accept-Encoding: gzip
10-01 00:46:35.844  5651  5783 I SofaScoreClient: ACTUAL WIRE USER-AGENT: Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36
10-01 00:46:35.844  5651  5783 I SofaScoreClient: HTTP STATUS: 403 ()
10-01 00:46:35.844  5651  5783 I SofaScoreClient: RESPONSE SERVER: Varnish
10-01 00:46:35.844  5651  5783 I SofaScoreClient: PROTOCOL: h2
10-01 00:46:35.844  5651  5783 I SofaScoreClient: TIMING: 815 ms
10-01 00:46:35.844  5651  5783 I SofaScoreClient: TLS Version: TLS_1_2
10-01 00:46:35.844  5651  5783 I SofaScoreClient: Cipher Suite: TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
10-01 00:46:35.844  5651  5783 I SofaScoreClient: Response Headers:
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   server: Varnish
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   retry-after: 0
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   content-type: application/json
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   access-control-allow-origin: *
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   accept-ranges: bytes
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   date: Wed, 30 Sep 2026 21:46:28 GMT
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   strict-transport-security: max-age=300
10-01 00:46:35.844  5651  5783 I SofaScoreClient:   content-length: 48
10-01 00:46:35.844  5651  5783 I SofaScoreClient: RESPONSE BODY SIZE: 48 bytes
10-01 00:46:35.844  5651  5783 I SofaScoreClient: Response Body (first 250 bytes):
10-01 00:46:35.844  5651  5783 I SofaScoreClient: {"error": {"code": 403, "reason": "Forbidden" }}
10-01 00:46:35.844  5651  5783 I SofaScoreClient: Set-Cookie count: 0
10-01 00:46:35.844  5651  5783 I SofaScoreClient: 
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: --- Test 4 (Variant C): OkHttp H2 without manual User-Agent ---
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: HTTP CLIENT: OkHttp 4.12.0
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: CONFIGURED UA: <NONE (OkHttp default)>
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Actual Wire Request Headers sent:
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Origin: https://www.sofascore.com
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Referer: https://www.sofascore.com/
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Accept: application/json, text/plain, */*
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Host: api.sofascore.com
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Connection: Keep-Alive
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Accept-Encoding: gzip
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   User-Agent: okhttp/4.12.0
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: ACTUAL WIRE USER-AGENT: okhttp/4.12.0
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: HTTP STATUS: 200 ()
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: RESPONSE SERVER: nginx
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: PROTOCOL: h2
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: TIMING: 1400 ms
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: TLS Version: TLS_1_2
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Cipher Suite: TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Response Headers:
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   server: nginx
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   content-type: application/json
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   cache-control: max-age=5, public, s-maxage=5, stale-while-revalidate=60
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   x-application-id: core
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   etag: W/"0d84d72851"
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   x-request-id: afd852a4-bda5-42ea-a417-2178ff0f8983
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   access-control-allow-origin: *
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   accept-ranges: bytes
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   date: Wed, 30 Sep 2026 21:46:28 GMT
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   vary: Accept-Encoding
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   strict-transport-security: max-age=300
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: RESPONSE BODY SIZE: 44748 bytes
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: JSON VALIDATION: OK, events count = 12
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   FIRST EVENT ID: 17225511
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   FIRST TOURNAMENT: Czech Liga Pro
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   TEAMS: Novotny M. vs Bruzek P.
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Set-Cookie count: 0
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: 
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: --- Test 5: OkHttp HTTP/1.1 without manual User-Agent ---
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: HTTP CLIENT: OkHttp 4.12.0
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: CONFIGURED UA: <NONE (OkHttp default)>
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: ACTUAL WIRE USER-AGENT: okhttp/4.12.0
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: HTTP STATUS: 200 (OK)
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: RESPONSE SERVER: nginx
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: PROTOCOL: http/1.1
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: TIMING: 848 ms
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: TLS Version: TLS_1_2
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Cipher Suite: TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Response Headers:
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Connection: keep-alive
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Server: nginx
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Content-Type: application/json
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Cache-Control: max-age=5, public, s-maxage=5, stale-while-revalidate=60
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   X-Application-Id: core
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   ETag: W/"43d24ebfa2"
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   X-Request-Id: 0550bcd2-3b9f-482b-8c55-a8efb57d185f
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Access-Control-Allow-Origin: *
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Accept-Ranges: bytes
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Date: Wed, 30 Sep 2026 21:46:30 GMT
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Vary: Accept-Encoding
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   Strict-Transport-Security: max-age=300
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: RESPONSE BODY SIZE: 44791 bytes
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: JSON VALIDATION: OK, events count = 12
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   FIRST EVENT ID: 17225511
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   FIRST TOURNAMENT: Czech Liga Pro
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   TEAMS: Novotny M. vs Bruzek P.
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Set-Cookie count: 0
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: 
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: --- TEST 6: COOKIES & CHALLENGE FLOW (Homepage -> API) ---
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Homepage Status: 200 
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Cookies collected from homepage: 0
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: --- Test 6 (Variant D): API with CookieJar + Chrome 124 UA ---
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: HTTP CLIENT: OkHttp 4.12.0
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: CONFIGURED UA: Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: ACTUAL WIRE USER-AGENT: Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: HTTP STATUS: 403 ()
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: RESPONSE SERVER: Varnish
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: PROTOCOL: h2
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: TIMING: 924 ms
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: TLS Version: TLS_1_2
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Cipher Suite: TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Response Headers:
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   server: Varnish
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   retry-after: 0
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   content-type: application/json
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   access-control-allow-origin: *
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   accept-ranges: bytes
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   date: Wed, 30 Sep 2026 21:46:33 GMT
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   strict-transport-security: max-age=300
10-01 00:46:35.844  5651  5783 I SOFA_DIAG:   content-length: 48
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: RESPONSE BODY SIZE: 48 bytes
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Response Body (first 250 bytes):
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: {"error": {"code": 403, "reason": "Forbidden" }}
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: Set-Cookie count: 0
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: 
10-01 00:46:35.844  5651  5783 I SOFA_DIAG: ==================== [DIAG-STAGE-2] EXPERIMENT END ====================
```

---

## 2. Реальный боевой запрос приложения (Thread 5782)

```text
10-01 00:46:26.552  5651  5782 I SofaScoreClient: [CONFIG] Received connection settings: mode=relay1, hasCustomProxy=false
10-01 00:46:26.561  5651  5782 I SofaScoreClient: [NETWORK] Route: RELAY1 for https://api.sofascore.com/api/v1/sport/table-tennis/events/live
10-01 00:46:34.611  5651  5782 W SofaScoreClient: Relay error for https://api.sofascore.com/api/v1/sport/table-tennis/events/live: SSL handshake timed out
10-01 00:46:34.611  5651  5782 I SofaScoreClient: [DIRECT] Executing direct connection to https://api.sofascore.com/api/v1/sport/table-tennis/events/live
10-01 00:46:34.762  5651  5782 I SofaScoreClient: [DIRECT] Response HTTP 403 for https://api.sofascore.com/api/v1/sport/table-tennis/events/live
10-01 00:46:34.762  5651  5782 W SofaScoreClient: [DIRECT] HTTP 403 for https://api.sofascore.com/api/v1/sport/table-tennis/events/live
10-01 00:46:34.763  5651  5782 I SofaScoreClient: [NETWORK] Route: RELAY1 for https://api.sofascore.app/api/v1/sport/table-tennis/events/live
10-01 00:46:42.774  5651  5782 W SofaScoreClient: Relay error for https://api.sofascore.app/api/v1/sport/table-tennis/events/live: SSL handshake timed out
10-01 00:46:42.774  5651  5782 W SofaScoreClient: [NETWORK] RELAY1 failed, trying direct
10-01 00:46:42.774  5651  5782 I SofaScoreClient: [DIRECT] Executing direct connection to https://api.sofascore.app/api/v1/sport/table-tennis/events/live
10-01 00:46:43.479  5651  5782 I SofaScoreClient: [DIRECT] Response HTTP 200 for https://api.sofascore.app/api/v1/sport/table-tennis/events/live
```
