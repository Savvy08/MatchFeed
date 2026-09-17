#!/usr/bin/env python3
"""
sofascore_api.py
Direct Sofascore client using curl_cffi to bypass Cloudflare TLS fingerprinting.
Zero rate limits, real-time data, Russian translations.
"""

import sys
import io
import json

# Ensure UTF-8 output on Windows (fixes 'charmap' / cp1251 encode errors)
if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from curl_cffi import requests

SESSION_HEADERS = {
    "Origin": "https://www.sofascore.com",
    "Referer": "https://www.sofascore.com/",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
}

def get_session():
    for imp in ["chrome124", "chrome120", "chrome110"]:
        try:
            return requests.Session(impersonate=imp, headers=SESSION_HEADERS)
        except Exception:
            continue
    return requests.Session(headers=SESSION_HEADERS)

def safe_dict(val):
    return val if isinstance(val, dict) else {}

def ru_name(entity, fallback="name"):
    if not isinstance(entity, dict):
        return ""
    trans = safe_dict(entity.get("fieldTranslations")).get("nameTranslation", {})
    if isinstance(trans, dict) and trans.get("ru"):
        return trans["ru"]
    return entity.get(fallback, "") or ""

STATUS_RU = {
    "1st half": "1-й тайм",
    "2nd half": "2-й тайм",
    "halftime": "Перерыв",
    "extra time": "Доп. время",
    "overtime": "Овертайм",
    "penalties": "Пенальти",
    "pause": "Пауза",
    "break time": "Перерыв",
    "set 1": "Сет 1",
    "set 2": "Сет 2",
    "set 3": "Сет 3",
    "set 4": "Сет 4",
    "set 5": "Сет 5",
    "set 6": "Сет 6",
    "set 7": "Сет 7",
    "1st set": "Сет 1",
    "2nd set": "Сет 2",
    "3rd set": "Сет 3",
    "4th set": "Сет 4",
    "5th set": "Сет 5",
    "6th set": "Сет 6",
    "7th set": "Сет 7",
    "ended": "Завершён",
    "ft": "Завершён",
    "aet": "Завершён",
    "ap": "Завершён",
    "retired": "Снят",
    "walkover": "Тех. победа",
    "live": "LIVE",
    "inprogress": "LIVE",
}

def handle_live(sport):
    slug = sport.strip().lower()
    if slug in ["tabletennis", "table_tennis", "tt"]:
        slug = "table-tennis"

    url = f"https://api.sofascore.com/api/v1/sport/{slug}/events/live"
    try:
        with get_session() as s:
            resp = s.get(url, timeout=10)
            if resp.status_code != 200:
                print(json.dumps({"success": False, "error": f"HTTP {resp.status_code}", "matches": []}, ensure_ascii=False))
                return

            data = safe_dict(resp.json())
            events = data.get("events", [])
            matches = []
            for e in events:
                if not isinstance(e, dict):
                    continue

                status_obj = safe_dict(e.get("status"))
                status_desc = str(status_obj.get("description", "")).lower()
                status_type = str(status_obj.get("type", "")).lower()

                if status_desc in ["cancelled", "postponed", "abandoned", "interrupted"]:
                    continue

                norm_status = "upcoming"
                if status_type == "inprogress" or status_desc in STATUS_RU or "set" in status_desc or "half" in status_desc:
                    norm_status = "live"
                elif status_type == "finished" or status_desc in ["ended", "ft", "retired", "walkover"]:
                    norm_status = "finished"

                ts = e.get("startTimestamp")
                status_label = STATUS_RU.get(status_desc, status_desc.capitalize() if status_desc else "LIVE")
                time_formatted = status_label if norm_status == "live" else ("--:--" if not ts else "")

                hs = safe_dict(e.get("homeScore"))
                aws = safe_dict(e.get("awayScore"))

                sets = []
                for i in range(1, 8):
                    hp = hs.get(f"period{i}")
                    ap = aws.get(f"period{i}")
                    if hp is not None or ap is not None:
                        sets.append({"home": hp, "away": ap})

                tourn = safe_dict(e.get("tournament"))
                cat = safe_dict(tourn.get("category"))
                home_team = safe_dict(e.get("homeTeam"))
                away_team = safe_dict(e.get("awayTeam"))

                matches.append({
                    "id": str(e.get("id", "")),
                    "sport": slug,
                    "tournament": ru_name(tourn),
                    "country": ru_name(cat),
                    "status": norm_status,
                    "time": time_formatted,
                    "startTimestamp": ts,
                    "homeTeam": {
                        "id": home_team.get("id"),
                        "name": ru_name(home_team) or "Игрок 1",
                        "score": hs.get("current")
                    },
                    "awayTeam": {
                        "id": away_team.get("id"),
                        "name": ru_name(away_team) or "Игрок 2",
                        "score": aws.get("current")
                    },
                    "sets": sets
                })

            print(json.dumps({"success": True, "sport": slug, "matches": matches}, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc), "matches": []}, ensure_ascii=False))

