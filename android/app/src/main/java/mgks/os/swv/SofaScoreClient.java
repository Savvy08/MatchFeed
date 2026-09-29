package mgks.os.swv;

import android.content.Context;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceResponse;

import org.chromium.net.CronetEngine;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.Authenticator;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.PasswordAuthentication;
import java.net.Proxy;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// SofaScore client providing full parity with sofascore_api.py
public class SofaScoreClient {
    private static final String TAG = "SofaScoreClient";
    private static CronetEngine cronetEngine;
    private static Context appContext;
    private static File cacheDir;
    private static String currentConnectionMode = "auto";
    private static String configuredRelayUrl = "";
    private static String configuredRelay2Url = "";
    private static String customProxyUrl = "";
    private static final String STOCK_PROXY = "socks5://qwF2DW:YTTxrt@45.130.63.240:8000";

    // Reliable fallback proxy endpoints for sports data
    private static final String[] PROXY_SERVERS = new String[] {
        "103.152.112.162:80",
        "45.144.150.77:8080",
        "185.199.229.156:7492",
        "194.38.22.181:80"
    };

    // Status translations
    public static final Map<String, String> STATUS_RU = new HashMap<>();
    static {
        STATUS_RU.put("inprogress", "LIVE");
        STATUS_RU.put("live", "LIVE");
        STATUS_RU.put("not started", "Предстоит");
        STATUS_RU.put("ended", "Завершён");
        STATUS_RU.put("ft", "Завершён");
        STATUS_RU.put("aet", "Завершён");
        STATUS_RU.put("ap", "Завершён");
        STATUS_RU.put("retired", "Снят");
        STATUS_RU.put("walkover", "Тех. победа");
        STATUS_RU.put("pause", "Пауза");
        STATUS_RU.put("break time", "Перерыв");
        STATUS_RU.put("halftime", "Перерыв");
        STATUS_RU.put("1st half", "1-й тайм");
        STATUS_RU.put("2nd half", "2-й тайм");
        STATUS_RU.put("extra time", "Доп. время");
        STATUS_RU.put("overtime", "Овертайм");
        STATUS_RU.put("penalties", "Пенальти");
        STATUS_RU.put("postponed", "Перенесён");
        STATUS_RU.put("cancelled", "Отменён");
        STATUS_RU.put("interrupted", "Прерван");
        STATUS_RU.put("abandoned", "Отменен");
        STATUS_RU.put("delayed", "Задержан");
        STATUS_RU.put("suspended", "Приостановлен");
        for (int i = 1; i <= 7; i++) {
            STATUS_RU.put("set " + i, "Сет " + i);
            STATUS_RU.put(i + "st set", "Сет " + i);
            STATUS_RU.put(i + "nd set", "Сет " + i);
            STATUS_RU.put(i + "rd set", "Сет " + i);
            STATUS_RU.put(i + "th set", "Сет " + i);
        }
    }

    // Round names translations
    public static final Map<String, String> ROUND_NAMES_RU = new HashMap<>();
    static {
        ROUND_NAMES_RU.put("round of 128", "1/64 финала");
        ROUND_NAMES_RU.put("round of 64", "1/32 финала");
        ROUND_NAMES_RU.put("round of 32", "1/16 финала");
        ROUND_NAMES_RU.put("round of 16", "1/8 финала");
        ROUND_NAMES_RU.put("quarterfinal", "1/4 финала");
        ROUND_NAMES_RU.put("quarterfinals", "1/4 финала");
        ROUND_NAMES_RU.put("semifinal", "1/2 финала");
        ROUND_NAMES_RU.put("semifinals", "1/2 финала");
        ROUND_NAMES_RU.put("final", "Финал");
        ROUND_NAMES_RU.put("finals", "Финал");
        ROUND_NAMES_RU.put("3rd place match", "Матч за 3-е место");
        ROUND_NAMES_RU.put("qualification", "Квалификация");
    }

    public static synchronized void init(Context context) {
        if (context != null) {
            appContext = context.getApplicationContext();
            try {
                cacheDir = new File(appContext.getCacheDir(), "sofascore_cache");
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs();
                }
            } catch (Exception e) {
                Log.e(TAG, "Error initializing cache dir", e);
            }
        }
        if (cronetEngine != null) return;
        try {
            com.google.android.gms.net.CronetProviderInstaller.installProvider(context.getApplicationContext());
        } catch (Throwable t) {
            Log.w(TAG, "CronetProviderInstaller could not install provider", t);
        }
        try {
            CronetEngine.Builder builder = new CronetEngine.Builder(context.getApplicationContext());
            builder.enableHttp2(true)
                   .enableQuic(true)
                   .setUserAgent("Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
            cronetEngine = builder.build();
            Log.d(TAG, "CronetEngine initialized successfully");
        } catch (Throwable t) {
            Log.w(TAG, "CronetEngine initialization fallback", t);
        }
    }

