#!/usr/bin/env bash
# Calendars for Home and the screensaver: copies config/calendars.txt to the TV.
# One calendar per line, "Name|#color|secret iCal address" (see config/calendars.example.txt).
# The addresses are secret, so config/ stays out of git.
# Remove it from the TV: ./scripts/calendar.sh --clear
source "$(dirname "$0")/common.sh"

SRC="$ROOT/config/calendars.txt"
DEST=/sdcard/Android/data/com.griffin.home/files/config

if [[ "${1:-}" != "--clear" && ! -f "$SRC" ]]; then
  echo "No $SRC yet. Copy config/calendars.example.txt and fill in your calendars." >&2
  exit 1
fi

ensure_connected

if [[ "${1:-}" == "--clear" ]]; then
  adb_tv shell rm -f "$DEST/calendars.txt" </dev/null
  echo "Calendars removed from the TV."
  exit 0
fi

adb_tv shell mkdir -p "$DEST" </dev/null
adb_tv push "$SRC" "$DEST/calendars.txt" </dev/null >/dev/null
echo "Calendars on the TV: $(grep -cE '^[^#].*\|.*\|' "$SRC" || true). Home picks them up within a minute."