def handle_search(query):
    try:
        with get_session() as s:
            url = f"https://api.sofascore.com/api/v1/search/{query}"
            resp = s.get(url, timeout=10)
            if resp.status_code != 200:
                print(json.dumps({"success": False, "players": []}, ensure_ascii=False))
                return

            data = safe_dict(resp.json())
            results = data.get("results", [])
            players = []
            for r in results:
                ent = safe_dict(r.get("entity"))
                sport_obj = safe_dict(ent.get("sport"))
                sport_slug = sport_obj.get("slug", "")
                if sport_slug in ["table-tennis", "tennis", "football"]:
                    country_obj = safe_dict(ent.get("country"))
                    players.append({
                        "id": ent.get("id"),
                        "name": ru_name(ent) or ent.get("name", "—"),
                        "originalName": ent.get("name", ""),
                        "sport": sport_slug,
                        "country": country_obj.get("name", ""),
                        "gender": ent.get("gender", "")
                    })

            print(json.dumps({"success": True, "players": players}, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc), "players": []}, ensure_ascii=False))

def handle_player(player_id, page=0):
    try:
        with get_session() as s:
            # 1. Profile
            prof_url = f"https://api.sofascore.com/api/v1/team/{player_id}"
            p_resp = s.get(prof_url, timeout=10)
            profile = {}
            if p_resp.status_code == 200:
                t = safe_dict(safe_dict(p_resp.json()).get("team"))
                country_obj = safe_dict(t.get("country"))
                sport_obj = safe_dict(t.get("sport"))
                profile = {
                    "id": t.get("id", player_id),
                    "name": ru_name(t) or t.get("name", "—"),
                    "originalName": t.get("name", ""),
                    "country": country_obj.get("name", ""),
                    "ranking": t.get("ranking"),
                    "gender": t.get("gender", ""),
                    "sport": sport_obj.get("slug", "table-tennis")
                }

            # 2. History
            hist_url = f"https://api.sofascore.com/api/v1/team/{player_id}/events/last/{page}"
            h_resp = s.get(hist_url, timeout=10)
            matches = []
            if h_resp.status_code == 200:
                data = safe_dict(h_resp.json())
                events = data.get("events", [])
                for e in events:
                    if not isinstance(e, dict):
                        continue

                    home_team = safe_dict(e.get("homeTeam"))
                    away_team = safe_dict(e.get("awayTeam"))
                    home_id = home_team.get("id")
                    player_is_home = (str(home_id) == str(player_id))

                    opp_team = away_team if player_is_home else home_team
                    opp_name = ru_name(opp_team) or opp_team.get("name", "Соперник")

                    hs = safe_dict(e.get("homeScore"))
                    aws = safe_dict(e.get("awayScore"))

                    p_sets = hs.get("current") if player_is_home else aws.get("current")
                    o_sets = aws.get("current") if player_is_home else hs.get("current")

                    sets_detail = []
                    for i in range(1, 8):
                        hp = hs.get(f"period{i}")
                        ap = aws.get(f"period{i}")
                        if hp is None and ap is None:
                            break
                        p_pts = hp if player_is_home else ap
                        o_pts = ap if player_is_home else hp
                        sets_detail.append({
                            "player": p_pts,
                            "opponent": o_pts,
                            "won": (p_pts > o_pts) if (p_pts is not None and o_pts is not None) else None
                        })

                    winner_code = e.get("winnerCode")
                    won = None
                    if winner_code is not None:
                        won = (winner_code == 1 if player_is_home else winner_code == 2)
                    elif p_sets is not None and o_sets is not None:
                        won = (p_sets > o_sets)

                    ts = e.get("startTimestamp")
                    from datetime import datetime
                    dt_str = datetime.fromtimestamp(ts).strftime("%d.%m.%Y") if ts else "—"

                    tourn = safe_dict(e.get("tournament"))
                    cat = safe_dict(tourn.get("category"))
                    status_obj = safe_dict(e.get("status"))
                    status_desc = str(status_obj.get("description", "")).lower()

                    matches.append({
                        "id": str(e.get("id", "")),
                        "date": dt_str,
                        "startTimestamp": ts,
                        "tournament": ru_name(tourn),
                        "category": ru_name(cat),
                        "opponent": {
                            "id": opp_team.get("id"),
                            "name": opp_name
                        },
                        "playerSets": p_sets,
                        "opponentSets": o_sets,
                        "won": won,
                        "sets": sets_detail,
                        "status": STATUS_RU.get(status_desc, status_obj.get("description", ""))
                    })

            matches.sort(key=lambda m: m.get("startTimestamp") or 0, reverse=True)

            total = len(matches)
            wins = sum(1 for m in matches if m["won"] is True)
            losses = sum(1 for m in matches if m["won"] is False)
            win_rate = round((wins / total * 100)) if total > 0 else 0

            total_pts_won = 0
            total_pts_lost = 0
            for m in matches:
                for s in m.get("sets", []):
                    if s.get("player") is not None and s.get("opponent") is not None:
                        total_pts_won += s["player"]
                        total_pts_lost += s["opponent"]

            stats = {
                "totalMatches": total,
                "wins": wins,
                "losses": losses,
                "winRate": win_rate,
                "pointsWon": total_pts_won,
                "pointsLost": total_pts_lost
            }

            print(json.dumps({
                "success": True,
                "profile": profile,
                "stats": stats,
                "page": int(page),
                "matches": matches
            }, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))

