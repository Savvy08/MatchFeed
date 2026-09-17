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

def extract_yt_id(url):
    if not url:
        return ""
    import re
    m = re.search(r'(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([0-9A-Za-z_-]{11})', str(url))
    return m.group(1) if m else ""

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
    "not started": "Предстоит",
    "postponed": "Перенесён",
    "cancelled": "Отменён",
    "delayed": "Задерживается",
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
                        "name": ru_name(ent) or ent.get("name", "-"),
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
            from datetime import datetime

            # Profile
            prof_url = f"https://api.sofascore.com/api/v1/team/{player_id}"
            p_resp = s.get(prof_url, timeout=10)
            profile = {}
            if p_resp.status_code == 200:
                t = safe_dict(safe_dict(p_resp.json()).get("team"))
                country_obj = safe_dict(t.get("country"))
                sport_obj = safe_dict(t.get("sport"))
                profile = {
                    "id": t.get("id", player_id),
                    "name": ru_name(t) or t.get("name", "-"),
                    "originalName": t.get("name", ""),
                    "fullName": t.get("fullName") or t.get("name", ""),
                    "country": country_obj.get("name", ""),
                    "ranking": t.get("ranking"),
                    "gender": t.get("gender", ""),
                    "sport": sport_obj.get("slug", "table-tennis"),
                    "sportName": sport_obj.get("name", "Настольный теннис")
                }

            # Upcoming matches
            next_matches = []
            try:
                next_url = f"https://api.sofascore.com/api/v1/team/{player_id}/events/next/0"
                n_resp = s.get(next_url, timeout=6)
                if n_resp.status_code == 200:
                    n_data = safe_dict(n_resp.json())
                    for e in n_data.get("events", []):
                        if not isinstance(e, dict):
                            continue
                        home_team = safe_dict(e.get("homeTeam"))
                        away_team = safe_dict(e.get("awayTeam"))
                        player_is_home = (str(home_team.get("id")) == str(player_id))
                        opp_team = away_team if player_is_home else home_team
                        opp_name = ru_name(opp_team) or opp_team.get("name", "Соперник")
                        tourn = safe_dict(e.get("tournament"))
                        cat = safe_dict(tourn.get("category"))
                        status_obj = safe_dict(e.get("status"))
                        status_desc = str(status_obj.get("description", "")).lower()
                        ts = e.get("startTimestamp")
                        dt_str = datetime.fromtimestamp(ts).strftime("%d.%m.%Y") if ts else "-"
                        time_str = datetime.fromtimestamp(ts).strftime("%H:%M") if ts else ""

                        next_matches.append({
                            "id": str(e.get("id", "")),
                            "date": dt_str,
                            "time": time_str,
                            "startTimestamp": ts,
                            "tournament": ru_name(tourn),
                            "category": ru_name(cat),
                            "opponent": {
                                "id": opp_team.get("id"),
                                "name": opp_name
                            },
                            "status": STATUS_RU.get(status_desc, status_obj.get("description", "Предстоит"))
                        })
            except Exception:
                pass

            # History
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
                    dt_str = datetime.fromtimestamp(ts).strftime("%d.%m.%Y") if ts else "-"

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

            # League detection
            tourn_counts = {}
            for m in matches:
                t_name = m.get("tournament")
                if t_name and t_name != "-":
                    tourn_counts[t_name] = tourn_counts.get(t_name, 0) + 1
            main_league = max(tourn_counts, key=tourn_counts.get) if tourn_counts else ""
            profile["currentLeague"] = main_league

            total = len(matches)
            wins = sum(1 for m in matches if m["won"] is True)
            losses = sum(1 for m in matches if m["won"] is False)
            win_rate = round((wins / total * 100)) if total > 0 else 0

            # Streaks
            current_streak = {"type": "none", "count": 0}
            for m in matches:
                if m["won"] is not None:
                    w = m["won"]
                    if current_streak["type"] == "none":
                        current_streak["type"] = "win" if w else "loss"
                        current_streak["count"] = 1
                    elif (current_streak["type"] == "win" and w) or (current_streak["type"] == "loss" and not w):
                        current_streak["count"] += 1
                    else:
                        break

            best_win_streak = 0
            cur_w = 0
            for m in reversed(matches):
                if m["won"] is True:
                    cur_w += 1
                    if cur_w > best_win_streak:
                        best_win_streak = cur_w
                elif m["won"] is False:
                    cur_w = 0

            recent_form = []
            for m in matches[:5]:
                if m["won"] is not None:
                    recent_form.append({
                        "id": m["id"],
                        "won": m["won"],
                        "score": f"{m.get('playerSets', 0)}:{m.get('opponentSets', 0)}",
                        "oppName": m.get("opponent", {}).get("name", ""),
                        "tournament": m.get("tournament", "")
                    })

            sets_won = sum(m.get("playerSets") or 0 for m in matches if isinstance(m.get("playerSets"), (int, float)))
            sets_lost = sum(m.get("opponentSets") or 0 for m in matches if isinstance(m.get("opponentSets"), (int, float)))
            sets_total = sets_won + sets_lost
            sets_win_rate = round((sets_won / sets_total * 100)) if sets_total > 0 else 0

            clean_sweeps = sum(1 for m in matches if m["won"] is True and (m.get("opponentSets") == 0))
            clean_sweeps_rate = round((clean_sweeps / wins * 100)) if wins > 0 else 0

            deciding_matches = 0
            deciding_wins = 0
            for m in matches:
                p_sets = m.get("playerSets") or 0
                o_sets = m.get("opponentSets") or 0
                if (p_sets + o_sets == 5 and max(p_sets, o_sets) == 3) or (p_sets + o_sets == 7 and max(p_sets, o_sets) == 4):
                    deciding_matches += 1
                    if m["won"] is True:
                        deciding_wins += 1

            deciding_win_rate = round((deciding_wins / deciding_matches * 100)) if deciding_matches > 0 else 0

            total_pts_won = 0
            total_pts_lost = 0
            total_sets_counted = 0
            for m in matches:
                for s in m.get("sets", []):
                    if s.get("player") is not None and s.get("opponent") is not None:
                        total_pts_won += s["player"]
                        total_pts_lost += s["opponent"]
                        total_sets_counted += 1

            points_diff = total_pts_won - total_pts_lost
            avg_pts_per_set = round(total_pts_won / total_sets_counted, 1) if total_sets_counted > 0 else 0

            stats = {
                "totalMatches": total,
                "wins": wins,
                "losses": losses,
                "winRate": win_rate,
                "setsWon": sets_won,
                "setsLost": sets_lost,
                "setsTotal": sets_total,
                "setsWinRate": sets_win_rate,
                "pointsWon": total_pts_won,
                "pointsLost": total_pts_lost,
                "pointsDiff": points_diff,
                "avgPointsPerSet": avg_pts_per_set,
                "cleanSweeps": clean_sweeps,
                "cleanSweepsRate": clean_sweeps_rate,
                "decidingWins": deciding_wins,
                "decidingTotal": deciding_matches,
                "decidingWinRate": deciding_win_rate,
                "currentStreak": current_streak,
                "bestWinStreak": best_win_streak,
                "recentForm": recent_form
            }

            print(json.dumps({
                "success": True,
                "profile": profile,
                "stats": stats,
                "page": int(page),
                "matches": matches,
                "nextMatches": next_matches
            }, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))

