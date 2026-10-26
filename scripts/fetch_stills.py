#!/usr/bin/env python3
"""Download text-free 4K backdrops for each film in stills/films.txt via the TMDB API.

Needs TMDB_API_KEY (free: themoviedb.org → Settings → API). Either the v3 "API Key" or the
v4 "API Read Access Token" works. Writes stills/images/<slug>-NN.jpg plus stills.json, the
slideshow playlist. The images are copyrighted, so they stay out of git; they're for your own TV.
"""
import json
import os
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILMS = ROOT / "stills" / "films.txt"
OUT = ROOT / "stills" / "images"
MIN_WIDTH = 3840


def api(path, key):
    url = "https://api.themoviedb.org/3" + path
    headers = {"Accept": "application/json"}
    if key.startswith("ey"):  # v4 read token (a JWT)
        headers["Authorization"] = "Bearer " + key
    else:
        url += ("&" if "?" in url else "?") + "api_key=" + key
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as r:
        return json.load(r)


def download(url, dest):
    with urllib.request.urlopen(url, timeout=120) as r:
        dest.write_bytes(r.read())


def main():
    key = os.environ.get("TMDB_API_KEY", "").strip()
    if not key:
        sys.exit("Set TMDB_API_KEY (free at themoviedb.org → Settings → API).")
    OUT.mkdir(parents=True, exist_ok=True)
    playlist = []
    for line in FILMS.read_text().splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        tmdb_id, count, title = line.split(None, 2)
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower().split(" (")[0]).strip("-")
        # include_image_language=null → only backdrops with no language: no titles or logos.
        imgs = api(f"/movie/{tmdb_id}/images?include_image_language=null", key)["backdrops"]
        imgs = [i for i in imgs if i["width"] >= MIN_WIDTH and 1.7 < i["aspect_ratio"] < 1.8]
        imgs.sort(key=lambda i: (i["vote_average"], i["vote_count"]), reverse=True)
        imgs = imgs[: int(count)]
        print(f"{title}: {len(imgs)} 4K stills", file=sys.stderr)
        for n, img in enumerate(imgs, 1):
            name = f"{slug}-{n:02d}.jpg"
            dest = OUT / name
            if not dest.exists():
                download("https://image.tmdb.org/t/p/original" + img["file_path"], dest)
            playlist.append({"file": name, "title": title})
    (OUT / "stills.json").write_text(json.dumps(playlist, indent=1))


if __name__ == "__main__":
    main()