def handle_event(event_id):
    try:
        with get_session() as s:
            url = f"https://api.sofascore.com/api/v1/event/{event_id}"
            resp = s.get(url, timeout=10)
            if resp.status_code != 200:
                print(json.dumps({"success": False, "error": f"HTTP {resp.status_code}"}, ensure_ascii=False))
                return

            ev = safe_dict(safe_dict(resp.json()).get("event"))
            hs = safe_dict(ev.get("homeScore"))
            aws = safe_dict(ev.get("awayScore"))

            sets = []
            for i in range(1, 8):
                hp = hs.get(f"period{i}")
                ap = aws.get(f"period{i}")
                if hp is None and ap is None:
                    break
                sets.append({
                    "setNumber": i,
                    "home": hp,
                    "away": ap,
                    "homeWon": (hp > ap) if (hp is not None and ap is not None) else None
                })

            from datetime import datetime
            ts = ev.get("startTimestamp")
            dt_str = datetime.fromtimestamp(ts).strftime("%d.%m.%Y, %H:%M") if ts else "—"

            status_obj = safe_dict(ev.get("status"))
            status_desc = str(status_obj.get("description", "")).lower()
            status_label = STATUS_RU.get(status_desc, status_desc.capitalize() if status_desc else "—")

            tourn = safe_dict(ev.get("tournament"))
            cat = safe_dict(tourn.get("category"))
            sport_data = safe_dict(cat.get("sport")) or safe_dict(tourn.get("sport"))
            sport_slug = sport_data.get("slug", "")
            round_info = safe_dict(ev.get("roundInfo"))
            home_team = safe_dict(ev.get("homeTeam"))
            away_team = safe_dict(ev.get("awayTeam"))

            result = {
                "success": True,
                "id": str(ev.get("id", event_id)),
                "sport": sport_slug,
                "date": dt_str,
                "startTimestamp": ts,
                "status": status_label,
                "isLive": status_obj.get("type") == "inprogress",
                "tournament": ru_name(tourn) or tourn.get("name", "Турнир"),
                "category": ru_name(cat),
                "round": round_info.get("name", ""),
                "winnerCode": ev.get("winnerCode"),
                "homeTeam": {
                    "id": home_team.get("id"),
                    "name": ru_name(home_team) or home_team.get("name", "Игрок 1"),
                    "sets": hs.get("current")
                },
                "awayTeam": {
                    "id": away_team.get("id"),
                    "name": ru_name(away_team) or away_team.get("name", "Игрок 2"),
                    "sets": aws.get("current")
                },
                "sets": sets
            }
            print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))

def handle_image(entity_id, save_path):
    try:
        url = f"https://img.sofascore.com/api/v1/team/{entity_id}/image"
        with get_session() as s:
            r = s.get(url, timeout=6)
            if r.status_code == 200 and len(r.content) > 0:
                with open(save_path, "wb") as f:
                    f.write(r.content)
                print(json.dumps({"success": True}))
                return
    except Exception as e:
        pass
    print(json.dumps({"success": False}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No action specified"}))
        sys.exit(1)

    action = sys.argv[1].lower()

    if action == "live":
        sport = sys.argv[2] if len(sys.argv) > 2 else "table-tennis"
        handle_live(sport)
    elif action == "search":
        q = sys.argv[2] if len(sys.argv) > 2 else ""
        handle_search(q)
    elif action == "player":
        pid = sys.argv[2] if len(sys.argv) > 2 else ""
        page = sys.argv[3] if len(sys.argv) > 3 else "0"
        handle_player(pid, page)
    elif action in ("event", "match"):
        eid = sys.argv[2] if len(sys.argv) > 2 else ""
        handle_event(eid)
    elif action == "image":
        iid = sys.argv[2] if len(sys.argv) > 2 else ""
        spath = sys.argv[3] if len(sys.argv) > 3 else ""
        handle_image(iid, spath)
    else:
        print(json.dumps({"error": f"Unknown action: {action}"}))