# Event helpers
def parse_team_form(events, team_id, opp_id=None, current_event_id=None):
    from datetime import datetime
    recent = []
    direct = []
    for e in events:
        if not isinstance(e, dict):
            continue
        eid = str(e.get("id", ""))
        e_hid = safe_dict(e.get("homeTeam")).get("id")
        e_aid = safe_dict(e.get("awayTeam")).get("id")
        is_home = (str(e_hid) == str(team_id))
        is_away = (str(e_aid) == str(team_id))
        if not is_home and not is_away:
            continue

        e_hs = safe_dict(e.get("homeScore"))
        e_aws = safe_dict(e.get("awayScore"))
        hp = e_hs.get("current")
        ap = e_aws.get("current")
        my_score = hp if is_home else ap
        opp_score = ap if is_home else hp

        wc = e.get("winnerCode")
        won = None
        if wc is not None:
            if wc == 1:
                won = True if is_home else False
            elif wc == 2:
                won = False if is_home else True
            elif wc == 3:
                won = None
        elif my_score is not None and opp_score is not None:
            if my_score > opp_score:
                won = True
            elif my_score < opp_score:
                won = False
            else:
                won = None

        opp_team = safe_dict(e.get("awayTeam")) if is_home else safe_dict(e.get("homeTeam"))
        opp_name = ru_name(opp_team) or opp_team.get("name", "Соперник")
        tourn_obj = safe_dict(e.get("tournament"))

        ts_e = e.get("startTimestamp")
        dt_e = datetime.fromtimestamp(ts_e).strftime("%d.%m.%Y") if ts_e else "-"

        sets_detail = []
        for i in range(1, 8):
            p1 = e_hs.get(f"period{i}")
            p2 = e_aws.get(f"period{i}")
            if p1 is None and p2 is None:
                break
            sets_detail.append(f"{p1}-{p2}")

        item = {
            "id": eid,
            "date": dt_e,
            "startTimestamp": ts_e,
            "tournament": ru_name(tourn_obj) or tourn_obj.get("name", ""),
            "opponent": opp_name,
            "opponentId": opp_team.get("id"),
            "myScore": my_score,
            "oppScore": opp_score,
            "scoreStr": f"{my_score} - {opp_score}" if my_score is not None and opp_score is not None else "-",
            "setsStr": ", ".join(sets_detail) if sets_detail else "",
            "won": won,
            "isHome": is_home
        }

        # Filter out the current event itself for past form and prior direct matches
        if not current_event_id or eid != str(current_event_id):
            recent.append(item)

            if opp_id and ((str(e_hid) == str(team_id) and str(e_aid) == str(opp_id)) or (str(e_hid) == str(opp_id) and str(e_aid) == str(team_id))):
                home_team_obj = safe_dict(e.get("homeTeam"))
                away_team_obj = safe_dict(e.get("awayTeam"))
                direct.append({
                    "id": eid,
                    "date": dt_e,
                    "startTimestamp": ts_e,
                    "tournament": ru_name(tourn_obj) or tourn_obj.get("name", ""),
                    "homeTeam": ru_name(home_team_obj) or home_team_obj.get("name", "Команда 1"),
                    "awayTeam": ru_name(away_team_obj) or away_team_obj.get("name", "Команда 2"),
                    "homeScore": hp,
                    "awayScore": ap,
                    "scoreStr": f"{hp} - {ap}" if hp is not None and ap is not None else "-",
                    "winnerCode": wc,
                    "setsStr": ", ".join(sets_detail) if sets_detail else ""
                })

    recent.sort(key=lambda x: x.get("startTimestamp") or 0, reverse=True)
    direct.sort(key=lambda x: x.get("startTimestamp") or 0, reverse=True)
    return recent[:5], direct[:10]

