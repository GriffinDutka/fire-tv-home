#!/usr/bin/env bash
# Disable packages from debloat/packages.txt by tier. Reversible with restore.sh.
# Usage: ./scripts/debloat.sh tracking ads extras [updates] [screensaver]
#        ./scripts/debloat.sh --dry-run tracking ads
source "$(dirname "$0")/common.sh"

dry=0
if [[ "${1:-}" == "--dry-run" ]]; then dry=1; shift; fi
if [[ $# -eq 0 ]]; then
  echo "Usage: $0 [--dry-run] <tier>...   (tiers: tracking ads extras updates screensaver)" >&2
  exit 1
fi
[[ $dry -eq 1 ]] || ensure_connected

tiers="$*"
grep -v '^\s*#' "$ROOT/debloat/packages.txt" | grep -v '^\s*$' | while read -r pkg _ tier _; do
  tier="${tier%:}"
  [[ " $tiers " == *" $tier "* ]] || continue
  if [[ $dry -eq 1 ]]; then
    echo "would disable: $pkg ($tier)"
  else
    result="$(adb_tv shell pm disable-user --user 0 "$pkg" </dev/null 2>&1 | head -1 || true)"
    echo "$pkg: $result"
  fi
done
