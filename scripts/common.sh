#!/usr/bin/env bash
# Shared helpers. Settings come from config/home.env (see scripts/setup.sh).
# Override the TV address for one run with: TV=192.168.1.50:5555 ./scripts/whatever.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/config.sh"

adb_tv() { adb -s "$TV" "$@"; }

ensure_connected() {
  need_config TV
  [[ "$TV" == *:* ]] || TV="$TV:5555"
  adb connect "$TV" >/dev/null 2>&1 || true
  local state
  state="$(adb -s "$TV" get-state 2>/dev/null || true)"
  if [[ "$state" != "device" ]]; then
    echo "TV at $TV is not connected (state: ${state:-none})." >&2
    echo "Check ADB Debugging is on and approve the prompt on the TV." >&2
    exit 1
  fi
}