def calc_streak(form_list):
    if not form_list:
        return {"type": "none", "count": 0, "text": "Нет данных"}
    first = form_list[0].get("won")
    if first is None:
        return {"type": "draw", "count": 1, "text": "1 ничья"}
    count = 0
    for m in form_list:
        if m.get("won") == first:
            count += 1
        else:
            break
    if first is True:
        txt = f"{count} победы подряд" if 2 <= count <= 4 else (f"{count} побед подряд" if count >= 5 else "1 победа")
        return {"type": "win", "count": count, "text": txt}
    else:
        txt = f"{count} поражения подряд" if 2 <= count <= 4 else (f"{count} поражений подряд" if count >= 5 else "1 поражение")
        return {"type": "loss", "count": count, "text": txt}

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
            dt_str = datetime.fromtimestamp(ts).strftime("%d.%m.%Y, %H:%M") if ts else "-"

            status_obj = safe_dict(ev.get("status"))
            status_desc = str(status_obj.get("description", "")).lower()
            status_label = STATUS_RU.get(status_desc, status_desc.capitalize() if status_desc else "-")

            tourn = safe_dict(ev.get("tournament"))
            cat = safe_dict(tourn.get("category"))
            sport_data = safe_dict(cat.get("sport")) or safe_dict(tourn.get("sport"))
            sport_slug = sport_data.get("slug", "")
            round_info = safe_dict(ev.get("roundInfo"))
            home_team = safe_dict(ev.get("homeTeam"))
            away_team = safe_dict(ev.get("awayTeam"))

            home_clean = ru_name(home_team) or home_team.get("name", "Игрок 1")
            away_clean = ru_name(away_team) or away_team.get("name", "Игрок 2")
            tourn_clean = ru_name(tourn) or tourn.get("name", "Турнир")

            hid = home_team.get("id")
            aid = away_team.get("id")
            tid = tourn.get("id")

            # Votes
            votes = {"vote1": 0, "vote2": 0, "voteX": 0, "hasDraw": False}
            try:
                vr = s.get(f"https://api.sofascore.com/api/v1/event/{event_id}/votes", timeout=4)
                if vr.status_code == 200:
                    v_raw = safe_dict(safe_dict(vr.json()).get("vote"))
                    votes["vote1"] = v_raw.get("vote1") or 0
                    votes["vote2"] = v_raw.get("vote2") or 0
                    vx = v_raw.get("voteX")
                    if vx is not None:
                        votes["voteX"] = vx
                        votes["hasDraw"] = True
            except Exception:
                pass

            # Odds
            odds_list = []
            try:
                od_r = s.get(f"https://api.sofascore.com/api/v1/event/{event_id}/odds/1/all", timeout=4)
                if od_r.status_code == 200:
                    for m in safe_dict(od_r.json()).get("markets", []):
                        choices = []
                        for c in m.get("choices", []):
                            name = c.get("name", "")
                            f_val = c.get("fractionalValue", "")
                            dec = c.get("decimalValue")
                            if not dec and "/" in str(f_val):
                                try:
                                    p = f_val.split("/")
                                    dec = round(float(p[0]) / float(p[1]) + 1, 2)
                                except Exception:
                                    dec = f_val
                            choices.append({
                                "name": name,
                                "val": dec if dec is not None else f_val,
                                "change": c.get("change", 0)
                            })
                        odds_list.append({
                            "market": m.get("marketName", "Full time"),
                            "choices": choices
                        })
            except Exception:
                pass

            # H2H Duel
            h2h_duel = {"homeWins": 0, "awayWins": 0, "draws": 0}
            try:
                hr = s.get(f"https://api.sofascore.com/api/v1/event/{event_id}/h2h", timeout=4)
                if hr.status_code == 200:
                    td = safe_dict(safe_dict(hr.json()).get("teamDuel"))
                    h2h_duel = {
                        "homeWins": td.get("homeWins", 0),
                        "awayWins": td.get("awayWins", 0),
                        "draws": td.get("draws", 0)
                    }
            except Exception:
                pass

            # Form & Direct history
            home_form_list = []
            direct_matches = []
            if hid:
                try:
                    hhr = s.get(f"https://api.sofascore.com/api/v1/team/{hid}/events/last/0", timeout=4)
                    if hhr.status_code == 200:
                        home_form_list, direct_matches = parse_team_form(safe_dict(hhr.json()).get("events", []), hid, aid, event_id)
                except Exception:
                    pass

            away_form_list = []
            if aid:
                try:
                    ahr = s.get(f"https://api.sofascore.com/api/v1/team/{aid}/events/last/0", timeout=4)
                    if ahr.status_code == 200:
                        away_form_list, _ = parse_team_form(safe_dict(ahr.json()).get("events", []), aid, hid, event_id)
                except Exception:
                    pass

            home_wins_cnt = sum(1 for m in home_form_list if m.get("won") is True)
            home_win_rate = round(home_wins_cnt / len(home_form_list) * 100) if home_form_list else 0
            away_wins_cnt = sum(1 for m in away_form_list if m.get("won") is True)
            away_win_rate = round(away_wins_cnt / len(away_form_list) * 100) if away_form_list else 0

            # Tournament bracket / cuptrees
            tree_rounds = []
            chosen_tree_name = ""
            utid = safe_dict(tourn.get("uniqueTournament")).get("id")
            sid = safe_dict(ev.get("season")).get("id")

            round_names_ru = {
                "round of 128": "1/64 финала",
                "round of 64": "1/32 финала",
                "round of 32": "1/16 финала",
                "round of 16": "1/8 финала",
                "quarterfinal": "1/4 финала",
                "quarterfinals": "1/4 финала",
                "semifinal": "1/2 финала",
                "semifinals": "1/2 финала",
                "final": "Финал",
                "finals": "Финал",
                "3rd place match": "Матч за 3-е место",
                "qualification": "Квалификация"
            }

            if utid and sid:
                try:
                    ctree_url = f"https://api.sofascore.com/api/v1/unique-tournament/{utid}/season/{sid}/cuptrees"
                    ctr = s.get(ctree_url, timeout=5)
                    if ctr.status_code == 200:
                        trees = safe_dict(ctr.json()).get("cupTrees", [])
                        chosen_tree = None
                        for t in trees:
                            if not isinstance(t, dict):
                                continue
                            for r in t.get("rounds", []):
                                for b in r.get("blocks", []):
                                    ev_ids = [str(x) for x in b.get("events", [])]
                                    if str(event_id) in ev_ids:
                                        chosen_tree = t
                                        break
                                if chosen_tree:
                                    break
                            if chosen_tree:
                                break

                        if not chosen_tree and trees:
                            chosen_tree = trees[0]

                        if chosen_tree:
                            chosen_tree_name = ru_name(chosen_tree) or chosen_tree.get("name", "")
                            for r in chosen_tree.get("rounds", []):
                                if not isinstance(r, dict):
                                    continue
                                desc = r.get("description", "")
                                desc_lower = desc.strip().lower()
                                round_title = round_names_ru.get(desc_lower, desc or "Раунд")

                                blocks_list = []
                                for b in r.get("blocks", []):
                                    if not isinstance(b, dict):
                                        continue
                                    b_events = [str(x) for x in b.get("events", [])]
                                    is_cur = str(event_id) in b_events
                                    in_progress = b.get("eventInProgress", False)
                                    finished = b.get("finished", False)
                                    res_str = b.get("result", "")

                                    participants = []
                                    for p in b.get("participants", []):
                                        if not isinstance(p, dict):
                                            continue
                                        tm = safe_dict(p.get("team"))
                                        p_name = ru_name(tm) or tm.get("name", "Игрок")
                                        participants.append({
                                            "id": tm.get("id"),
                                            "name": p_name,
                                            "winner": p.get("winner"),
                                            "seed": p.get("seed"),
                                            "order": p.get("order")
                                        })

                                    participants.sort(key=lambda x: x.get("order") or 0)
                                    p1 = participants[0] if len(participants) > 0 else {"name": "-", "winner": None, "seed": None}
                                    p2 = participants[1] if len(participants) > 1 else {"name": "-", "winner": None, "seed": None}

                                    blocks_list.append({
                                        "blockId": b.get("id"),
                                        "order": b.get("order", 0),
                                        "matchId": b_events[0] if b_events else None,
                                        "isCurrent": is_cur,
                                        "isLive": in_progress,
                                        "finished": finished,
                                        "result": res_str,
                                        "home": {
                                            "id": p1.get("id"),
                                            "name": p1.get("name"),
                                            "winner": p1.get("winner"),
                                            "seed": p1.get("seed"),
                                            "score": b.get("homeTeamScore")
                                        },
                                        "away": {
                                            "id": p2.get("id"),
                                            "name": p2.get("name"),
                                            "winner": p2.get("winner"),
                                            "seed": p2.get("seed"),
                                            "score": b.get("awayTeamScore")
                                        }
                                    })

                                blocks_list.sort(key=lambda x: x.get("order") or 0)
                                if blocks_list:
                                    tree_rounds.append({
                                        "title": round_title,
                                        "originalTitle": desc,
                                        "blocks": blocks_list
                                    })
                except Exception:
                    pass

            # Fallback tournament stage matches
            tourn_matches = []
            if tid and not tree_rounds:
                try:
                    tr = s.get(f"https://api.sofascore.com/api/v1/tournament/{tid}/events/last/0", timeout=4)
                    if tr.status_code == 200:
                        for te in safe_dict(tr.json()).get("events", []):
                            if not isinstance(te, dict):
                                continue
                            te_id = str(te.get("id", ""))
                            te_hs = safe_dict(te.get("homeScore"))
                            te_aws = safe_dict(te.get("awayScore"))
                            te_ht = safe_dict(te.get("homeTeam"))
                            te_at = safe_dict(te.get("awayTeam"))
                            te_st = safe_dict(te.get("status"))
                            te_round = safe_dict(te.get("roundInfo")).get("name", "")
                            te_ts = te.get("startTimestamp")
                            te_dt = datetime.fromtimestamp(te_ts).strftime("%d.%m %H:%M") if te_ts else "-"

                            tourn_matches.append({
                                "id": te_id,
                                "date": te_dt,
                                "startTimestamp": te_ts,
                                "round": te_round,
                                "isCurrent": (te_id == str(event_id)),
                                "isLive": te_st.get("type") == "inprogress",
                                "status": STATUS_RU.get(str(te_st.get("description", "")).lower(), te_st.get("description", "")),
                                "homeTeam": {
                                    "id": te_ht.get("id"),
                                    "name": ru_name(te_ht) or te_ht.get("name", "Команда 1"),
                                    "score": te_hs.get("current")
                                },
                                "awayTeam": {
                                    "id": te_at.get("id"),
                                    "name": ru_name(te_at) or te_at.get("name", "Команда 2"),
                                    "score": te_aws.get("current")
                                }
                            })
                except Exception:
                    pass

            # Official media and news strictly from SofaScore
            videos_list = []
            news_list = []

            try:
                # 1. Videos
                media_url = f"https://api.sofascore.com/api/v1/event/{event_id}/media"
                mr = s.get(media_url, timeout=5)
                raw_media = []
                if mr.status_code == 200:
                    raw_media = safe_dict(mr.json()).get("media", [])

                if not raw_media:
                    hl_r = s.get(f"https://api.sofascore.com/api/v1/event/{event_id}/highlights", timeout=4)
                    if hl_r.status_code == 200:
                        raw_media = safe_dict(hl_r.json()).get("highlights", [])

                # Fallback to team/player media if event media is empty
                if not raw_media and (hid or aid):
                    t_ids = [x for x in [hid, aid] if x]
                    for tid in t_ids:
                        tmr = s.get(f"https://api.sofascore.com/api/v1/team/{tid}/media", timeout=4)
                        if tmr.status_code == 200:
                            t_media = safe_dict(tmr.json()).get("media", [])
                            opp_clean = (away_clean if tid == hid else home_clean).lower()
                            opp_parts = [p.strip().lower() for p in opp_clean.split() if len(p.strip()) > 3]
                            for tm in t_media:
                                title_lower = (tm.get("title") or "").lower()
                                if any(p in title_lower for p in opp_parts):
                                    raw_media.append(tm)

                if isinstance(raw_media, list):
                    seen_urls = set()
                    for item in raw_media:
                        if not isinstance(item, dict):
                            continue
                        u = item.get("url") or item.get("sourceUrl") or ""
                        if not u or u in seen_urls:
                            continue
                        seen_urls.add(u)
                        yt_id = extract_yt_id(u)
                        created_ts = item.get("createdAtTimestamp")
                        date_fmt = datetime.fromtimestamp(created_ts).strftime("%d.%m.%Y") if created_ts else ""

                        videos_list.append({
                            "id": item.get("id"),
                            "title": item.get("title") or item.get("subtitle") or "Видео матча",
                            "subtitle": item.get("subtitle", ""),
                            "url": u,
                            "youtubeId": yt_id,
                            "thumbnailUrl": item.get("thumbnailUrl") or (f"https://i.ytimg.com/vi/{yt_id}/hqdefault.jpg" if yt_id else ""),
                            "date": date_fmt,
                            "source": "Sofascore"
                        })

                # 2. News
                news_url = f"https://api.sofascore.com/api/v1/event/{event_id}/media/news"
                nr = s.get(news_url, timeout=5)
                raw_news = []
                if nr.status_code == 200:
                    raw_news = safe_dict(nr.json()).get("newsArticles", [])

                if not raw_news and (hid or aid):
                    t_ids = [x for x in [hid, aid] if x]
                    for tid in t_ids:
                        tnr = s.get(f"https://api.sofascore.com/api/v1/team/{tid}/media/news", timeout=4)
                        if tnr.status_code == 200:
                            t_articles = safe_dict(tnr.json()).get("newsArticles", [])
                            opp_clean = (away_clean if tid == hid else home_clean).lower()
                            opp_parts = [p.strip().lower() for p in opp_clean.split() if len(p.strip()) > 3]
                            for art in t_articles:
                                h_text = ((art.get("header") or "") + " " + (art.get("description") or "")).lower()
                                if any(p in h_text for p in opp_parts):
                                    raw_news.append(art)

                if isinstance(raw_news, list):
                    seen_news_ids = set()
                    for art in raw_news:
                        if not isinstance(art, dict):
                            continue
                        art_id = art.get("id")
                        if art_id in seen_news_ids:
                            continue
                        seen_news_ids.add(art_id)
                        pub_ts = art.get("publishedAtTimestamp")
                        pub_date = datetime.fromtimestamp(pub_ts).strftime("%d.%m.%Y") if pub_ts else ""
                        provider = safe_dict(art.get("newsProvider")).get("name") or "Sofascore"
                        news_list.append({
                            "id": art_id,
                            "title": art.get("header") or "Новость",
                            "lead": art.get("description") or "",
                            "url": art.get("externalUrl") or "",
                            "thumbnailUrl": art.get("thumbnailUrl") or "",
                            "timestamp": pub_ts,
                            "date": pub_date,
                            "source": provider
                        })
            except Exception:
                pass

            result = {
                "success": True,
                "id": str(ev.get("id", event_id)),
                "sport": sport_slug,
                "date": dt_str,
                "startTimestamp": ts,
                "status": status_label,
                "isLive": status_obj.get("type") == "inprogress",
                "tournament": tourn_clean or "Турнир",
                "category": ru_name(cat),
                "round": round_info.get("name", ""),
                "winnerCode": ev.get("winnerCode"),
                "homeTeam": {
                    "id": hid,
                    "name": home_clean,
                    "sets": hs.get("current"),
                    "ranking": home_team.get("ranking")
                },
                "awayTeam": {
                    "id": aid,
                    "name": away_clean,
                    "sets": aws.get("current"),
                    "ranking": away_team.get("ranking")
                },
                "sets": sets,
                "votes": votes,
                "odds": odds_list,
                "h2h": {
                    "duel": h2h_duel,
                    "matches": direct_matches
                },
                "form": {
                    "home": {
                        "streak": calc_streak(home_form_list),
                        "winRate": home_win_rate,
                        "matches": home_form_list
                    },
                    "away": {
                        "streak": calc_streak(away_form_list),
                        "winRate": away_win_rate,
                        "matches": away_form_list
                    }
                },
                "bracket": {
                    "hasTree": len(tree_rounds) > 0,
                    "treeName": chosen_tree_name,
                    "tree": tree_rounds,
                    "matches": tourn_matches
                },
                "media": {
                    "hasMedia": bool(len(videos_list) > 0 or len(news_list) > 0),
                    "videos": videos_list,
                    "news": news_list
                }
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
