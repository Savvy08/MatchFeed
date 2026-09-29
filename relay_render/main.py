# Render Relay for MatchFeed
from fastapi import FastAPI, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from curl_cffi import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_HEADERS = {
    "Origin": "https://www.sofascore.com",
    "Referer": "https://www.sofascore.com/",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
}

@app.get("/")
def proxy(url: str = Query(...)):
    try:
        resp = requests.get(
            url,
            headers=SESSION_HEADERS,
            impersonate="chrome124",
            timeout=8
        )
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type=resp.headers.get("content-type", "application/json; charset=utf-8")
        )
    except Exception as e:
        return Response(
            content=f'{{"success": false, "error": "Relay error: {str(e)}"}}',
            status_code=502,
            media_type="application/json; charset=utf-8"
        )