    // Disk cache helpers
    private static File getCacheFile(String key) {
        if (cacheDir == null && appContext != null) {
            try {
                cacheDir = new File(appContext.getCacheDir(), "sofascore_cache");
                if (!cacheDir.exists()) cacheDir.mkdirs();
            } catch (Exception ignored) {}
        }
        if (cacheDir == null) return null;

        String safe = key.replaceAll("[^a-zA-Z0-9_-]", "_");
        if (safe.length() > 60) {
            try {
                MessageDigest md = MessageDigest.getInstance("MD5");
                byte[] d = md.digest(key.getBytes(StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                for (byte b : d) sb.append(String.format(Locale.US, "%02x", b));
                safe = sb.toString();
            } catch (Exception ignored) {
                safe = safe.substring(0, 60);
            }
        }
        return new File(cacheDir, safe + ".json");
    }

    public static String getDiskCache(String key, long ttlSeconds) {
        try {
            File file = getCacheFile(key);
            if (file != null && file.exists()) {
                long age = (System.currentTimeMillis() - file.lastModified()) / 1000L;
                if (ttlSeconds <= 0 || age < ttlSeconds) {
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    try (InputStream is = new FileInputStream(file)) {
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = is.read(buf)) != -1) {
                            baos.write(buf, 0, n);
                        }
                    }
                    return baos.toString("UTF-8");
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Cache read error for " + key, e);
        }
        return null;
    }

    public static void putDiskCache(String key, String data) {
        if (data == null || data.isEmpty()) return;
        try {
            File file = getCacheFile(key);
            if (file != null) {
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(data.getBytes(StandardCharsets.UTF_8));
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Cache write error for " + key, e);
        }
    }

    public static String getCacheInfoJson() {
        int count = 0;
        long totalBytes = 0;
        try {
            if (cacheDir != null && cacheDir.exists()) {
                File[] files = cacheDir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        if (f.isFile()) {
                            count++;
                            totalBytes += f.length();
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Cache info error", e);
        }
        return "{\"success\":true,\"count\":" + count + ",\"bytes\":" + totalBytes + ",\"formattedSize\":\"" + formatBytes(totalBytes) + "\"}";
    }

    public static String clearCacheJson() {
        int deleted = 0;
        long freed = 0;
        try {
            if (cacheDir != null && cacheDir.exists()) {
                File[] files = cacheDir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        if (f.isFile()) {
                            freed += f.length();
                            if (f.delete()) {
                                deleted++;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Clear cache error", e);
        }
        return "{\"success\":true,\"deletedFiles\":" + deleted + ",\"freedBytes\":" + freed + ",\"formattedFreed\":\"" + formatBytes(freed) + "\"}";
    }

    public static String cleanOldCacheJson(int days) {
        int deleted = 0;
        long freed = 0;
        long ttlMillis = (long) Math.max(7, Math.min(30, days)) * 86400L * 1000L;
        long now = System.currentTimeMillis();
        try {
            if (cacheDir != null && cacheDir.exists()) {
                File[] files = cacheDir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        if (f.isFile() && (now - f.lastModified() > ttlMillis)) {
                            freed += f.length();
                            if (f.delete()) {
                                deleted++;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Clean old cache error", e);
        }
        return "{\"success\":true,\"days\":" + days + ",\"deletedFiles\":" + deleted + ",\"freedBytes\":" + freed + ",\"formattedFreed\":\"" + formatBytes(freed) + "\"}";
    }

    private static String formatBytes(long bytes) {
        if (bytes <= 0) return "0 КБ";
        if (bytes < 1024) return bytes + " Б";
        if (bytes < 1024 * 1024) return String.format(Locale.US, "%.1f КБ", bytes / 1024.0);
        return String.format(Locale.US, "%.1f МБ", bytes / (1024.0 * 1024.0));
    }

    // Official Russian name resolver from fieldTranslations
    public static String ruName(JSONObject entity, String fallback) {
        if (entity == null) return "";
        JSONObject ft = entity.optJSONObject("fieldTranslations");
        if (ft != null) {
            JSONObject nt = ft.optJSONObject("nameTranslation");
            if (nt != null) {
                String ru = nt.optString("ru", "");
                if (!ru.isEmpty()) return ru;
            }
        }
        return entity.optString(fallback != null ? fallback : "name", "");
    }

    private static String extractYtId(String url) {
        if (url == null || url.isEmpty()) return "";
        Pattern p = Pattern.compile("(?:v=|/embed/|/watch\\?v=|youtu\\.be/)([0-9A-Za-z_-]{11})");
        Matcher m = p.matcher(url);
        if (m.find()) return m.group(1);
        return "";
    }

    private static String getParam(Uri uri, String key) {
        if (uri == null) return null;
        try {
            String val = uri.getQueryParameter(key);
            if (val != null && !val.isEmpty()) return val;
        } catch (Exception ignored) {}
        try {
            String urlStr = uri.toString();
            int qIdx = urlStr.indexOf('?');
            if (qIdx != -1) {
                String query = urlStr.substring(qIdx + 1);
                for (String pair : query.split("&")) {
                    String[] parts = pair.split("=", 2);
                    if (parts.length > 0 && parts[0].equalsIgnoreCase(key)) {
                        return parts.length > 1 ? URLDecoder.decode(parts[1], "UTF-8") : "";
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    // Bridge entry point for JSInterfacePlugin
    public static String executeApiCall(String action, String paramsJson) {
        if (action == null || action.trim().isEmpty()) action = "live";
        action = action.trim().toLowerCase(Locale.US);

        Map<String, String> params = new HashMap<>();
        if (paramsJson != null && !paramsJson.trim().isEmpty()) {
            try {
                JSONObject pObj = new JSONObject(paramsJson);
                Iterator<String> keys = pObj.keys();
                while (keys.hasNext()) {
                    String k = keys.next();
                    params.put(k, String.valueOf(pObj.opt(k)));
                }
            } catch (Exception ignored) {}
        }

        // Apply connection settings if passed
        if (params.containsKey("conn_mode")) {
            currentConnectionMode = params.get("conn_mode");
        } else if (params.containsKey("connection_mode")) {
            currentConnectionMode = params.get("connection_mode");
        }
        if (params.containsKey("relay_url")) {
            configuredRelayUrl = params.get("relay_url");
        }
        if (params.containsKey("relay2_url")) {
            configuredRelay2Url = params.get("relay2_url");
        }
        if (params.containsKey("custom_proxy")) {
            customProxyUrl = params.get("custom_proxy");
        }

        try {
            switch (action) {
                case "live":
                    return handleLiveAction(params.getOrDefault("sport", "table-tennis"));
                case "match":
                case "event":
                    return handleMatchAction(params.get("id"));
                case "player":
                case "history":
                    return handlePlayerAction(params.get("id"), params.getOrDefault("page", "0"));
                case "search":
                    return handleSearchAction(params.get("q"));
                case "cache_info":
                    return getCacheInfoJson();
                case "clear_cache":
                    return clearCacheJson();
                case "clean_old_cache": {
                    int days = 7;
                    try { days = Integer.parseInt(params.getOrDefault("days", "7")); } catch (Exception ignored) {}
                    return cleanOldCacheJson(days);
                }
                case "test_connection":
                    return handleTestConnection();
                default:
                    return "{\"success\":false,\"error\":\"Неизвестное действие: " + action + "\"}";
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in executeApiCall: " + e.getMessage(), e);
            String msg = e.getMessage() != null ? e.getMessage().replace("\"", "\\\"") : "Ошибка API";
            return "{\"success\":false,\"error\":\"" + msg + "\"}";
        }
    }

    // Direct parser if rawJson is passed
    public static String parseApiResponse(String action, String sport, String rawJson) {
        if (rawJson == null || rawJson.trim().isEmpty()) {
            return "{\"success\":false,\"error\":\"Пустой ответ от сервера\",\"matches\":[]}";
        }
        if (action == null || action.trim().isEmpty()) action = "live";
        action = action.trim().toLowerCase(Locale.US);

        try {
            switch (action) {
                case "live":
                    return parseLiveJson(rawJson, sport);
                case "match":
                case "event":
                    return handleMatchAction(null);
                case "search":
                    return parseSearchJson(rawJson);
                case "player":
                    return handlePlayerAction(null, "0");
                default:
                    return "{\"success\":false,\"error\":\"Неизвестное действие: " + action + "\"}";
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in parseApiResponse for action " + action, e);
            String msg = e.getMessage() != null ? e.getMessage().replace("\"", "\\\"") : "Ошибка парсинга";
            return "{\"success\":false,\"error\":\"" + msg + "\",\"matches\":[]}";
        }
    }

    // Interceptor entry point for api.php URLs
    public static WebResourceResponse handleRequest(Uri uri) {
        try {
            String connMode = getParam(uri, "conn_mode");
            if (connMode != null && !connMode.isEmpty()) currentConnectionMode = connMode;
            String relayUrl = getParam(uri, "relay_url");
            if (relayUrl != null) configuredRelayUrl = relayUrl;

            String action = getParam(uri, "action");
            if (action == null || action.trim().isEmpty()) action = "live";
            action = action.trim().toLowerCase(Locale.US);

            switch (action) {
                case "live":
                    return jsonResponse(handleLiveAction(getParam(uri, "sport")));
                case "match":
                case "event":
                    return jsonResponse(handleMatchAction(getParam(uri, "id")));
                case "player":
                case "history":
                    return jsonResponse(handlePlayerAction(getParam(uri, "id"), getParam(uri, "page")));
                case "search":
                    return jsonResponse(handleSearchAction(getParam(uri, "q")));
                case "image":
                    return handleImageAction(getParam(uri, "id"));
                case "cache_info":
                    return jsonResponse(getCacheInfoJson());
                case "clear_cache":
                    return jsonResponse(clearCacheJson());
                case "clean_old_cache": {
                    int days = 7;
                    try { days = Integer.parseInt(getParam(uri, "days")); } catch (Exception ignored) {}
                    return jsonResponse(cleanOldCacheJson(days));
                }
                case "test_connection":
                    return jsonResponse(handleTestConnection());
                default:
                    return errorResponse("Неизвестное действие: " + action);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error handling request: " + uri, e);
            return errorResponse("Ошибка обработки запроса: " + e.getMessage());
        }
    }

    // Action live
    public static String handleLiveAction(String sport) {
        if (sport == null || sport.trim().isEmpty()) sport = "table-tennis";
        sport = sport.trim().toLowerCase(Locale.US);
        if (sport.equals("tabletennis") || sport.equals("tt") || sport.equals("table_tennis")) {
            sport = "table-tennis";
        }

        String url = "https://api.sofascore.com/api/v1/sport/" + sport + "/events/live";
        String rawJson = fetchString(url);
        if (rawJson == null) {
            url = "https://api.sofascore.app/api/v1/sport/" + sport + "/events/live";
            rawJson = fetchString(url);
        }
        return parseLiveJson(rawJson, sport);
    }

    public static String parseLiveJson(String rawJson, String sport) {
        if (sport == null || sport.trim().isEmpty()) sport = "table-tennis";
        sport = sport.trim().toLowerCase(Locale.US);
        if (sport.equals("tabletennis") || sport.equals("tt") || sport.equals("table_tennis")) {
            sport = "table-tennis";
        }

        if (rawJson == null || rawJson.trim().isEmpty()) {
            return "{\"success\":false,\"error\":\"Не удалось получить данные от Sofascore\",\"matches\":[]}";
        }

        try {
            JSONObject root = new JSONObject(rawJson);
            JSONArray events = root.optJSONArray("events");
            JSONArray matches = new JSONArray();

            if (events != null) {
                for (int i = 0; i < events.length(); i++) {
                    JSONObject e = events.optJSONObject(i);
                    if (e == null) continue;

                    JSONObject statusObj = e.optJSONObject("status");
                    String statusDesc = statusObj != null ? statusObj.optString("description", "").toLowerCase(Locale.US) : "";
                    String statusType = statusObj != null ? statusObj.optString("type", "").toLowerCase(Locale.US) : "";

                    if (statusDesc.equals("cancelled") || statusDesc.equals("postponed") || statusDesc.equals("abandoned")) {
                        continue;
                    }

                    String normStatus = "upcoming";
                    if (statusType.equals("inprogress") || STATUS_RU.containsKey(statusDesc) || statusDesc.contains("set") || statusDesc.contains("half")) {
                        normStatus = "live";
                    } else if (statusType.equals("finished") || statusDesc.equals("ended") || statusDesc.equals("ft")) {
                        normStatus = "finished";
                    }

                    long ts = e.optLong("startTimestamp", 0);
                    String statusLabel = STATUS_RU.get(statusDesc);
                    if (statusLabel == null) statusLabel = statusDesc.isEmpty() ? "LIVE" : statusDesc;
                    String timeFormatted = normStatus.equals("live") ? statusLabel : (ts == 0 ? "--:--" : "");

                    JSONObject hs = e.optJSONObject("homeScore");
                    JSONObject aws = e.optJSONObject("awayScore");

                    JSONArray sets = new JSONArray();
                    if (hs != null || aws != null) {
                        for (int p = 1; p <= 7; p++) {
                            String key = "period" + p;
                            if ((hs != null && hs.has(key)) || (aws != null && aws.has(key))) {
                                JSONObject setObj = new JSONObject();
                                setObj.put("home", hs != null && hs.has(key) ? hs.opt(key) : null);
                                setObj.put("away", aws != null && aws.has(key) ? aws.opt(key) : null);
                                sets.put(setObj);
                            }
                        }
                    }

                    JSONObject tourn = e.optJSONObject("tournament");
                    JSONObject cat = tourn != null ? tourn.optJSONObject("category") : null;
                    JSONObject homeTeam = e.optJSONObject("homeTeam");
                    JSONObject awayTeam = e.optJSONObject("awayTeam");

                    JSONObject match = new JSONObject();
                    match.put("id", String.valueOf(e.opt("id")));
                    match.put("sport", sport);
                    match.put("tournament", ruName(tourn, "name"));
                    match.put("country", ruName(cat, "name"));
                    match.put("status", normStatus);
                    match.put("time", timeFormatted);
                    match.put("startTimestamp", ts);

                    JSONObject ht = new JSONObject();
                    ht.put("id", homeTeam != null ? homeTeam.opt("id") : null);
                    ht.put("name", ruName(homeTeam, "name"));
                    ht.put("score", hs != null ? hs.opt("current") : null);
                    match.put("homeTeam", ht);

                    JSONObject at = new JSONObject();
                    at.put("id", awayTeam != null ? awayTeam.opt("id") : null);
                    at.put("name", ruName(awayTeam, "name"));
                    at.put("score", aws != null ? aws.opt("current") : null);
                    match.put("awayTeam", at);

                    match.put("sets", sets);
                    matches.put(match);
                }
            }

            JSONObject result = new JSONObject();
            result.put("success", true);
            result.put("sport", sport);
            result.put("matches", matches);
            return result.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error parsing live events", e);
            return "{\"success\":false,\"error\":\"Ошибка парсинга live событий\",\"matches\":[]}";
        }
    }

    // Action player
    public static String handlePlayerAction(String playerId, String pageStr) {
        if (playerId == null || playerId.trim().isEmpty()) {
            return "{\"success\":false,\"error\":\"ID игрока не указан\"}";
        }
        int page = 0;
        try { if (pageStr != null) page = Integer.parseInt(pageStr); } catch (Exception ignored) {}

        try {
            // 1. Profile bio
            JSONObject profile = new JSONObject();
            String profUrl = "https://api.sofascore.com/api/v1/team/" + playerId;
            String profJson = fetchString(profUrl);
            if (profJson != null) {
                try {
                    JSONObject pRoot = new JSONObject(profJson);
                    JSONObject t = pRoot.optJSONObject("team");
                    if (t != null) {
                        JSONObject countryObj = t.optJSONObject("country");
                        JSONObject sportObj = t.optJSONObject("sport");
                        profile.put("id", t.opt("id"));
                        profile.put("name", ruName(t, "name"));
                        profile.put("originalName", t.optString("name", ""));
                        profile.put("fullName", t.optString("fullName", t.optString("name", "")));
                        profile.put("country", ruName(countryObj, "name"));
                        profile.put("ranking", t.opt("ranking"));
                        String rawGender = t.optString("gender", "");
                        profile.put("gender", rawGender);
                        profile.put("sport", sportObj != null ? sportObj.optString("slug", "table-tennis") : "table-tennis");
                        profile.put("sportName", sportObj != null ? sportObj.optString("name", "Настольный теннис") : "Настольный теннис");
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Failed to parse player bio", e);
                }
            }

            // 2. Upcoming matches
            JSONArray nextMatches = new JSONArray();
            String nextUrl = "https://api.sofascore.com/api/v1/team/" + playerId + "/events/next/0";
            String nextJson = fetchString(nextUrl);
            if (nextJson != null) {
                try {
                    JSONObject nRoot = new JSONObject(nextJson);
                    JSONArray nEvents = nRoot.optJSONArray("events");
                    if (nEvents != null) {
                        SimpleDateFormat sdfDate = new SimpleDateFormat("dd.MM.yyyy", Locale.getDefault());
                        SimpleDateFormat sdfTime = new SimpleDateFormat("HH:mm", Locale.getDefault());
                        for (int i = 0; i < nEvents.length(); i++) {
                            JSONObject e = nEvents.optJSONObject(i);
                            if (e == null) continue;
                            JSONObject ht = e.optJSONObject("homeTeam");
                            JSONObject at = e.optJSONObject("awayTeam");
                            boolean playerIsHome = ht != null && String.valueOf(ht.opt("id")).equals(playerId);
                            JSONObject oppTeam = playerIsHome ? at : ht;
                            JSONObject tourn = e.optJSONObject("tournament");
                            JSONObject cat = tourn != null ? tourn.optJSONObject("category") : null;
                            JSONObject statusObj = e.optJSONObject("status");
                            String statusDesc = statusObj != null ? statusObj.optString("description", "").toLowerCase(Locale.US) : "";

                            long ts = e.optLong("startTimestamp", 0);
                            String dtStr = ts > 0 ? sdfDate.format(new Date(ts * 1000L)) : "-";
                            String timeStr = ts > 0 ? sdfTime.format(new Date(ts * 1000L)) : "";

                            JSONObject nm = new JSONObject();
                            nm.put("id", String.valueOf(e.opt("id")));
                            nm.put("date", dtStr);
                            nm.put("time", timeStr);
                            nm.put("startTimestamp", ts);
                            nm.put("tournament", ruName(tourn, "name"));
                            nm.put("category", ruName(cat, "name"));

                            JSONObject opp = new JSONObject();
                            opp.put("id", oppTeam != null ? oppTeam.opt("id") : null);
                            opp.put("name", oppTeam != null ? ruName(oppTeam, "name") : "Соперник");
                            nm.put("opponent", opp);
                            nm.put("status", STATUS_RU.getOrDefault(statusDesc, "Предстоит"));
                            nextMatches.put(nm);
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Failed to parse upcoming matches", e);
                }
            }

            // 3. History
            String histUrl = "https://api.sofascore.com/api/v1/team/" + playerId + "/events/last/" + page;
            String histJson = fetchString(histUrl);
            List<JSONObject> matchesList = new ArrayList<>();
            Map<String, Integer> tournCounts = new HashMap<>();

            if (histJson != null) {
                try {
                    JSONObject hRoot = new JSONObject(histJson);
                    JSONArray events = hRoot.optJSONArray("events");
                    if (events != null) {
                        SimpleDateFormat sdfDate = new SimpleDateFormat("dd.MM.yyyy", Locale.getDefault());
                        for (int i = 0; i < events.length(); i++) {
                            JSONObject e = events.optJSONObject(i);
                            if (e == null) continue;

                            JSONObject ht = e.optJSONObject("homeTeam");
                            JSONObject at = e.optJSONObject("awayTeam");
                            boolean playerIsHome = ht != null && String.valueOf(ht.opt("id")).equals(playerId);
                            JSONObject oppTeam = playerIsHome ? at : ht;
                            JSONObject tourn = e.optJSONObject("tournament");
                            JSONObject cat = tourn != null ? tourn.optJSONObject("category") : null;
                            JSONObject hs = e.optJSONObject("homeScore");
                            JSONObject aws = e.optJSONObject("awayScore");

                            Object pSets = playerIsHome ? (hs != null ? hs.opt("current") : null) : (aws != null ? aws.opt("current") : null);
                            Object oSets = playerIsHome ? (aws != null ? aws.opt("current") : null) : (hs != null ? hs.opt("current") : null);

                            // Period by period score details
                            JSONArray setsDetail = new JSONArray();
                            for (int p = 1; p <= 7; p++) {
                                String key = "period" + p;
                                if ((hs != null && hs.has(key)) || (aws != null && aws.has(key))) {
                                    Object hp = hs != null ? hs.opt(key) : null;
                                    Object ap = aws != null ? aws.opt(key) : null;
                                    Object pPts = playerIsHome ? hp : ap;
                                    Object oPts = playerIsHome ? ap : hp;
                                    JSONObject sObj = new JSONObject();
                                    sObj.put("player", pPts);
                                    sObj.put("opponent", oPts);
                                    if (pPts instanceof Number && oPts instanceof Number) {
                                        sObj.put("won", ((Number) pPts).intValue() > ((Number) oPts).intValue());
                                    } else {
                                        sObj.put("won", JSONObject.NULL);
                                    }
                                    setsDetail.put(sObj);
                                }
                            }

                            int wc = e.optInt("winnerCode", 0);
                            Boolean won = null;
                            if (wc == 1) won = playerIsHome;
                            else if (wc == 2) won = !playerIsHome;
                            else if (pSets instanceof Number && oSets instanceof Number) {
                                won = ((Number) pSets).intValue() > ((Number) oSets).intValue();
                            }

                            long ts = e.optLong("startTimestamp", 0);
                            String dtStr = ts > 0 ? sdfDate.format(new Date(ts * 1000L)) : "-";
                            JSONObject statusObj = e.optJSONObject("status");
                            String statusDesc = statusObj != null ? statusObj.optString("description", "").toLowerCase(Locale.US) : "";
                            String tournName = ruName(tourn, "name");

                            JSONObject m = new JSONObject();
                            m.put("id", String.valueOf(e.opt("id")));
                            m.put("date", dtStr);
                            m.put("startTimestamp", ts);
                            m.put("tournament", tournName);
                            m.put("category", ruName(cat, "name"));

                            JSONObject opp = new JSONObject();
                            opp.put("id", oppTeam != null ? oppTeam.opt("id") : null);
                            opp.put("name", oppTeam != null ? ruName(oppTeam, "name") : "Соперник");
                            m.put("opponent", opp);

                            m.put("playerSets", pSets);
                            m.put("opponentSets", oSets);
                            m.put("won", won != null ? won : JSONObject.NULL);
                            m.put("sets", setsDetail);
                            m.put("status", STATUS_RU.getOrDefault(statusDesc, statusDesc));

                            matchesList.add(m);

                            if (!tournName.isEmpty() && !tournName.equals("-")) {
                                tournCounts.put(tournName, tournCounts.getOrDefault(tournName, 0) + 1);
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Failed to parse player history", e);
                }
            }

            // Determine main league
            String mainLeague = "";
            int maxC = 0;
            for (Map.Entry<String, Integer> entry : tournCounts.entrySet()) {
                if (entry.getValue() > maxC) {
                    maxC = entry.getValue();
                    mainLeague = entry.getKey();
                }
            }
            profile.put("currentLeague", mainLeague);
            if (!profile.has("name") || profile.optString("name").isEmpty()) {
                profile.put("name", "Игрок");
            }

            // Calculations
            int total = matchesList.size();
            int wins = 0, losses = 0;
            for (JSONObject m : matchesList) {
                if (!m.isNull("won")) {
                    if (m.optBoolean("won")) wins++;
                    else losses++;
                }
            }
            int winRate = total > 0 ? (int) Math.round((wins * 100.0) / total) : 0;

            // Streaks
            JSONObject currentStreak = new JSONObject();
            currentStreak.put("type", "none");
            currentStreak.put("count", 0);
            for (JSONObject m : matchesList) {
                if (!m.isNull("won")) {
                    boolean w = m.optBoolean("won");
                    String type = currentStreak.optString("type");
                    if (type.equals("none")) {
                        currentStreak.put("type", w ? "win" : "loss");
                        currentStreak.put("count", 1);
                    } else if ((type.equals("win") && w) || (type.equals("loss") && !w)) {
                        currentStreak.put("count", currentStreak.optInt("count") + 1);
                    } else {
                        break;
                    }
                }
            }

            int bestWinStreak = 0;
            int curW = 0;
            for (int i = matchesList.size() - 1; i >= 0; i--) {
                JSONObject m = matchesList.get(i);
                if (!m.isNull("won")) {
                    if (m.optBoolean("won")) {
                        curW++;
                        if (curW > bestWinStreak) bestWinStreak = curW;
                    } else {
                        curW = 0;
                    }
                }
            }

            JSONArray recentForm = new JSONArray();
            int formCount = 0;
            for (JSONObject m : matchesList) {
                if (!m.isNull("won")) {
                    JSONObject rf = new JSONObject();
                    rf.put("id", m.optString("id"));
                    rf.put("won", m.optBoolean("won"));
                    rf.put("score", m.opt("playerSets") + ":" + m.opt("opponentSets"));
                    JSONObject opp = m.optJSONObject("opponent");
                    rf.put("oppName", opp != null ? opp.optString("name", "") : "");
                    rf.put("tournament", m.optString("tournament", ""));
                    recentForm.put(rf);
                    formCount++;
                    if (formCount >= 5) break;
                }
            }

            int setsWon = 0, setsLost = 0;
            int cleanSweeps = 0;
            int decidingMatches = 0, decidingWins = 0;
            int totalPtsWon = 0, totalPtsLost = 0, totalSetsCounted = 0;

            for (JSONObject m : matchesList) {
                Object ps = m.opt("playerSets");
                Object os = m.opt("opponentSets");
                int pNum = (ps instanceof Number) ? ((Number) ps).intValue() : 0;
                int oNum = (os instanceof Number) ? ((Number) os).intValue() : 0;
                setsWon += pNum;
                setsLost += oNum;

                boolean won = !m.isNull("won") && m.optBoolean("won");
                if (won && oNum == 0 && pNum > 0) {
                    cleanSweeps++;
                }

                if ((pNum + oNum == 5 && Math.max(pNum, oNum) == 3) || (pNum + oNum == 7 && Math.max(pNum, oNum) == 4)) {
                    decidingMatches++;
                    if (won) decidingWins++;
                }

                JSONArray setsArr = m.optJSONArray("sets");
                if (setsArr != null) {
                    for (int sIdx = 0; sIdx < setsArr.length(); sIdx++) {
                        JSONObject sObj = setsArr.optJSONObject(sIdx);
                        if (sObj != null && !sObj.isNull("player") && !sObj.isNull("opponent")) {
                            Object pPts = sObj.opt("player");
                            Object oPts = sObj.opt("opponent");
                            if (pPts instanceof Number && oPts instanceof Number) {
                                totalPtsWon += ((Number) pPts).intValue();
                                totalPtsLost += ((Number) oPts).intValue();
                                totalSetsCounted++;
                            }
                        }
                    }
                }
            }

            int setsTotal = setsWon + setsLost;
            int setsWinRate = setsTotal > 0 ? (int) Math.round((setsWon * 100.0) / setsTotal) : 0;
            int cleanSweepsRate = wins > 0 ? (int) Math.round((cleanSweeps * 100.0) / wins) : 0;
            int decidingWinRate = decidingMatches > 0 ? (int) Math.round((decidingWins * 100.0) / decidingMatches) : 0;
            int pointsDiff = totalPtsWon - totalPtsLost;
            double avgPtsPerSet = totalSetsCounted > 0 ? Math.round((totalPtsWon * 10.0) / totalSetsCounted) / 10.0 : 0.0;

            JSONObject stats = new JSONObject();
            stats.put("totalMatches", total);
            stats.put("wins", wins);
            stats.put("losses", losses);
            stats.put("winRate", winRate);
            stats.put("setsWon", setsWon);
            stats.put("setsLost", setsLost);
            stats.put("setsTotal", setsTotal);
            stats.put("setsWinRate", setsWinRate);
            stats.put("pointsWon", totalPtsWon);
            stats.put("pointsLost", totalPtsLost);
            stats.put("pointsDiff", pointsDiff);
            stats.put("avgPointsPerSet", avgPtsPerSet);
            stats.put("cleanSweeps", cleanSweeps);
            stats.put("cleanSweepsRate", cleanSweepsRate);
            stats.put("decidingWins", decidingWins);
            stats.put("decidingTotal", decidingMatches);
            stats.put("decidingWinRate", decidingWinRate);
            stats.put("currentStreak", currentStreak);
            stats.put("bestWinStreak", bestWinStreak);
            stats.put("recentForm", recentForm);

            JSONArray finalMatches = new JSONArray();
            for (JSONObject m : matchesList) {
                finalMatches.put(m);
            }

            JSONObject result = new JSONObject();
            result.put("success", true);
            result.put("profile", profile);
            result.put("stats", stats);
            result.put("page", page);
            result.put("matches", finalMatches);
            result.put("nextMatches", nextMatches);

            return result.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error in handlePlayerAction", e);
            return "{\"success\":false,\"error\":\"Ошибка загрузки данных игрока\"}";
        }
    }

    // Action match
    public static String handleMatchAction(String eventId) {
        if (eventId == null || eventId.trim().isEmpty()) {
            return "{\"success\":false,\"error\":\"ID матча не указан\"}";
        }

        try {
            String url = "https://api.sofascore.com/api/v1/event/" + eventId;
            String rawJson = fetchString(url);
            if (rawJson == null) {
                url = "https://api.sofascore.app/api/v1/event/" + eventId;
                rawJson = fetchString(url);
            }
            if (rawJson == null || rawJson.trim().isEmpty()) {
                return "{\"success\":false,\"error\":\"Не удалось загрузить данные о матче\"}";
            }

            JSONObject root = new JSONObject(rawJson);
            JSONObject ev = root.optJSONObject("event");
            if (ev == null) return "{\"success\":false,\"error\":\"Матч не найден\"}";

            JSONObject hs = ev.optJSONObject("homeScore");
            JSONObject aws = ev.optJSONObject("awayScore");
            JSONArray sets = new JSONArray();
            if (hs != null || aws != null) {
                for (int p = 1; p <= 7; p++) {
                    String key = "period" + p;
                    if ((hs != null && hs.has(key)) || (aws != null && aws.has(key))) {
                        Object hp = hs != null ? hs.opt(key) : null;
                        Object ap = aws != null ? aws.opt(key) : null;
                        JSONObject sObj = new JSONObject();
                        sObj.put("setNumber", p);
                        sObj.put("home", hp);
                        sObj.put("away", ap);
                        if (hp instanceof Number && ap instanceof Number) {
                            sObj.put("homeWon", ((Number) hp).intValue() > ((Number) ap).intValue());
                        } else {
                            sObj.put("homeWon", JSONObject.NULL);
                        }
                        sets.put(sObj);
                    }
                }
            }

            long ts = ev.optLong("startTimestamp", 0);
            SimpleDateFormat sdfDt = new SimpleDateFormat("dd.MM.yyyy, HH:mm", Locale.getDefault());
            String dtStr = ts > 0 ? sdfDt.format(new Date(ts * 1000L)) : "-";

            JSONObject statusObj = ev.optJSONObject("status");
            String statusDesc = statusObj != null ? statusObj.optString("description", "").toLowerCase(Locale.US) : "";
            String statusLabel = STATUS_RU.getOrDefault(statusDesc, statusDesc.isEmpty() ? "-" : statusDesc);

            JSONObject tourn = ev.optJSONObject("tournament");
            JSONObject cat = tourn != null ? tourn.optJSONObject("category") : null;
            JSONObject sportData = cat != null ? cat.optJSONObject("sport") : (tourn != null ? tourn.optJSONObject("sport") : null);
            String sportSlug = sportData != null ? sportData.optString("slug", "table-tennis") : "table-tennis";
            JSONObject roundInfo = ev.optJSONObject("roundInfo");
            JSONObject homeTeam = ev.optJSONObject("homeTeam");
            JSONObject awayTeam = ev.optJSONObject("awayTeam");

            String homeClean = ruName(homeTeam, "name");
            String awayClean = ruName(awayTeam, "name");
            String tournClean = ruName(tourn, "name");

            Object hid = homeTeam != null ? homeTeam.opt("id") : null;
            Object aid = awayTeam != null ? awayTeam.opt("id") : null;
            Object tid = tourn != null ? tourn.opt("id") : null;

            // 1. Votes
            JSONObject votes = new JSONObject();
            votes.put("vote1", 0);
            votes.put("vote2", 0);
            votes.put("voteX", 0);
            votes.put("hasDraw", false);
            try {
                String vrJson = fetchString("https://api.sofascore.com/api/v1/event/" + eventId + "/votes");
                if (vrJson != null) {
                    JSONObject vrRoot = new JSONObject(vrJson);
                    JSONObject vRaw = vrRoot.optJSONObject("vote");
                    if (vRaw != null) {
                        votes.put("vote1", vRaw.optInt("vote1", 0));
                        votes.put("vote2", vRaw.optInt("vote2", 0));
                        if (vRaw.has("voteX")) {
                            votes.put("voteX", vRaw.optInt("voteX", 0));
                            votes.put("hasDraw", true);
                        }
                    }
                }
            } catch (Exception ignored) {}

            // 2. Odds
            JSONArray oddsList = fetchOddsList(eventId);

            // 3. H2H Duel
            JSONObject h2hDuel = new JSONObject();
            h2hDuel.put("homeWins", 0);
            h2hDuel.put("awayWins", 0);
            h2hDuel.put("draws", 0);
            try {
                String hrJson = fetchString("https://api.sofascore.com/api/v1/event/" + eventId + "/h2h");
                if (hrJson != null) {
                    JSONObject hrRoot = new JSONObject(hrJson);
                    JSONObject td = hrRoot.optJSONObject("teamDuel");
                    if (td != null) {
                        h2hDuel.put("homeWins", td.optInt("homeWins", 0));
                        h2hDuel.put("awayWins", td.optInt("awayWins", 0));
                        h2hDuel.put("draws", td.optInt("draws", 0));
                    }
                }
            } catch (Exception ignored) {}

            // 4. Form and Direct matches
            List<JSONObject> homeFormList = new ArrayList<>();
            List<JSONObject> awayFormList = new ArrayList<>();
            List<JSONObject> directMatches = new ArrayList<>();

            if (hid != null) {
                try {
                    String hhrJson = fetchString("https://api.sofascore.com/api/v1/team/" + hid + "/events/last/0");
                    if (hhrJson != null) {
                        parseTeamFormEvents(new JSONObject(hhrJson).optJSONArray("events"), String.valueOf(hid), aid != null ? String.valueOf(aid) : null, eventId, homeFormList, directMatches);
                    }
                } catch (Exception ignored) {}
            }

            if (aid != null) {
                try {
                    String ahrJson = fetchString("https://api.sofascore.com/api/v1/team/" + aid + "/events/last/0");
                    if (ahrJson != null) {
                        parseTeamFormEvents(new JSONObject(ahrJson).optJSONArray("events"), String.valueOf(aid), hid != null ? String.valueOf(hid) : null, eventId, awayFormList, null);
                    }
                } catch (Exception ignored) {}
            }

            int homeWinsCnt = 0;
            for (JSONObject m : homeFormList) if (m.optBoolean("won")) homeWinsCnt++;
            int homeWinRate = !homeFormList.isEmpty() ? (int) Math.round((homeWinsCnt * 100.0) / homeFormList.size()) : 0;

            int awayWinsCnt = 0;
            for (JSONObject m : awayFormList) if (m.optBoolean("won")) awayWinsCnt++;
            int awayWinRate = !awayFormList.isEmpty() ? (int) Math.round((awayWinsCnt * 100.0) / awayFormList.size()) : 0;

            // 5. Tournament bracket / cuptrees
            JSONArray treeRounds = new JSONArray();
            String chosenTreeName = "";
            JSONObject uTourn = tourn != null ? tourn.optJSONObject("uniqueTournament") : null;
            Object utid = uTourn != null ? uTourn.opt("id") : null;
            JSONObject seasonObj = ev.optJSONObject("season");
            Object sid = seasonObj != null ? seasonObj.opt("id") : null;

            if (utid != null && sid != null) {
                try {
                    String ctreeUrl = "https://api.sofascore.com/api/v1/unique-tournament/" + utid + "/season/" + sid + "/cuptrees";
                    String ctrJson = fetchString(ctreeUrl);
                    if (ctrJson != null) {
                        JSONObject ctrRoot = new JSONObject(ctrJson);
                        JSONArray trees = ctrRoot.optJSONArray("cupTrees");
                        JSONObject chosenTree = null;
                        if (trees != null) {
                            for (int tIdx = 0; tIdx < trees.length(); tIdx++) {
                                JSONObject t = trees.optJSONObject(tIdx);
                                if (t == null) continue;
                                JSONArray rounds = t.optJSONArray("rounds");
                                if (rounds != null) {
                                    for (int rIdx = 0; rIdx < rounds.length(); rIdx++) {
                                        JSONObject r = rounds.optJSONObject(rIdx);
                                        if (r == null) continue;
                                        JSONArray blocks = r.optJSONArray("blocks");
                                        if (blocks != null) {
                                            for (int bIdx = 0; bIdx < blocks.length(); bIdx++) {
                                                JSONObject b = blocks.optJSONObject(bIdx);
                                                if (b == null) continue;
                                                JSONArray evIds = b.optJSONArray("events");
                                                if (evIds != null) {
                                                    for (int eIdx = 0; eIdx < evIds.length(); eIdx++) {
                                                        if (String.valueOf(evIds.opt(eIdx)).equals(eventId)) {
                                                            chosenTree = t;
                                                            break;
                                                        }
                                                    }
                                                }
                                                if (chosenTree != null) break;
                                            }
                                        }
                                        if (chosenTree != null) break;
                                    }
                                }
                                if (chosenTree != null) break;
                            }
                            if (chosenTree == null && trees.length() > 0) {
                                chosenTree = trees.optJSONObject(0);
                            }
                        }

                        if (chosenTree != null) {
                            chosenTreeName = ruName(chosenTree, "name");
                            JSONArray cRounds = chosenTree.optJSONArray("rounds");
                            if (cRounds != null) {
                                for (int rIdx = 0; rIdx < cRounds.length(); rIdx++) {
                                    JSONObject r = cRounds.optJSONObject(rIdx);
                                    if (r == null) continue;
                                    String desc = r.optString("description", "");
                                    String descLower = desc.trim().toLowerCase(Locale.US);
                                    String roundName = ROUND_NAMES_RU.getOrDefault(descLower, desc.isEmpty() ? ("Раунд " + (rIdx + 1)) : desc);

                                    JSONArray roundBlocks = new JSONArray();
                                    JSONArray blocks = r.optJSONArray("blocks");
                                    if (blocks != null) {
                                        for (int bIdx = 0; bIdx < blocks.length(); bIdx++) {
                                            JSONObject b = blocks.optJSONObject(bIdx);
                                            if (b == null) continue;
                                            JSONObject blockObj = new JSONObject();
                                            blockObj.put("blockId", b.opt("id"));
                                            blockObj.put("id", b.opt("id"));
                                            blockObj.put("order", b.optInt("order", bIdx + 1));
                                            blockObj.put("result", b.optString("result", ""));
                                            blockObj.put("finished", b.optBoolean("finished", false));
                                            blockObj.put("isLive", b.optBoolean("eventInProgress", false));

                                            JSONArray blockEvs = new JSONArray();
                                            JSONArray bEvIds = b.optJSONArray("events");
                                            boolean containsCurrent = false;
                                            String firstMatchId = null;
                                            if (bEvIds != null) {
                                                for (int beIdx = 0; beIdx < bEvIds.length(); beIdx++) {
                                                    String beId = String.valueOf(bEvIds.opt(beIdx));
                                                    blockEvs.put(beId);
                                                    if (firstMatchId == null) firstMatchId = beId;
                                                    if (beId.equals(eventId)) containsCurrent = true;
                                                }
                                            }
                                            blockObj.put("matchId", firstMatchId);
                                            blockObj.put("events", blockEvs);
                                            blockObj.put("isCurrent", containsCurrent);

                                            JSONArray pArr = new JSONArray();
                                            JSONArray partArr = b.optJSONArray("participants");
                                            List<JSONObject> pList = new ArrayList<>();
                                            if (partArr != null) {
                                                for (int pIdx = 0; pIdx < partArr.length(); pIdx++) {
                                                    JSONObject pt = partArr.optJSONObject(pIdx);
                                                    if (pt == null) continue;
                                                    JSONObject team = pt.optJSONObject("team");
                                                    JSONObject pObj = new JSONObject();
                                                    pObj.put("order", pt.optInt("order", pIdx + 1));
                                                    pObj.put("winner", pt.opt("winner"));
                                                    pObj.put("seed", pt.opt("seed"));
                                                    if (team != null) {
                                                        pObj.put("id", team.opt("id"));
                                                        pObj.put("name", ruName(team, "name"));
                                                    } else {
                                                        pObj.put("id", null);
                                                        pObj.put("name", "-");
                                                    }
                                                    pList.add(pObj);
                                                    pArr.put(pObj);
                                                }
                                            }
                                            blockObj.put("participants", pArr);

                                            JSONObject p1 = !pList.isEmpty() ? pList.get(0) : null;
                                            JSONObject p2 = pList.size() > 1 ? pList.get(1) : null;

                                            JSONObject home = new JSONObject();
                                            home.put("id", p1 != null ? p1.opt("id") : null);
                                            home.put("name", p1 != null ? p1.optString("name", "-") : "-");
                                            home.put("winner", p1 != null ? p1.opt("winner") : null);
                                            home.put("seed", p1 != null ? p1.opt("seed") : null);
                                            home.put("score", b.opt("homeTeamScore"));
                                            blockObj.put("home", home);

                                            JSONObject away = new JSONObject();
                                            away.put("id", p2 != null ? p2.opt("id") : null);
                                            away.put("name", p2 != null ? p2.optString("name", "-") : "-");
                                            away.put("winner", p2 != null ? p2.opt("winner") : null);
                                            away.put("seed", p2 != null ? p2.opt("seed") : null);
                                            away.put("score", b.opt("awayTeamScore"));
                                            blockObj.put("away", away);

                                            roundBlocks.put(blockObj);
                                        }
                                    }

                                    JSONObject rObj = new JSONObject();
                                    rObj.put("title", roundName);
                                    rObj.put("name", roundName);
                                    rObj.put("originalTitle", desc);
                                    rObj.put("order", r.optInt("order", rIdx + 1));
                                    rObj.put("blocks", roundBlocks);
                                    treeRounds.put(rObj);
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {}
            }

            // Fallback tournament stage matches
            JSONArray tournMatches = new JSONArray();
            if (treeRounds.length() == 0 && tid != null) {
                try {
                    String tmJson = fetchString("https://api.sofascore.com/api/v1/tournament/" + tid + "/events/last/0");
                    if (tmJson != null) {
                        JSONArray tmEvents = new JSONObject(tmJson).optJSONArray("events");
                        if (tmEvents != null) {
                            SimpleDateFormat sdfShort = new SimpleDateFormat("dd.MM", Locale.getDefault());
                            for (int i = 0; i < Math.min(tmEvents.length(), 10); i++) {
                                JSONObject te = tmEvents.optJSONObject(i);
                                if (te == null) continue;
                                JSONObject th = te.optJSONObject("homeTeam");
                                JSONObject ta = te.optJSONObject("awayTeam");
                                JSONObject ths = te.optJSONObject("homeScore");
                                JSONObject tas = te.optJSONObject("awayScore");
                                JSONObject tStat = te.optJSONObject("status");
                                String tDesc = tStat != null ? tStat.optString("description", "").toLowerCase(Locale.US) : "";
                                long tTs = te.optLong("startTimestamp", 0);

                                JSONObject thObj = new JSONObject();
                                thObj.put("name", ruName(th, "name"));
                                thObj.put("score", ths != null ? ths.opt("current") : null);

                                JSONObject taObj = new JSONObject();
                                taObj.put("name", ruName(ta, "name"));
                                taObj.put("score", tas != null ? tas.opt("current") : null);

                                JSONObject tm = new JSONObject();
                                tm.put("id", String.valueOf(te.opt("id")));
                                tm.put("homeTeam", thObj);
                                tm.put("awayTeam", taObj);
                                tm.put("score", (ths != null ? ths.opt("current") : "-") + ":" + (tas != null ? tas.opt("current") : "-"));
                                tm.put("date", tTs > 0 ? sdfShort.format(new Date(tTs * 1000L)) : "-");
                                tm.put("status", STATUS_RU.getOrDefault(tDesc, tDesc));
                                tm.put("isCurrent", String.valueOf(te.opt("id")).equals(eventId));
                                tm.put("isLive", "inprogress".equalsIgnoreCase(tDesc) || (tStat != null && "inprogress".equalsIgnoreCase(tStat.optString("type"))));
                                tournMatches.put(tm);
                            }
                        }
                    }
                } catch (Exception ignored) {}
            }

            // 6. Media and Highlights
            JSONArray videosList = new JSONArray();
            Set<String> seenVideos = new HashSet<>();
            try {
                JSONArray rawMedia = new JSONArray();
                String[] mediaUrls = new String[] {
                    "https://api.sofascore.com/api/v1/event/" + eventId + "/media",
                    "https://api.sofascore.app/api/v1/event/" + eventId + "/media"
                };
                for (String mUrl : mediaUrls) {
                    String medJson = fetchString(mUrl);
                    if (medJson != null) {
                        JSONArray mArr = new JSONObject(medJson).optJSONArray("media");
                        if (mArr != null && mArr.length() > 0) {
                            rawMedia = mArr;
                            break;
                        }
                    }
                }

                // Fallback to highlights
                if (rawMedia.length() == 0) {
                    String[] hlUrls = new String[] {
                        "https://api.sofascore.com/api/v1/event/" + eventId + "/highlights",
                        "https://api.sofascore.app/api/v1/event/" + eventId + "/highlights"
                    };
                    for (String hlUrl : hlUrls) {
                        String hlJson = fetchString(hlUrl);
                        if (hlJson != null) {
                            JSONObject hlObj = new JSONObject(hlJson);
                            JSONArray hlArr = hlObj.optJSONArray("highlights");
                            if (hlArr == null) hlArr = hlObj.optJSONArray("media");
                            if (hlArr != null && hlArr.length() > 0) {
                                rawMedia = hlArr;
                                break;
                            }
                        }
                    }
                }

                // Fallback to team media with opponent filter
                if (rawMedia.length() == 0 && (hid != null || aid != null)) {
                    Object[] tIds = new Object[] { hid, aid };
                    for (Object tIdObj : tIds) {
                        if (tIdObj == null) continue;
                        String tMediaJson = fetchString("https://api.sofascore.com/api/v1/team/" + tIdObj + "/media");
                        if (tMediaJson == null) {
                            tMediaJson = fetchString("https://api.sofascore.app/api/v1/team/" + tIdObj + "/media");
                        }
                        if (tMediaJson != null) {
                            JSONArray tMediaArr = new JSONObject(tMediaJson).optJSONArray("media");
                            if (tMediaArr != null) {
                                String oppClean = (tIdObj.equals(hid) ? awayClean : homeClean).toLowerCase(Locale.ROOT);
                                String[] oppParts = oppClean.split("\\s+");
                                List<String> validParts = new ArrayList<>();
                                for (String p : oppParts) {
                                    if (p.trim().length() > 3) validParts.add(p.trim());
                                }
                                for (int tmIdx = 0; tmIdx < tMediaArr.length(); tmIdx++) {
                                    JSONObject tm = tMediaArr.optJSONObject(tmIdx);
                                    if (tm == null) continue;
                                    String titleLower = tm.optString("title", "").toLowerCase(Locale.ROOT);
                                    boolean matchesOpp = false;
                                    for (String vp : validParts) {
                                        if (titleLower.contains(vp)) {
                                            matchesOpp = true;
                                            break;
                                        }
                                    }
                                    if (matchesOpp || validParts.isEmpty()) {
                                        rawMedia.put(tm);
                                    }
                                }
                            }
                        }
                    }
                }

                SimpleDateFormat sdfMedia = new SimpleDateFormat("dd.MM.yyyy", Locale.getDefault());
                for (int mIdx = 0; mIdx < rawMedia.length(); mIdx++) {
                    JSONObject m = rawMedia.optJSONObject(mIdx);
                    if (m == null) continue;
                    String urlVal = m.optString("url", m.optString("sourceUrl", m.optString("externalUrl", "")));
                    String ytId = extractYtId(urlVal);
                    if (!ytId.isEmpty() && !seenVideos.contains(ytId)) {
                        seenVideos.add(ytId);
                        long createdTs = m.optLong("createdAtTimestamp", 0);
                        JSONObject v = new JSONObject();
                        v.put("id", m.opt("id"));
                        v.put("title", m.optString("title", m.optString("subtitle", "Видео матча")));
                        v.put("subtitle", m.optString("subtitle", ""));
                        v.put("url", urlVal);
                        v.put("youtubeId", ytId);
                        v.put("videoId", ytId);
                        v.put("thumbnailUrl", m.optString("thumbnailUrl", "https://i.ytimg.com/vi/" + ytId + "/hqdefault.jpg"));
                        v.put("date", createdTs > 0 ? sdfMedia.format(new Date(createdTs * 1000L)) : "");
                        v.put("source", "Sofascore");
                        videosList.put(v);
                    }
                }
            } catch (Exception ignored) {}

            JSONArray newsList = new JSONArray();
            try {
                String newsJson = fetchString("https://api.sofascore.com/api/v1/event/" + eventId + "/media/news");
                if (newsJson == null) {
                    newsJson = fetchString("https://api.sofascore.app/api/v1/event/" + eventId + "/media/news");
                }
                JSONArray nArr = null;
                if (newsJson != null) {
                    JSONObject newsObj = new JSONObject(newsJson);
                    nArr = newsObj.optJSONArray("newsArticles");
                    if (nArr == null) nArr = newsObj.optJSONArray("news");
                }

                if ((nArr == null || nArr.length() == 0) && (hid != null || aid != null)) {
                    Object[] tIds = new Object[] { hid, aid };
                    for (Object tIdObj : tIds) {
                        if (tIdObj == null) continue;
                        String tNewsJson = fetchString("https://api.sofascore.com/api/v1/team/" + tIdObj + "/media/news");
                        if (tNewsJson == null) {
                            tNewsJson = fetchString("https://api.sofascore.app/api/v1/team/" + tIdObj + "/media/news");
                        }
                        if (tNewsJson != null) {
                            JSONObject tNewsObj = new JSONObject(tNewsJson);
                            JSONArray tArr = tNewsObj.optJSONArray("newsArticles");
                            if (tArr == null) tArr = tNewsObj.optJSONArray("news");
                            if (tArr != null && tArr.length() > 0) {
                                nArr = tArr;
                                break;
                            }
                        }
                    }
                }

                if (nArr != null) {
                    SimpleDateFormat sdfNews = new SimpleDateFormat("dd.MM.yyyy", Locale.getDefault());
                    for (int nIdx = 0; nIdx < Math.min(nArr.length(), 6); nIdx++) {
                        JSONObject item = nArr.optJSONObject(nIdx);
                        if (item == null) continue;
                        long nTs = item.optLong("publishedAtTimestamp", item.optLong("startTimestamp", 0));
                        JSONObject provider = item.optJSONObject("newsProvider");
                        String provName = provider != null ? provider.optString("name", "Sofascore") : item.optString("source", "Sofascore");

                        JSONObject n = new JSONObject();
                        n.put("id", item.opt("id"));
                        n.put("title", item.optString("header", item.optString("title", "Новость")));
                        n.put("lead", item.optString("description", item.optString("lead", "")));
                        n.put("source", provName);
                        n.put("url", item.optString("externalUrl", item.optString("url", "")));
                        n.put("thumbnailUrl", item.optString("thumbnailUrl", item.optString("imageUrl", "")));
                        n.put("timestamp", nTs);
                        n.put("date", nTs > 0 ? sdfNews.format(new Date(nTs * 1000L)) : "");
                        newsList.put(n);
                    }
                }
            } catch (Exception ignored) {}

            // Combine into full result
            JSONObject result = new JSONObject();
            result.put("success", true);
            result.put("id", ev.optString("id", eventId));
            result.put("sport", sportSlug);
            result.put("date", dtStr);
            result.put("startTimestamp", ts);
            result.put("status", statusLabel);
            result.put("isLive", statusObj != null && "inprogress".equalsIgnoreCase(statusObj.optString("type")));
            result.put("tournament", tournClean.isEmpty() ? "Турнир" : tournClean);
            result.put("category", ruName(cat, "name"));
            result.put("round", roundInfo != null ? roundInfo.optString("name", "") : "");
            result.put("winnerCode", ev.opt("winnerCode"));

            JSONObject ht = new JSONObject();
            ht.put("id", hid);
            ht.put("name", homeClean);
            ht.put("sets", hs != null ? hs.opt("current") : null);
            ht.put("ranking", homeTeam != null ? homeTeam.opt("ranking") : null);
            result.put("homeTeam", ht);

            JSONObject at = new JSONObject();
            at.put("id", aid);
            at.put("name", awayClean);
            at.put("sets", aws != null ? aws.opt("current") : null);
            at.put("ranking", awayTeam != null ? awayTeam.opt("ranking") : null);
            result.put("awayTeam", at);

            result.put("sets", sets);
            result.put("votes", votes);
            result.put("odds", oddsList);

            JSONObject h2hObj = new JSONObject();
            h2hObj.put("duel", h2hDuel);
            JSONArray dmArr = new JSONArray();
            for (JSONObject dm : directMatches) dmArr.put(dm);
            h2hObj.put("matches", dmArr);
            result.put("h2h", h2hObj);

            JSONObject formObj = new JSONObject();
            JSONObject hf = new JSONObject();
            hf.put("streak", calcStreak(homeFormList));
            hf.put("winRate", homeWinRate);
            JSONArray hfArr = new JSONArray();
            for (JSONObject hm : homeFormList) hfArr.put(hm);
            hf.put("matches", hfArr);
            formObj.put("home", hf);

            JSONObject af = new JSONObject();
            af.put("streak", calcStreak(awayFormList));
            af.put("winRate", awayWinRate);
            JSONArray afArr = new JSONArray();
            for (JSONObject am : awayFormList) afArr.put(am);
            af.put("matches", afArr);
            formObj.put("away", af);
            result.put("form", formObj);

            JSONObject bracketObj = new JSONObject();
            bracketObj.put("hasTree", treeRounds.length() > 0);
            bracketObj.put("treeName", chosenTreeName);
            bracketObj.put("tree", treeRounds);
            bracketObj.put("matches", tournMatches);
            result.put("bracket", bracketObj);

            JSONObject mediaObj = new JSONObject();
            mediaObj.put("hasMedia", videosList.length() > 0 || newsList.length() > 0);
            mediaObj.put("videos", videosList);
            mediaObj.put("news", newsList);
            result.put("media", mediaObj);

            return result.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error in handleMatchAction", e);
            return "{\"success\":false,\"error\":\"Ошибка загрузки данных матча\"}";
        }
    }

    private static JSONArray fetchOddsList(String eventId) {
        JSONArray oddsList = new JSONArray();
        String[] urls = new String[] {
            "https://api.sofascore.com/api/v1/event/" + eventId + "/odds/featured",
            "https://api.sofascore.app/api/v1/event/" + eventId + "/odds/featured",
            "https://api.sofascore.com/api/v1/event/" + eventId + "/odds/1/all",
            "https://api.sofascore.app/api/v1/event/" + eventId + "/odds/1/all",
            "https://api.sofascore.com/api/v1/event/" + eventId + "/odds/2/all",
            "https://api.sofascore.app/api/v1/event/" + eventId + "/odds/2/all"
        };

        for (String url : urls) {
            try {
                String jsonStr = fetchString(url);
                if (jsonStr == null || jsonStr.trim().isEmpty()) continue;
                JSONObject root = new JSONObject(jsonStr);

                // 1. Standard markets array
                JSONArray markets = root.optJSONArray("markets");
                if (markets != null && markets.length() > 0) {
                    for (int mIdx = 0; mIdx < markets.length(); mIdx++) {
                        JSONObject mObj = markets.optJSONObject(mIdx);
                        if (mObj == null) continue;
                        JSONArray choicesArr = mObj.optJSONArray("choices");
                        JSONArray choices = parseChoices(choicesArr);
                        if (choices.length() > 0) {
                            JSONObject market = new JSONObject();
                            market.put("market", mObj.optString("marketName", "Full time"));
                            market.put("choices", choices);
                            oddsList.put(market);
                        }
                    }
                }

                // 2. Featured object (/odds/featured)
                if (oddsList.length() == 0) {
                    JSONObject featured = root.optJSONObject("featured");
                    if (featured != null) {
                        Iterator<String> keys = featured.keys();
                        while (keys.hasNext()) {
                            String key = keys.next();
                            JSONObject mObj = featured.optJSONObject(key);
                            if (mObj == null) continue;
                            JSONArray choicesArr = mObj.optJSONArray("choices");
                            JSONArray choices = parseChoices(choicesArr);
                            if (choices.length() > 0) {
                                JSONObject market = new JSONObject();
                                market.put("market", mObj.optString("marketName", key));
                                market.put("choices", choices);
                                oddsList.put(market);
                            }
                        }
                    }
                }

                if (oddsList.length() > 0) {
                    break;
                }
            } catch (Exception ignored) {}
        }
        return oddsList;
    }

    private static JSONArray parseChoices(JSONArray choicesArr) {
        JSONArray choices = new JSONArray();
        if (choicesArr == null) return choices;
        for (int cIdx = 0; cIdx < choicesArr.length(); cIdx++) {
            JSONObject c = choicesArr.optJSONObject(cIdx);
            if (c == null) continue;
            try {
                String cName = c.optString("name", "");
                Object decVal = c.opt("decimalValue");
                if (decVal == null) decVal = c.opt("initialDecimalValue");
                String fVal = c.optString("fractionalValue", c.optString("initialFractionalValue", ""));
                if (decVal == null && fVal.contains("/")) {
                    try {
                        String[] p = fVal.split("/");
                        decVal = Math.round((Double.parseDouble(p[0]) / Double.parseDouble(p[1]) + 1.0) * 100.0) / 100.0;
                    } catch (Exception ignored) {}
                }
                JSONObject choice = new JSONObject();
                choice.put("name", cName);
                choice.put("val", decVal != null ? decVal : fVal);
                choice.put("change", c.optInt("change", 0));
                choices.put(choice);
            } catch (Exception ignored) {}
        }
        return choices;
    }

    private static void parseTeamFormEvents(JSONArray events, String teamId, String oppId, String currentEventId, List<JSONObject> formList, List<JSONObject> directList) {
        if (events == null) return;
        SimpleDateFormat sdf = new SimpleDateFormat("dd.MM", Locale.getDefault());
        int count = 0;
        for (int i = 0; i < events.length(); i++) {
            JSONObject e = events.optJSONObject(i);
            if (e == null) continue;
            String eid = String.valueOf(e.opt("id"));
            if (eid.equals(currentEventId)) continue;

            JSONObject ht = e.optJSONObject("homeTeam");
            JSONObject at = e.optJSONObject("awayTeam");
            boolean isHome = ht != null && String.valueOf(ht.opt("id")).equals(teamId);
            boolean isAway = at != null && String.valueOf(at.opt("id")).equals(teamId);
            if (!isHome && !isAway) continue;

            JSONObject opp = isHome ? at : ht;
            JSONObject hs = e.optJSONObject("homeScore");
            JSONObject aws = e.optJSONObject("awayScore");

            Object pSets = isHome ? (hs != null ? hs.opt("current") : null) : (aws != null ? aws.opt("current") : null);
            Object oSets = isHome ? (aws != null ? aws.opt("current") : null) : (hs != null ? hs.opt("current") : null);

            int wc = e.optInt("winnerCode", 0);
            Boolean won = null;
            if (wc == 1) won = isHome;
            else if (wc == 2) won = !isHome;
            else if (pSets instanceof Number && oSets instanceof Number) {
                won = ((Number) pSets).intValue() > ((Number) oSets).intValue();
            }

            long ts = e.optLong("startTimestamp", 0);
            String dtStr = ts > 0 ? sdf.format(new Date(ts * 1000L)) : "-";
            JSONObject tourn = e.optJSONObject("tournament");

            StringBuilder setsSb = new StringBuilder();
            for (int p = 1; p <= 7; p++) {
                String key = "period" + p;
                if ((hs != null && hs.has(key)) || (aws != null && aws.has(key))) {
                    Object p1 = hs != null ? hs.opt(key) : null;
                    Object p2 = aws != null ? aws.opt(key) : null;
                    if (p1 != null || p2 != null) {
                        if (setsSb.length() > 0) setsSb.append(", ");
                        setsSb.append(p1 != null ? p1 : 0).append("-").append(p2 != null ? p2 : 0);
                    }
                }
            }
            String setsStr = setsSb.toString();

            JSONObject m = new JSONObject();
            try {
                m.put("id", eid);
                m.put("date", dtStr);
                m.put("startTimestamp", ts);
                m.put("won", won != null ? won : JSONObject.NULL);
                m.put("score", (pSets != null ? pSets : 0) + ":" + (oSets != null ? oSets : 0));
                m.put("scoreStr", (pSets != null && oSets != null) ? (pSets + " - " + oSets) : "-");
                m.put("setsStr", setsStr);
                m.put("opponent", opp != null ? ruName(opp, "name") : "Соперник");
                m.put("tournament", ruName(tourn, "name"));
            } catch (Exception ignored) {}

            if (count < 5) {
                formList.add(m);
                count++;
            }

            if (directList != null && oppId != null && opp != null && String.valueOf(opp.opt("id")).equals(oppId)) {
                JSONObject dm = new JSONObject();
                try {
                    dm.put("id", eid);
                    dm.put("date", dtStr);
                    dm.put("startTimestamp", ts);
                    dm.put("tournament", ruName(tourn, "name"));
                    dm.put("homeTeam", ht != null ? ruName(ht, "name") : "Игрок 1");
                    dm.put("awayTeam", at != null ? ruName(at, "name") : "Игрок 2");
                    Object hp = hs != null ? hs.opt("current") : null;
                    Object ap = aws != null ? aws.opt("current") : null;
                    dm.put("homeScore", hp);
                    dm.put("awayScore", ap);
                    dm.put("scoreStr", (hp != null && ap != null) ? (hp + " - " + ap) : "-");
                    dm.put("winnerCode", wc);
                    dm.put("setsStr", setsStr);
                    directList.add(dm);
                } catch (Exception ignored) {}
            }
        }
    }

    private static JSONObject calcStreak(List<JSONObject> formList) {
        JSONObject res = new JSONObject();
        try {
            if (formList == null || formList.isEmpty()) {
                res.put("type", "none");
                res.put("count", 0);
                res.put("text", "Нет данных");
                return res;
            }
            JSONObject first = formList.get(0);
            if (first.isNull("won")) {
                res.put("type", "draw");
                res.put("count", 1);
                res.put("text", "1 ничья");
                return res;
            }
            boolean firstWon = first.optBoolean("won");
            int count = 0;
            for (JSONObject m : formList) {
                if (!m.isNull("won") && m.optBoolean("won") == firstWon) {
                    count++;
                } else {
                    break;
                }
            }
            if (count == 0) {
                res.put("type", "none");
                res.put("count", 0);
                res.put("text", "Нет данных");
                return res;
            }
            if (firstWon) {
                String txt = (count >= 2 && count <= 4) ? (count + " победы подряд") : (count >= 5 ? (count + " побед подряд") : "1 победа");
                res.put("type", "win");
                res.put("count", count);
                res.put("text", txt);
            } else {
                String txt = (count >= 2 && count <= 4) ? (count + " поражения подряд") : (count >= 5 ? (count + " поражений подряд") : "1 поражение");
                res.put("type", "loss");
                res.put("count", count);
                res.put("text", txt);
            }
        } catch (Exception ignored) {}
        return res;
    }

    // Action search
    public static String handleSearchAction(String q) {
        if (q == null || q.trim().isEmpty()) return "{\"success\":true,\"players\":[]}";
        try {
            String url = "https://api.sofascore.com/api/v1/search/" + URLEncoder.encode(q, "UTF-8");
            String rawJson = fetchString(url);
            if (rawJson == null) {
                url = "https://api.sofascore.app/api/v1/search/" + URLEncoder.encode(q, "UTF-8");
                rawJson = fetchString(url);
            }
            return parseSearchJson(rawJson);
        } catch (Exception e) {
            Log.e(TAG, "Error in handleSearchAction", e);
            return "{\"success\":true,\"players\":[]}";
        }
    }

    public static String parseSearchJson(String rawJson) {
        if (rawJson == null || rawJson.trim().isEmpty()) {
            return "{\"success\":true,\"players\":[]}";
        }
        try {
            JSONObject root = new JSONObject(rawJson);
            JSONArray results = root.optJSONArray("results");
            JSONArray players = new JSONArray();

            if (results != null) {
                for (int i = 0; i < results.length(); i++) {
                    JSONObject r = results.optJSONObject(i);
                    if (r == null) continue;
                    JSONObject entity = r.optJSONObject("entity");
                    if (entity == null) continue;

                    JSONObject sportObj = entity.optJSONObject("sport");
                    String sportSlug = sportObj != null ? sportObj.optString("slug", "") : "";
                    if (!sportSlug.isEmpty() && !sportSlug.equals("table-tennis") && !sportSlug.equals("tennis") && !sportSlug.equals("football")) {
                        continue;
                    }

                    JSONObject cat = entity.optJSONObject("country");
                    JSONObject p = new JSONObject();
                    p.put("id", entity.opt("id"));
                    p.put("name", ruName(entity, "name"));
                    p.put("country", ruName(cat, "name"));
                    p.put("sport", sportSlug);
                    p.put("ranking", entity.opt("ranking"));
                    p.put("gender", entity.optString("gender", ""));
                    players.put(p);
                }
            }

            JSONObject res = new JSONObject();
            res.put("success", true);
            res.put("players", players);
            return res.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error parsing search JSON", e);
            return "{\"success\":true,\"players\":[]}";
        }
    }

    private static final String SVG_AVATAR_FALLBACK = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\" fill=\"#9CA3AF\"><circle cx=\"24\" cy=\"24\" r=\"24\" fill=\"#E5E7EB\"/><path d=\"M24 23a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 4c-6.67 0-14 3.33-14 10v1h28v-1c0-6.67-7.33-10-14-10z\"/></svg>";

    private static WebResourceResponse svgFallbackResponse() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Content-Type", "image/svg+xml");
        headers.put("Cache-Control", "public, max-age=604800");
        byte[] data = SVG_AVATAR_FALLBACK.getBytes(StandardCharsets.UTF_8);
        return new WebResourceResponse("image/svg+xml", "UTF-8", 200, "OK", headers, new ByteArrayInputStream(data));
    }

    // Action image
    public static WebResourceResponse handleImageAction(String id) {
        if (id == null || id.trim().isEmpty()) {
            return svgFallbackResponse();
        }

        // Check disk cache first for avatar
        File imgCache = getCacheFile("img_" + id);
        if (imgCache != null && imgCache.exists()) {
            try {
                byte[] data = new byte[(int) imgCache.length()];
                try (InputStream fis = new FileInputStream(imgCache)) {
                    int r = 0;
                    while (r < data.length) {
                        int read = fis.read(data, r, data.length - r);
                        if (read == -1) break;
                        r += read;
                    }
                }
                Map<String, String> headers = new HashMap<>();
                headers.put("Access-Control-Allow-Origin", "*");
                headers.put("Cache-Control", "public, max-age=2592000");
                return new WebResourceResponse("image/webp", null, 200, "OK", headers, new ByteArrayInputStream(data));
            } catch (Exception ignored) {}
        }

        // Try img.sofascore.com first (direct CDN without 403 blocks)
        String[] urls = new String[] {
            "https://img.sofascore.com/api/v1/team/" + id + "/image",
            "https://api.sofascore.com/api/v1/team/" + id + "/image",
            "https://api.sofascore.app/api/v1/team/" + id + "/image"
        };

        for (String url : urls) {
            HttpURLConnection conn = null;
            try {
                conn = openConnection(url);
                int respCode = conn.getResponseCode();
                if (respCode == 200) {
                    InputStream is = conn.getInputStream();
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    byte[] buffer = new byte[4096];
                    int n;
                    while ((n = is.read(buffer)) != -1) {
                        baos.write(buffer, 0, n);
                    }
                    byte[] imgBytes = baos.toByteArray();
                    if (imgCache != null) {
                        try (FileOutputStream fos = new FileOutputStream(imgCache)) {
                            fos.write(imgBytes);
                        } catch (Exception ignored) {}
                    }
                    String contentType = conn.getContentType();
                    if (contentType == null || contentType.isEmpty()) {
                        contentType = "image/webp";
                    }
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Access-Control-Allow-Origin", "*");
                    headers.put("Cache-Control", "public, max-age=604800");
                    return new WebResourceResponse(contentType, null, 200, "OK", headers, new ByteArrayInputStream(imgBytes));
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to load image from " + url, e);
            } finally {
                if (conn != null) {
                    try { conn.disconnect(); } catch (Exception ignored) {}
                }
            }
        }
        return svgFallbackResponse();
    }

    // Network helper with cache and connection mode routing
    public static String fetchString(String urlStr) {
        long ttlSeconds = 7200; // default 2 hours cache for details/profiles
        if (urlStr.contains("/events/live")) {
            ttlSeconds = 5; // 5 seconds for live
        } else if (urlStr.contains("/search/")) {
            ttlSeconds = 3600; // 1 hour for search
        }

        // 1. Check cache first
        String cached = getDiskCache(urlStr, ttlSeconds);
        if (cached != null && !cached.isEmpty()) {
            return cached;
        }

        // 2. Fetch from network
        String result = fetchStringNetworkOnly(urlStr);
        if (result != null && !result.isEmpty()) {
            putDiskCache(urlStr, result);
            return result;
        }

        // 3. Fallback to stale cache if network failed
        String stale = getDiskCache(urlStr, -1);
        if (stale != null && !stale.isEmpty()) {
            Log.d(TAG, "Using stale cache for " + urlStr);
            return stale;
        }

        return null;
    }

    public static String fetchStringNetworkOnly(String urlStr) {
        String mode = currentConnectionMode;
        if (mode == null || mode.isEmpty()) mode = "auto";

        if ("proxy".equalsIgnoreCase(mode)) {
            return fetchViaProxy(urlStr);
        } else if ("relay1".equalsIgnoreCase(mode) || "relay".equalsIgnoreCase(mode)) {
            return fetchViaRelay(urlStr, configuredRelayUrl);
        } else if ("relay2".equalsIgnoreCase(mode)) {
            return fetchViaRelay(urlStr, configuredRelay2Url);
        } else if ("direct".equalsIgnoreCase(mode)) {
            return fetchDirect(urlStr);
        } else {
            // Auto mode: try proxy -> relay1 -> relay2 -> direct
            String res = fetchViaProxy(urlStr);
            if (res != null) return res;

            if (configuredRelayUrl != null && !configuredRelayUrl.trim().isEmpty()) {
                res = fetchViaRelay(urlStr, configuredRelayUrl);
                if (res != null) return res;
            }
            if (configuredRelay2Url != null && !configuredRelay2Url.trim().isEmpty()) {
                res = fetchViaRelay(urlStr, configuredRelay2Url);
                if (res != null) return res;
            }
            return fetchDirect(urlStr);
        }
    }

    private static String fetchDirect(String urlStr) {
        HttpURLConnection conn = null;
        try {
            conn = openConnection(urlStr);
            int code = conn.getResponseCode();
            if (code == 200) {
                return readStream(conn.getInputStream());
            } else {
                Log.w(TAG, "Direct HTTP " + code + " for " + urlStr);
            }
        } catch (Exception e) {
            Log.w(TAG, "Direct error fetching " + urlStr + ": " + e.getMessage());
        } finally {
            if (conn != null) {
                try { conn.disconnect(); } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private static String fetchViaRelay(String urlStr, String relayUrl) {
        if (relayUrl == null || relayUrl.trim().isEmpty()) return null;
        HttpURLConnection conn = null;
        try {
            String relay = relayUrl.trim();
            String target;
            if (relay.contains("?url=")) {
                target = relay + URLEncoder.encode(urlStr, "UTF-8");
            } else if (relay.endsWith("?")) {
                target = relay + "url=" + URLEncoder.encode(urlStr, "UTF-8");
            } else if (relay.contains("?")) {
                target = relay + "&url=" + URLEncoder.encode(urlStr, "UTF-8");
            } else {
                target = relay.replaceAll("/+$", "") + "/?url=" + URLEncoder.encode(urlStr, "UTF-8");
            }
            URL u = new URL(target);
            conn = (HttpURLConnection) u.openConnection();
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
            conn.setRequestProperty("Accept", "application/json, text/plain, */*");
            conn.setConnectTimeout(2500);
            conn.setReadTimeout(3000);
            int code = conn.getResponseCode();
            if (code == 200) {
                return readStream(conn.getInputStream());
            } else {
                Log.w(TAG, "Relay HTTP " + code + " for " + target);
            }
        } catch (Exception e) {
            Log.w(TAG, "Relay error for " + urlStr + ": " + e.getMessage());
        } finally {
            if (conn != null) {
                try { conn.disconnect(); } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private static String fetchViaProxy(String urlStr) {
        String pStr = (customProxyUrl != null && !customProxyUrl.trim().isEmpty())
                ? customProxyUrl.trim() : STOCK_PROXY;
        if (pStr.isEmpty()) return null;

        HttpURLConnection conn = null;
        try {
            boolean isSocks = pStr.startsWith("socks5://") || pStr.startsWith("socks://") || pStr.startsWith("socks4://");
            String cleaned = pStr.replaceFirst("^[a-zA-Z0-9]+://", "");
            String user = null;
            String pass = null;
            if (cleaned.contains("@")) {
                int atIdx = cleaned.indexOf("@");
                String auth = cleaned.substring(0, atIdx);
                cleaned = cleaned.substring(atIdx + 1);
                if (auth.contains(":")) {
                    String[] userPass = auth.split(":", 2);
                    user = userPass[0];
                    pass = userPass[1];
                } else {
                    user = auth;
                }
            }

            String host;
            int port = isSocks ? 1080 : 8080;
            if (cleaned.contains(":")) {
                String[] hostPort = cleaned.split(":", 2);
                host = hostPort[0];
                try { port = Integer.parseInt(hostPort[1]); } catch (Exception ignored) {}
            } else {
                host = cleaned;
            }

            if (user != null && pass != null) {
                final String finalUser = user;
                final String finalPass = pass;
                Authenticator.setDefault(new Authenticator() {
                    @Override
                    protected PasswordAuthentication getPasswordAuthentication() {
                        return new PasswordAuthentication(finalUser, finalPass.toCharArray());
                    }
                });
            }

            Proxy proxy = new Proxy(isSocks ? Proxy.Type.SOCKS : Proxy.Type.HTTP, new InetSocketAddress(host, port));
            URL u = new URL(urlStr);
            conn = (HttpURLConnection) u.openConnection(proxy);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
            conn.setRequestProperty("Origin", "https://www.sofascore.com");
            conn.setRequestProperty("Referer", "https://www.sofascore.com/");
            conn.setRequestProperty("Accept", "application/json, text/plain, */*");
            conn.setRequestProperty("Accept-Language", "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7");
            conn.setConnectTimeout(2500);
            conn.setReadTimeout(3000);
            int code = conn.getResponseCode();
            if (code == 200) {
                return readStream(conn.getInputStream());
            } else {
                Log.w(TAG, "Proxy HTTP " + code + " for " + urlStr);
            }
        } catch (Exception e) {
            Log.w(TAG, "Proxy error for " + urlStr + ": " + e.getMessage());
        } finally {
            if (conn != null) {
                try { conn.disconnect(); } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private static String readStream(InputStream is) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = is.read(buffer)) != -1) {
            baos.write(buffer, 0, read);
        }
        return baos.toString("UTF-8");
    }

    public static String handleTestConnection() {
        long start = System.currentTimeMillis();
        String testUrl = "https://api.sofascore.com/api/v1/sport/table-tennis/events/live";
        String raw = fetchStringNetworkOnly(testUrl);
        long duration = System.currentTimeMillis() - start;
        if (raw != null && raw.contains("events")) {
            try {
                JSONObject obj = new JSONObject(raw);
                JSONArray events = obj.optJSONArray("events");
                int count = events != null ? events.length() : 0;
                return "{\"success\":true,\"matches\":[{\"count\":" + count + "}],\"duration\":" + duration + "}";
            } catch (Exception ignored) {
                return "{\"success\":true,\"matches\":[],\"duration\":" + duration + "}";
            }
        }
        return "{\"success\":false,\"error\":\"Сервер недоступен или блокируется\",\"duration\":" + duration + "}";
    }

    private static HttpURLConnection openConnection(String urlStr) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn;
        if (cronetEngine != null) {
            try {
                conn = (HttpURLConnection) cronetEngine.openConnection(url);
            } catch (Throwable t) {
                conn = (HttpURLConnection) url.openConnection();
            }
        } else {
            conn = (HttpURLConnection) url.openConnection();
        }

        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
        conn.setRequestProperty("Origin", "https://www.sofascore.com");
        conn.setRequestProperty("Referer", "https://www.sofascore.com/");
        conn.setRequestProperty("Accept", "application/json, text/plain, */*");
        conn.setRequestProperty("Accept-Language", "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7");
        conn.setConnectTimeout(2500);
        conn.setReadTimeout(3000);
        return conn;
    }

    private static WebResourceResponse jsonResponse(String jsonString) {
        byte[] data = jsonString.getBytes(StandardCharsets.UTF_8);
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Content-Type", "application/json; charset=utf-8");
        return new WebResourceResponse(
                "application/json",
                "UTF-8",
                200,
                "OK",
                headers,
                new ByteArrayInputStream(data)
        );
    }

    private static WebResourceResponse errorResponse(String message) {
        String escaped = message.replace("\"", "\\\"").replace("\n", " ");
        String json = "{\"success\":false,\"error\":\"" + escaped + "\",\"matches\":[]}";
        return jsonResponse(json);
    }
}
