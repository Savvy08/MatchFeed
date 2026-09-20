package mgks.os.swv;

import android.content.Context;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceResponse;

import org.chromium.net.CronetEngine;
import com.google.android.gms.net.CronetProviderInstaller;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

// SofaScore client using Cronet with Chrome TLS fingerprint
public class SofaScoreClient {
    private static final String TAG = "SofaScoreClient";
    private static CronetEngine cronetEngine;

    // Status translations
    private static final Map<String, String> STATUS_RU = new HashMap<>();
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
        STATUS_RU.put("set 1", "Сет 1");
        STATUS_RU.put("set 2", "Сет 2");
        STATUS_RU.put("set 3", "Сет 3");
        STATUS_RU.put("set 4", "Сет 4");
        STATUS_RU.put("set 5", "Сет 5");
        STATUS_RU.put("set 6", "Сет 6");
        STATUS_RU.put("set 7", "Сет 7");
        STATUS_RU.put("1st set", "Сет 1");
        STATUS_RU.put("2nd set", "Сет 2");
        STATUS_RU.put("3rd set", "Сет 3");
        STATUS_RU.put("4th set", "Сет 4");
        STATUS_RU.put("5th set", "Сет 5");
        STATUS_RU.put("pause", "Пауза");
        STATUS_RU.put("break time", "Перерыв");
        STATUS_RU.put("postponed", "Перенесён");
        STATUS_RU.put("cancelled", "Отменён");
    }

    public static synchronized void init(Context context) {
        if (cronetEngine != null) return;
        try {
            try {
                CronetProviderInstaller.installProvider(context.getApplicationContext());
            } catch (Throwable t) {
                Log.w(TAG, "CronetProviderInstaller skipped: " + t.getMessage());
            }
            CronetEngine.Builder builder = new CronetEngine.Builder(context.getApplicationContext());
            builder.enableHttp2(true)
                   .enableQuic(true)
                   .setUserAgent("Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
            cronetEngine = builder.build();
            Log.d(TAG, "CronetEngine initialized successfully");
        } catch (Throwable t) {
            Log.w(TAG, "CronetEngine initialization failed, falling back to standard HttpURLConnection", t);
        }
    }

    // Main request dispatcher for api.php
    public static WebResourceResponse handleRequest(Uri uri) {
        String action = uri.getQueryParameter("action");
        if (action == null || action.trim().isEmpty()) {
            action = "live";
        }
        action = action.trim().toLowerCase(Locale.US);

        try {
            switch (action) {
                case "live":
                    return handleLive(uri);
                case "match":
                case "event":
                    return handleMatch(uri);
                case "player":
                    return handlePlayer(uri);
                case "search":
                    return handleSearch(uri);
                case "image":
                    return handleImage(uri);
                case "cache_info":
                case "clear_cache":
                case "clean_old_cache":
                    return jsonResponse("{\"success\":true,\"files\":0,\"sizeFormatted\":\"0 KB\"}");
                default:
                    return errorResponse("Неизвестное действие: " + action);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error handling action " + action, e);
            return errorResponse("Ошибка загрузки данных: " + e.getMessage());
        }
    }

    // Live events
    private static WebResourceResponse handleLive(Uri uri) throws Exception {
        String sport = uri.getQueryParameter("sport");
        if (sport == null || sport.trim().isEmpty()) sport = "table-tennis";
        sport = sport.trim().toLowerCase(Locale.US);
        if (sport.equals("tabletennis") || sport.equals("tt")) sport = "table-tennis";

        String url = "https://api.sofascore.com/api/v1/sport/" + sport + "/events/live";
        String rawJson = fetchString(url);
        if (rawJson == null || rawJson.isEmpty()) {
            return errorResponse("Не удалось получить данные с сервера SofaScore");
        }

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
                match.put("tournament", tourn != null ? tourn.optString("name", "") : "");
                match.put("country", cat != null ? cat.optString("name", "") : "");
                match.put("status", normStatus);
                match.put("time", timeFormatted);
                match.put("startTimestamp", ts);

                JSONObject ht = new JSONObject();
                ht.put("id", homeTeam != null ? homeTeam.opt("id") : null);
                ht.put("name", homeTeam != null ? homeTeam.optString("name", "Игрок 1") : "Игрок 1");
                ht.put("score", hs != null ? hs.opt("current") : null);
                match.put("homeTeam", ht);

                JSONObject at = new JSONObject();
                at.put("id", awayTeam != null ? awayTeam.opt("id") : null);
                at.put("name", awayTeam != null ? awayTeam.optString("name", "Игрок 2") : "Игрок 2");
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
        return jsonResponse(result.toString());
    }

    // Match details
    private static WebResourceResponse handleMatch(Uri uri) throws Exception {
        String id = uri.getQueryParameter("id");
        if (id == null || id.trim().isEmpty()) return errorResponse("ID матча не указан");

        String url = "https://api.sofascore.com/api/v1/event/" + id;
        String rawJson = fetchString(url);
        if (rawJson == null || rawJson.isEmpty()) {
            return errorResponse("Не удалось загрузить данные о матче");
        }

        JSONObject root = new JSONObject(rawJson);
        JSONObject e = root.optJSONObject("event");
        if (e == null) return errorResponse("Матч не найден");

        JSONObject tourn = e.optJSONObject("tournament");
        JSONObject cat = tourn != null ? tourn.optJSONObject("category") : null;
        JSONObject sportObj = tourn != null ? tourn.optJSONObject("sport") : null;
        String sportSlug = sportObj != null ? sportObj.optString("slug", "table-tennis") : "table-tennis";

        JSONObject hs = e.optJSONObject("homeScore");
        JSONObject aws = e.optJSONObject("awayScore");
        JSONObject homeTeam = e.optJSONObject("homeTeam");
        JSONObject awayTeam = e.optJSONObject("awayTeam");

        JSONObject statusObj = e.optJSONObject("status");
        String statusDesc = statusObj != null ? statusObj.optString("description", "") : "";
        String statusType = statusObj != null ? statusObj.optString("type", "") : "";
        boolean isLive = statusType.equalsIgnoreCase("inprogress") || statusDesc.equalsIgnoreCase("live");

        long ts = e.optLong("startTimestamp", 0);
        String dateStr = "";
        if (ts > 0) {
            SimpleDateFormat sdf = new SimpleDateFormat("dd.MM.yyyy, HH:mm", Locale.getDefault());
            dateStr = sdf.format(new Date(ts * 1000L));
        }

        JSONArray sets = new JSONArray();
        if (hs != null || aws != null) {
            for (int p = 1; p <= 7; p++) {
                String key = "period" + p;
                if ((hs != null && hs.has(key)) || (aws != null && aws.has(key))) {
                    JSONObject sObj = new JSONObject();
                    sObj.put("home", hs != null && hs.has(key) ? hs.opt(key) : null);
                    sObj.put("away", aws != null && aws.has(key) ? aws.opt(key) : null);
                    sets.put(sObj);
                }
            }
        }

        JSONObject result = new JSONObject();
        result.put("success", true);
        result.put("id", id);
        result.put("sport", sportSlug);
        result.put("tournament", tourn != null ? tourn.optString("name", "") : "");
        result.put("country", cat != null ? cat.optString("name", "") : "");
        result.put("status", statusDesc);
        result.put("isLive", isLive);
        result.put("date", dateStr);
        result.put("startTimestamp", ts);

        JSONObject ht = new JSONObject();
        ht.put("id", homeTeam != null ? homeTeam.opt("id") : null);
        ht.put("name", homeTeam != null ? homeTeam.optString("name", "Команда 1") : "Команда 1");
        ht.put("sets", hs != null ? hs.opt("current") : null);
        result.put("homeTeam", ht);

        JSONObject at = new JSONObject();
        at.put("id", awayTeam != null ? awayTeam.opt("id") : null);
        at.put("name", awayTeam != null ? awayTeam.optString("name", "Команда 2") : "Команда 2");
        at.put("sets", aws != null ? aws.opt("current") : null);
        result.put("awayTeam", at);

        result.put("sets", sets);
        return jsonResponse(result.toString());
    }

    // Player profile & matches
    private static WebResourceResponse handlePlayer(Uri uri) throws Exception {
        String id = uri.getQueryParameter("id");
        String pageStr = uri.getQueryParameter("page");
        int page = 0;
        try { if (pageStr != null) page = Integer.parseInt(pageStr); } catch (Exception ignored) {}

        if (id == null || id.trim().isEmpty()) return errorResponse("ID игрока не указан");

        String profUrl = "https://api.sofascore.com/api/v1/team/" + id;
        String profJson = fetchString(profUrl);
        JSONObject profObj = new JSONObject();
        if (profJson != null) {
            JSONObject root = new JSONObject(profJson);
            JSONObject team = root.optJSONObject("team");
            if (team != null) {
                JSONObject cat = team.optJSONObject("country");
                JSONObject sport = team.optJSONObject("sport");
                profObj.put("id", team.opt("id"));
                profObj.put("name", team.optString("name", "-"));
                profObj.put("country", cat != null ? cat.optString("name", "") : "");
                profObj.put("sport", sport != null ? sport.optString("slug", "table-tennis") : "table-tennis");
                profObj.put("gender", team.optString("gender", ""));
            }
        }

        String histUrl = "https://api.sofascore.com/api/v1/team/" + id + "/events/last/" + page;
        String histJson = fetchString(histUrl);
        JSONArray matchesArr = new JSONArray();
        int wins = 0, losses = 0;

        if (histJson != null) {
            JSONObject root = new JSONObject(histJson);
            JSONArray events = root.optJSONArray("events");
            if (events != null) {
                SimpleDateFormat sdf = new SimpleDateFormat("dd.MM.yyyy", Locale.getDefault());
                for (int i = 0; i < events.length(); i++) {
                    JSONObject e = events.optJSONObject(i);
                    if (e == null) continue;

                    JSONObject ht = e.optJSONObject("homeTeam");
                    JSONObject at = e.optJSONObject("awayTeam");
                    boolean isHome = ht != null && String.valueOf(ht.opt("id")).equals(id);

                    JSONObject oppTeam = isHome ? at : ht;
                    JSONObject hs = e.optJSONObject("homeScore");
                    JSONObject aws = e.optJSONObject("awayScore");

                    Object pSets = isHome ? (hs != null ? hs.opt("current") : null) : (aws != null ? aws.opt("current") : null);
                    Object oSets = isHome ? (aws != null ? aws.opt("current") : null) : (hs != null ? hs.opt("current") : null);

                    int wc = e.optInt("winnerCode", 0);
                    Boolean won = null;
                    if (wc == 1) won = isHome;
                    else if (wc == 2) won = !isHome;
                    if (won != null) {
                        if (won) wins++; else losses++;
                    }

                    long ts = e.optLong("startTimestamp", 0);
                    JSONObject tourn = e.optJSONObject("tournament");

                    JSONObject m = new JSONObject();
                    m.put("id", String.valueOf(e.opt("id")));
                    m.put("date", ts > 0 ? sdf.format(new Date(ts * 1000L)) : "-");
                    m.put("startTimestamp", ts);
                    m.put("tournament", tourn != null ? tourn.optString("name", "") : "");
                    
                    JSONObject opp = new JSONObject();
                    opp.put("id", oppTeam != null ? oppTeam.opt("id") : null);
                    opp.put("name", oppTeam != null ? oppTeam.optString("name", "Соперник") : "Соперник");
                    m.put("opponent", opp);

                    m.put("playerSets", pSets);
                    m.put("opponentSets", oSets);
                    m.put("won", won);
                    matchesArr.put(m);
                }
            }
        }

        JSONObject stats = new JSONObject();
        int total = wins + losses;
        stats.put("totalMatches", total);
        stats.put("wins", wins);
        stats.put("losses", losses);
        stats.put("winRate", total > 0 ? Math.round((wins * 100.0) / total) : 0);

        JSONObject result = new JSONObject();
        result.put("success", true);
        result.put("profile", profObj);
        result.put("stats", stats);
        result.put("matches", matchesArr);
        result.put("page", page);
        return jsonResponse(result.toString());
    }

    // Search players
    private static WebResourceResponse handleSearch(Uri uri) throws Exception {
        String q = uri.getQueryParameter("q");
        if (q == null || q.trim().isEmpty()) return jsonResponse("{\"success\":true,\"players\":[]}");

        String url = "https://api.sofascore.com/api/v1/search/all?q=" + Uri.encode(q);
        String rawJson = fetchString(url);
        JSONArray players = new JSONArray();

        if (rawJson != null) {
            JSONObject root = new JSONObject(rawJson);
            JSONArray results = root.optJSONArray("results");
            if (results != null) {
                for (int i = 0; i < results.length(); i++) {
                    JSONObject r = results.optJSONObject(i);
                    if (r == null) continue;
                    JSONObject ent = r.optJSONObject("entity");
                    if (ent == null) continue;

                    JSONObject sportObj = ent.optJSONObject("sport");
                    String sportSlug = sportObj != null ? sportObj.optString("slug", "") : "";
                    if (sportSlug.equals("table-tennis") || sportSlug.equals("tennis") || sportSlug.equals("football")) {
                        JSONObject cat = ent.optJSONObject("country");
                        JSONObject p = new JSONObject();
                        p.put("id", ent.opt("id"));
                        p.put("name", ent.optString("name", "-"));
                        p.put("sport", sportSlug);
                        p.put("country", cat != null ? cat.optString("name", "") : "");
                        p.put("gender", ent.optString("gender", ""));
                        players.put(p);
                    }
                }
            }
        }

        JSONObject result = new JSONObject();
        result.put("success", true);
        result.put("players", players);
        return jsonResponse(result.toString());
    }

    // Avatar images
    private static WebResourceResponse handleImage(Uri uri) {
        String id = uri.getQueryParameter("id");
        if (id == null || id.trim().isEmpty()) {
            return new WebResourceResponse("image/png", null, 404, "Not Found", null, null);
        }

        String url = "https://img.sofascore.com/api/v1/team/" + id + "/image";
        try {
            HttpURLConnection conn = openConnection(url);
            int code = conn.getResponseCode();
            if (code == 200) {
                InputStream is = conn.getInputStream();
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "public, max-age=604800");
                return new WebResourceResponse("image/png", null, 200, "OK", headers, is);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to load image for id " + id, e);
        }
        return new WebResourceResponse("image/png", null, 404, "Not Found", null, null);
    }

    // Network helper
    private static String fetchString(String urlStr) {
        HttpURLConnection conn = null;
        try {
            conn = openConnection(urlStr);
            int code = conn.getResponseCode();
            if (code == 200) {
                InputStream is = conn.getInputStream();
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int read;
                while ((read = is.read(buffer)) != -1) {
                    baos.write(buffer, 0, read);
                }
                return baos.toString("UTF-8");
            } else {
                Log.w(TAG, "HTTP " + code + " for " + urlStr);
            }
        } catch (Exception e) {
            Log.e(TAG, "Network error fetching " + urlStr, e);
        } finally {
            if (conn != null) {
                try { conn.disconnect(); } catch (Exception ignored) {}
            }
        }
        return null;
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
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(8000);
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
