#!/usr/bin/env bash
# Undo everything: re-enable every package in debloat/packages.txt,
# reset animations to stock, and hand the home button back to Amazon's launcher.
source "$(dirname "$0")/common.sh"
ensure_connected

grep -v '^\s*#' "$ROOT/debloat/packages.txt" | grep -v '^\s*$' | while read -r pkg _; do
  echo "$pkg: $(adb_tv shell pm enable "$pkg" 2>&1 || true)"
done

"$ROOT/scripts/animations.sh" 1.0
adb_tv shell pm enable com.amazon.tv.launcher >/dev/null 2>&1 || true
adb_tv shell am start -a android.intent.action.MAIN -c android.intent.category.HOME >/dev/null
echo "Restored stock behavior."
