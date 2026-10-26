#!/usr/bin/env bash
# Screensaver slideshow: fetch film stills (if TMDB_API_KEY is set) and copy stills/images/ to the TV.
# Any .jpg you drop into stills/images/ is included too; its title comes from stills.json or the filename.
# Remove from the TV: ./scripts/stills.sh --clear
source "$(dirname "$0")/common.sh"
ensure_connected

DEST=/sdcard/Android/data/com.griffin.home/files/stills
SRC="$ROOT/stills/images"

if [[ "${1:-}" == "--clear" ]]; then
  adb_tv shell rm -rf "$DEST"
  echo "Stills removed from the TV."
  exit 0
fi

if [[ -n "${TMDB_API_KEY:-}" ]]; then
  python3 "$ROOT/scripts/fetch_stills.py"
fi

shopt -s nullglob
imgs=("$SRC"/*.jpg)
if (( ${#imgs[@]} == 0 )); then
  echo "No stills in $SRC. Set TMDB_API_KEY and re-run, or drop .jpg files there." >&2
  exit 1
fi

adb_tv shell rm -rf "$DEST" </dev/null
adb_tv shell mkdir -p "$DEST" </dev/null
adb_tv push "$SRC"/. "$DEST/" | tail -1
echo "${#imgs[@]} stills on the TV."
