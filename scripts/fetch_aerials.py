#!/usr/bin/env python3
"""Download the Apple TV aerials listed in stills/aerials.txt (4K SDR HEVC) to stills/aerials/.

Apple serves these publicly (the same feed the Mac "Aerial" screensaver uses), but from a server
whose certificate Android 9 doesn't trust, so the Mac downloads them and stills.sh pushes them.
  --list   print the whole catalog instead
"""
import io
import json
import pathlib
import re
import subprocess
import sys
import tarfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
WANT = ROOT / "stills" / "aerials.txt"
OUT = ROOT / "stills" / "aerials"
MANIFEST = "https://sylvan.apple.com/Aerials/resources-15.tar"
CATS = {"AerialCategorySpace": "from the ISS", "AerialCategoryCities": "city", "AerialCategoryLandscapes": "landscape",
        "AerialCategoryUnderwater": "underwater"}


def curl(url, *args):
    return subprocess.run(["curl", "-sfL", *args, url], check=True, capture_output=True).stdout


def catalog():
    tar = tarfile.open(fileobj=io.BytesIO(curl(MANIFEST)))
    data = json.load(tar.extractfile("entries.json"))
    names = {c["id"]: c["localizedNameKey"] for c in data.get("categories", [])}
    out = []
    for a in data["assets"]:
        if not a.get("url-4K-SDR"):
            continue
        cat = next((names.get(c) for c in a.get("categories", []) if names.get(c)), "")
        out.append({"label": a["accessibilityLabel"], "kind": CATS.get(cat, ""), "url": a["url-4K-SDR"]})
    return out


def main():
    cat = catalog()
    if "--list" in sys.argv:
        for a in sorted(cat, key=lambda a: (a["kind"], a["label"])):
            print(f'{a["kind"]:14} {a["label"]}')
        return
    OUT.mkdir(parents=True, exist_ok=True)
    playlist = []
    for line in WANT.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"(.*?)\s*#(\d+)$", line)
        label, nth = (m[1], int(m[2])) if m else (line, 1)
        hits = [a for a in cat if a["label"].lower() == label.lower()]
        if len(hits) < nth:
            print(f"not in Apple's catalog: {line}", file=sys.stderr)
            continue
        a = hits[nth - 1]
        slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-") + (f"-{nth}" if nth > 1 else "")
        dest = OUT / f"{slug}.mov"
        if not dest.exists():
            print(f"downloading {label} (~350 MB)…", file=sys.stderr)
            part = dest.with_suffix(".part")
            subprocess.run(["curl", "-fL", "-C", "-", "--progress-bar", "-o", str(part), a["url"]], check=True)
            part.rename(dest)
        playlist.append({"file": dest.name, "title": a["label"], "kind": a["kind"]})
    (OUT / "aerials.json").write_text(json.dumps(playlist, indent=1))
    keep = {p["file"] for p in playlist} | {"aerials.json"}
    for f in OUT.iterdir():
        if f.name not in keep and not f.name.endswith(".part"):
            f.unlink()
    print(f"{len(playlist)} aerials ready", file=sys.stderr)


if __name__ == "__main__":
    main()
