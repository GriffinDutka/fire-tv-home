#!/usr/bin/env bash
# Shared config. Override the TV address with: TV=10.0.0.x:5555 ./scripts/whatever.sh
set -euo pipefail

TV="${TV:-10.0.0.116:5555}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

adb_tv() { adb -s "$TV" "$@"; }

ensure_connected() {
  adb connect "$TV" >/dev/null 2>&1 || true
  local state
  state="$(adb -s "$TV" get-state 2>/dev/null || true)"
  if [[ "$state" != "device" ]]; then
    echo "TV at $TV is not connected (state: ${state:-none})." >&2
    echo "Check ADB Debugging is on and approve the prompt on the TV." >&2
    exit 1
  fi
}
