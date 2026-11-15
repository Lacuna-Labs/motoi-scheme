"""PODCASTS AND RADIO ON THE DESK (the walk, W23: "the podcast player from our other one … a really good podcast player …
and the radio also … its own visualization: a map of the globe, glowing squares, the stations on the right").

The catalogs come from Curator's dev API (ours, :5051 — never QA): the radio's stations (/api/cards/radio), the podcast
subscriptions and a show's episodes (/api/podcasts/*). Lacuna relays them to the desk (same origin), each read cached so
the desk never hammers the dev API. The AUDIO itself the owner's browser plays straight from the station or the
podcast's own address — no proxy, no re-fetching (one stream per press of play).

Owed (the ledger): Lacuna's own podcast shelf in Loam (a `lacuna` namespace and token registered with the dev Loam).

  GET /api/audio/radio                  stations: name, country, stream, lat/lon (country centroid when the station has none)
  GET /api/audio/subscriptions          the shows subscribed
  GET /api/audio/episodes?feed=         a show's episodes
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()
DEV = "http://127.0.0.1:5051"
_cache: dict[str, tuple[float, object]] = {}
CENTROIDS = Path.home() / "code" / "curator" / "curator-web" / "src" / "components" / "cards" / "radio" / "countryCentroids.json"


def _get(path: str, ttl: float) -> object:
    hit = _cache.get(path)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    try:
        with urllib.request.urlopen(DEV + path, timeout=20) as r:
            v = json.loads(r.read().decode() or "null")
    except Exception as e:  # noqa: BLE001 — one try; the desk says the dev API did not answer
        if hit:
            return hit[1]
        return {"ok": False, "why": f"the dev API did not answer ({e.__class__.__name__})"}
    _cache[path] = (time.time(), v)
    return v


# places the centroid table does not hold (islands, a region a station names itself by) — [lat, lon]
EXTRA = {"trinidad & tobago": [10.69, -61.22], "dominican republic": [18.74, -70.16], "barbados": [13.19, -59.54], "curacao": [12.17, -68.99],
         "macao": [22.2, 113.54], "martinique": [14.64, -61.02], "malta": [35.94, 14.38], "black american south": [32.3, -86.9],
         "singapore": [1.35, 103.82], "hong kong": [22.32, 114.17], "bahamas": [25.03, -77.4], "jamaica": [18.11, -77.3], "mauritius": [-20.35, 57.55],
         "guadeloupe": [16.27, -61.55], "aruba": [12.52, -69.97], "bermuda": [32.31, -64.75], "reunion": [-21.12, 55.54], "cape verde": [16.0, -24.01]}


def _centroids() -> dict:
    try:
        return {**json.loads(CENTROIDS.read_text()), **EXTRA}
    except (OSError, ValueError):
        return dict(EXTRA)


@router.get("/api/audio/radio")
def r_radio() -> dict:
    d = _get("/api/cards/radio", 600)
    rows = d.get("stations") if isinstance(d, dict) else d
    if not isinstance(rows, list):
        return {"stations": [], "why": (d or {}).get("why") if isinstance(d, dict) else "no stations"}
    cen = _centroids()
    out = []
    for s in rows:
        lat, lon = s.get("lat"), s.get("lon")
        if lat is None or lon is None:
            name = (s.get("country") or "").lower()
            c = cen.get(name) or cen.get({"united states": "united states of america", "usa": "united states of america", "uk": "united kingdom",
                                          "the united kingdom of great britain and northern ireland": "united kingdom", "russian federation": "russia"}.get(name, name))
            if isinstance(c, (list, tuple)) and len(c) >= 2:
                lat, lon = c[0], c[1]                    # [lat, lon] (curator's radio/countryCentroids.json)
        if s.get("streamUrl"):
            out.append({"name": s.get("name"), "country": s.get("country") or "—", "stream": s["streamUrl"], "city": s.get("city") or "", "lat": lat, "lon": lon})
    return {"stations": out}


@router.get("/api/audio/subscriptions")
def r_subs() -> object:
    return _get("/api/podcasts/subscriptions", 120)


@router.get("/api/audio/episodes")
def r_episodes(feed: str) -> object:
    return _get("/api/podcasts/episodes?feed=" + urllib.parse.quote(feed, safe=""), 900)
