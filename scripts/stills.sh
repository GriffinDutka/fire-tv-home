#!/usr/bin/env bash
# Screensaver media: film stills and Apple 4K aerials, copied to the TV.
#   Stills: set TMDB_API_KEY to (re)download the films in stills/films.txt. Any .jpg dropped into
#           stills/images/ is included too.
#   Aerials: downloads the clips in stills/aerials.txt (~350 MB each) into stills/aerials/.
# Remove everything from the TV: ./scripts/stills.sh --clear
source "$(dirname "$0")/common.sh"
ensure_connected

BASE=/sdcard/Android/data/com.griffin.home/files

if [[ "${1:-}" == "--clear" ]]; then
  adb_tv shell rm -rf "$BASE/stills" "$BASE/aerials" </dev/null
  echo "Stills and aerials removed from the TV."
  exit 0
fi

if [[ -n "${TMDB_API_KEY:-}" ]]; then
  python3 "$ROOT/scripts/fetch_stills.py"
fi
python3 "$ROOT/scripts/fetch_aerials.py"

# Mirror a local folder to the TV, skipping files already there with the same size.
sync_dir() {
  local src="$1" dest="$2" ext="$3"
  shopt -s nullglob
  local files=("$src"/*."$ext")
  adb_tv shell mkdir -p "$dest" </dev/null
  local remote
  remote="$(adb_tv shell "cd $dest && ls -l" </dev/null | awk '{print $5, $NF}' | tr -d '\r')"
  # Drop files on the TV that aren't local any more.
  while read -r _ name; do
    [[ -z "$name" || -e "$src/$name" ]] || adb_tv shell rm -f "$dest/$name" </dev/null
  done <<< "$remote"
  for f in ${files[@]+"${files[@]}"} "$src"/*.json; do
    local name size
    name="$(basename "$f")"; size="$(stat -f %z "$f")"
    if ! grep -qx "$size $name" <<< "$remote"; then
      echo "→ $name"
      adb_tv push "$f" "$dest/$name" </dev/null >/dev/null
    fi
  done
  echo "$(basename "$dest"): ${#files[@]} on the TV"
}

[[ -d "$ROOT/stills/images" ]] && sync_dir "$ROOT/stills/images" "$BASE/stills" jpg
[[ -d "$ROOT/stills/aerials" ]] && sync_dir "$ROOT/stills/aerials" "$BASE/aerials" mov
