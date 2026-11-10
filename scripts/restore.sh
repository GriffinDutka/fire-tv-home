#!/usr/bin/env bash
# Undo everything: re-enable every package in debloat/packages.txt,
# reset animations to stock, and hand the home button back to Amazon's launcher.
source "$(dirname "$0")/common.sh"
ensure_connected

grep -v '^\s*#' "$ROOT/debloat/packages.txt" | grep -v '^\s*$' | while read -r pkg _; do
  echo "$pkg: $(adb_tv shell pm enable "$pkg" </dev/null 2>&1 || true)"
done

"$ROOT/scripts/animations.sh" 1.0

# The home screen app: drop the home guard, then uninstall the app.
GUARD="com.griffin.home/com.griffin.home.HomeGuard"
current="$(adb_tv shell settings get secure enabled_accessibility_services | tr -d '\r')"
remaining="$(echo "$current" | tr ':' '\n' | grep -v -x -F "$GUARD" | grep -v -x null | paste -sd: - || true)"
if [[ -z "$remaining" ]]; then
  adb_tv shell settings delete secure enabled_accessibility_services >/dev/null
  adb_tv shell settings put secure accessibility_enabled 0
else
  adb_tv shell settings put secure enabled_accessibility_services "$remaining"
fi
adb_tv uninstall com.griffin.home >/dev/null 2>&1 || true

adb_tv shell pm enable com.amazon.tv.launcher >/dev/null 2>&1 || true
# Amazon's screensaver back.
adb_tv shell settings put secure screensaver_components com.amazon.ftv.screensaver/.app.services.ScreensaverService

adb_tv shell am start -a android.intent.action.MAIN -c android.intent.category.HOME >/dev/null
echo "Restored stock behavior."
